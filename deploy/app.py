"""
Deploy model fine-tune (Gemma) thành API OpenAI-compatible trên Modal.

CHẠY Ở ĐÂU: trên MÁY CÁ NHÂN của bạn (PowerShell), KHÔNG phải Colab.

Các bước (xem deploy/HUONG_DAN.md để biết chi tiết):
    pip install modal
    modal setup
    modal serve app.py     # test thử, cho URL tạm
    modal deploy app.py    # deploy thật, cho URL cố định

Model repo `gemma_context_merged` là PUBLIC nên KHÔNG cần HF token để tải.
(Chỉ khi repo của bạn để PRIVATE mới cần — xem ghi chú ở phần `secrets` bên dưới.)

Sau khi deploy, lấy URL Modal in ra, thêm "/v1" rồi dán vào nút "⚙️ Model" trong app.
"""

import modal

# 1) Môi trường chạy: CUDA + vLLM
vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.8.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .uv_pip_install("vllm==0.13.0", "huggingface-hub==0.36.0")
)

# 2) Cấu hình model — ĐỔI nếu repo của bạn khác
MODEL_NAME = "Kus669/gemma_context_merged"  # repo merged tạo từ colab_merge_model.ipynb
VLLM_PORT = 8000

app = modal.App("gemma-unsloth-api")

# Volume cache để lần khởi động sau không tải lại model từ HF (nhanh hơn nhiều)
hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)


@app.function(
    image=vllm_image,
    gpu="L4",                 # 24GB, đủ cho Gemma-7B fp16. Idle = $0 (scale-to-zero)
    scaledown_window=600,     # giữ GPU ấm 10 phút sau request cuối -> trong 1 phiên làm việc
                              # chỉ cold-start 1 lần, các lần sau <1s. (tối đa Modal cho phép: 1200)
    timeout=10 * 60,
    max_containers=1,         # khóa chi phí: chỉ chạy tối đa 1 GPU (Modal docs: cap containers)
    volumes={"/root/.cache/huggingface": hf_cache},
    # CHỈ cần nếu repo model để PRIVATE. Repo public thì bỏ trống (mặc định).
    # Nếu dùng: chạy trước `modal secret create huggingface-secret HF_TOKEN=hf_xxx`
    # rồi bỏ comment dòng dưới:
    # secrets=[modal.Secret.from_name("huggingface-secret")],
)
@modal.concurrent(max_inputs=16)
@modal.web_server(port=VLLM_PORT, startup_timeout=10 * 60)
def serve():
    import subprocess

    cmd = [
        "vllm", "serve", MODEL_NAME,
        "--served-model-name", MODEL_NAME,
        "--host", "0.0.0.0",
        "--port", str(VLLM_PORT),
        "--max-model-len", "2048",
        "--gpu-memory-utilization", "0.90",
        "--enforce-eager",        # bỏ bước capture CUDA graph -> boot nhanh hơn ~30-60s.
                                  # Output ngắn (16 token) nên inference gần như không chậm đi.
        # Nếu app báo lỗi CORS khi bấm "Test kết nối", BỎ COMMENT 2 dòng dưới rồi deploy lại:
        # "--allowed-origins", '["*"]',
    ]
    subprocess.Popen(cmd)
