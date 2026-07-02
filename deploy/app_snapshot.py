"""
BẢN TĂNG TỐC bằng GPU Memory Snapshot (EXPERIMENTAL).

Cold-start giảm từ ~2 phút xuống còn vài giây, nhờ Modal chụp lại nguyên trạng
GPU đã nạp model + CUDA graph, lần sau khôi phục thẳng thay vì nạp lại.

Khác app.py thế nào:
- Dùng class + @modal.enter(snap=True/False) theo đúng ví dụ chính thức của Modal
  (modal.com/docs/examples/lfm_snapshot).
- vLLM chạy kèm --enable-sleep-mode + VLLM_SERVER_DEV_MODE=1 để có endpoint /sleep, /wake_up.
- Bật enable_memory_snapshot + experimental_options={"enable_gpu_snapshot": True}.

CÁCH DÙNG (máy cá nhân, PowerShell):
    pip install -U modal            # cần Modal bản mới để có @app.cls snapshot + @app.server
    modal deploy app_snapshot.py

Lần deploy đầu Modal sẽ tạo snapshot (nạp model 1 lần, chậm). Từ lần cold-start sau
sẽ khôi phục trong vài giây. App này là app Modal RIÊNG (tên "gemma-ctx-snapshot") nên
endpoint sẽ KHÁC app.py -> COPY đúng URL Modal in ra sau `modal deploy`, thêm "/v1",
rồi dán vào nút ⚙️ Model trong app.

(App cũ "gemma-unsloth-api" vẫn còn; nếu muốn gỡ để khỏi trùng: `modal app stop gemma-unsloth-api`.)

LƯU Ý: đây là tính năng thử nghiệm của Modal. Nếu lỗi, cứ quay lại dùng app.py (bản ổn định).
Nếu báo lỗi không có `app.server` hoặc `experimental_options` -> chạy `pip install -U modal`.
"""

import subprocess
import time

import modal

MINUTES = 60
MODEL_NAME = "Kus669/gemma_context_merged"
VLLM_PORT = 8000

# Dùng ảnh vLLM chính thức (đã có sleep-mode) — khớp phiên bản Modal test snapshot
vllm_image = (
    modal.Image.from_registry("vllm/vllm-openai:v0.15.1")
    .entrypoint([])
    .run_commands("ln -s $(which python3) /usr/bin/python")  # để Modal dò được Python
    .env(
        {
            "HF_HUB_CACHE": "/root/.cache/huggingface",
            "VLLM_SERVER_DEV_MODE": "1",  # mở endpoint /sleep, /wake_up
            "MODEL_NAME": MODEL_NAME,
        }
    )
)

app = modal.App("gemma-ctx-snapshot")
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache", create_if_missing=True)

with vllm_image.imports():
    import requests


def _check_running(p):
    rc = p.poll()
    if rc is not None:
        raise subprocess.CalledProcessError(rc, cmd=p.args)


def _wait_ready(process, timeout=15 * MINUTES):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            _check_running(process)
            requests.get(f"http://127.0.0.1:{VLLM_PORT}/health").raise_for_status()
            return
        except (subprocess.CalledProcessError, requests.exceptions.ConnectionError,
                requests.exceptions.HTTPError):
            time.sleep(5)
    raise TimeoutError(f"vLLM chưa sẵn sàng sau {timeout}s")


def _warmup():
    payload = {"model": "llm", "prompt": "Hello", "max_tokens": 8}
    for _ in range(3):
        requests.post(f"http://127.0.0.1:{VLLM_PORT}/v1/completions",
                      json=payload, timeout=60).raise_for_status()


def _sleep(level=1):
    requests.post(f"http://127.0.0.1:{VLLM_PORT}/sleep?level={level}").raise_for_status()


def _wake_up():
    requests.post(f"http://127.0.0.1:{VLLM_PORT}/wake_up").raise_for_status()


@app.server(
    image=vllm_image,
    gpu="L4",
    scaledown_window=10 * MINUTES,
    startup_timeout=15 * MINUTES,
    max_containers=1,
    volumes={
        "/root/.cache/huggingface": hf_cache,
        "/root/.cache/vllm": vllm_cache,
    },
    enable_memory_snapshot=True,                          # chụp trạng thái container
    experimental_options={"enable_gpu_snapshot": True},   # kèm cả bộ nhớ GPU
    port=VLLM_PORT,
    unauthenticated=True,   # cho phép app gọi không cần token (giống app.py)
)
class GemmaSnapshot:
    @modal.enter(snap=True)
    def startup(self):
        """Chạy TRƯỚC khi chụp snapshot: khởi động vLLM, làm nóng, rồi cho ngủ."""
        cmd = [
            "vllm", "serve", MODEL_NAME,
            "--served-model-name", MODEL_NAME,
            "--served-model-name", "llm",
            "--host", "0.0.0.0",
            "--port", str(VLLM_PORT),
            "--dtype", "bfloat16",
            "--max-model-len", "2048",
            "--gpu-memory-utilization", "0.85",
            "--enable-sleep-mode",   # bắt buộc để snapshot GPU hoạt động
        ]
        self.process = subprocess.Popen(cmd)
        _wait_ready(self.process)
        _warmup()
        _sleep(level=1)

    @modal.enter(snap=False)
    def restore(self):
        """Chạy SAU khi khôi phục từ snapshot: đánh thức vLLM để phục vụ ngay."""
        _wake_up()

    @modal.exit()
    def stop(self):
        self.process.terminate()
