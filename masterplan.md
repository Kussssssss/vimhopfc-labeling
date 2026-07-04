# Kế hoạch tối ưu model Gemma với vLLM (Masterplan)

## 1. Phân tích nguyên nhân giảm hiệu năng và độ chính xác
Khi bạn dùng Unsloth để fine-tune mô hình 4-bit (`unsloth/gemma-7b-bnb-4bit`), Unsloth đã áp dụng kỹ thuật LoRA. 
Việc bạn merge (gộp) LoRA (16-bit) trở lại vào Base Model (4-bit) để tạo ra 1 model 16-bit hoàn chỉnh (`Kus669/gemma_context_merged`) gặp 2 vấn đề lớn:
- **Giảm tốc độ và tốn VRAM**: Base model từ 4-bit (chỉ nặng ~5GB) bị "dequantize" và chuyển thành 16-bit (nặng ~15GB). Khi chạy inference, GPU phải đọc lượng dữ liệu gấp 3 lần, làm giảm tốc độ sinh token (memory bandwidth bound).
- **Giảm độ chính xác (Accuracy degradation)**: Việc giải nén model từ 4-bit lên 16-bit rồi cộng các trọng số LoRA vào thường gây ra sai số làm tròn (quantization/dequantization error). Đó là lý do khi chạy trực tiếp bằng Unsloth (giữ nguyên base 4-bit + adapter rời) kết quả lại tốt hơn.

## 2. Kế hoạch triển khai (Sửa đổi mã trong `app.py`)
Thay vì tải model đã merge, chúng ta sẽ cấu hình vLLM để gọi trực tiếp base model 4-bit và ghép adapter LoRA vào lúc runtime.

**Các thay đổi trong `deploy/app.py`:**
- Thay đổi `MODEL_NAME` thành `unsloth/gemma-7b-bnb-4bit`.
- Bổ sung cấu hình `--quantization bitsandbytes` (hoặc `--load-format bitsandbytes`) vào command vLLM để tải model dưới dạng 4-bit.
- Bật cờ `--enable-lora` để vLLM hỗ trợ LoRA adapter.
- Bổ sung cờ `--lora-modules gemma_context=tranthaihoa/gemma_context` để tải adapter.
- Cập nhật phiên bản thư viện (nếu cần thiết) để đảm bảo vLLM hỗ trợ tốt BitsAndBytes và LoRA cùng lúc.

## 3. Các đề xuất thay thế để giữ Performance như Unsloth
Nếu việc chạy Base Model + LoRA trên vLLM bằng BitsAndBytes vẫn chưa đạt tốc độ như bạn mong muốn (do vLLM tối ưu cho AWQ/GPTQ tốt hơn là BitsAndBytes), bạn có thể cân nhắc 2 phương pháp sau:

### Đề xuất A: Chuyển đổi và sử dụng AWQ (Khuyên dùng cho vLLM)
- Unsloth có hỗ trợ xuất model trực tiếp ra định dạng AWQ (4-bit).
- Bạn có thể chạy hàm `model.save_pretrained_awq("model_awq")` trong Unsloth notebook để tạo ra 1 model AWQ 4-bit (đã bao gồm LoRA).
- Định dạng AWQ được vLLM tối ưu hóa nhân tính toán (CUDA kernels) cực kỳ tốt, đem lại tốc độ nhanh hơn hẳn so với BitsAndBytes 4-bit mà vẫn giữ nguyên được hiệu năng/độ chính xác.

### Đề xuất B: Sử dụng định dạng GGUF (Llama.cpp)
- Bạn xuất model từ Unsloth sang định dạng GGUF (`save_pretrained_gguf`).
- Định dạng GGUF nén model và adapter cực kỳ chuẩn, giữ lại độ chính xác rất cao. GGUF phù hợp nhất nếu ứng dụng của bạn có batch size nhỏ (chủ yếu phản hồi 1-1 cho user). Bạn có thể thay thế vLLM bằng `llama-cpp-python` để chạy trực tiếp GGUF trên Modal.

---

**Trạng thái hiện tại:**
Tôi đã ghi lại bản kế hoạch này. Bạn hãy đọc qua. Nếu bạn đồng ý tiến hành triển khai giải pháp sử dụng vLLM load trực tiếp **Base 4-bit + LoRA**, tôi sẽ bắt đầu chỉnh sửa `app.py`. Nếu bạn muốn đổi sang hướng **AWQ** hoặc **GGUF**, hãy cho tôi biết!
