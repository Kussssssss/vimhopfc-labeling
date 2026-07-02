"""
Test nhanh endpoint Modal sau khi deploy — kiểm tra model trả về nhãn SUP/REFUTE/NEI.

CHẠY Ở ĐÂU: máy cá nhân (PowerShell).
    pip install requests
    python deploy/test_endpoint.py https://<workspace>--gemma-unsloth-api-serve.modal.run

(Dán đúng URL Modal in ra sau `modal deploy`, KHÔNG cần thêm /v1 — script tự thêm.)
"""

import sys
import requests

BASE = (sys.argv[1] if len(sys.argv) > 1 else "").rstrip("/")
if not BASE:
    print("Thiếu URL. Ví dụ: python deploy/test_endpoint.py https://xxx--gemma-unsloth-api-serve.modal.run")
    sys.exit(1)
if not BASE.endswith("/v1"):
    BASE += "/v1"

MODEL = "Kus669/gemma_context_merged"

INSTRUCTION = (
    "Bạn là hệ thống fact-checking. Chỉ dựa vào phần Ngữ cảnh trong Input bên dưới, "
    "hãy phân loại claim thành đúng MỘT nhãn: SUP, REFUTE, hoặc NEI. "
    "Chỉ trả lời bằng một từ duy nhất: SUP, REFUTE hoặc NEI."
)

ctx = "Hà Nội là thủ đô của Việt Nam."
claim = "Hà Nội là thủ đô của Việt Nam."
prompt = (
    "Below is an instruction that describes a task, paired with an input that "
    "provides further context. Write a response that appropriately completes the request.\n\n"
    f"### Instruction:\n{INSTRUCTION}\n\n"
    f"### Input:\nNgữ cảnh:\n{ctx}\n\nCâu cần kiểm tra (claim):\n{claim}\n\n"
    "### Response:\n"
)

print(f"Đang gọi {BASE}/completions (lần đầu có thể mất 15-30s để bật GPU)...")
try:
    r = requests.post(
        f"{BASE}/completions",
        json={
            "model": MODEL,
            "prompt": prompt,
            "max_tokens": 16,
            "temperature": 0,
            "stop": ["<eos>", "###"],
        },
        timeout=120,
    )
    r.raise_for_status()
    text = r.json()["choices"][0]["text"].strip()
    print("\n--- OUTPUT THÔ CỦA MODEL ---")
    print(repr(text))
    label = next((w for w in ["SUP", "REFUTE", "NEI"] if w in text.upper()), None)
    if label:
        print(f"\n✅ OK. Parse được nhãn: {label}")
        print("=> Dán Base URL (kèm /v1) vào nút ⚙️ Model trong app là dùng được.")
    else:
        print("\n⚠️ Kết nối OK nhưng KHÔNG parse được SUP/REFUTE/NEI.")
        print("=> Model trả format khác. Cần chỉnh ô Instruction trong app cho khớp output trên.")
except Exception as e:
    print(f"\n❌ Lỗi: {e}")
    print("Kiểm tra: URL đúng chưa? model đã deploy chưa? (modal app list)")
