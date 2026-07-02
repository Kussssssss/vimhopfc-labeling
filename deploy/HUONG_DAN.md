# Hướng dẫn deploy model lên Modal & nối vào app

Mục tiêu: biến model fine-tune (`tranthaihoa/gemma_context`) thành API trên Modal, rồi
dùng trong tool gắn nhãn để kiểm chứng one-hop khi Submit.

> **Khái niệm:** Modal là serverless — bạn KHÔNG tự dựng/quản server. Chỉ khai báo `gpu="L4"`,
> Modal tự thuê GPU, tự bật khi có request, tự tắt khi rảnh, và **trừ vào credits**. Lúc không
> ai dùng = **$0**. Model 7B bắt buộc cần GPU; credits chính là tiền trả cho GPU đó.

---

## Hai môi trường — đừng nhầm

| Ký hiệu | Chạy ở đâu | Làm gì |
|---|---|---|
| 🟦 | **Google Colab** (notebook có GPU) | Gộp adapter → đẩy model merged lên HF |
| 🟩 | **Máy cá nhân** (PowerShell) | Cài Modal & deploy API |

---

## 🟦 BƯỚC 1 — Gộp model (Colab, làm 1 lần)

Repo `gemma_context` hiện chỉ là **LoRA adapter 200MB**, chưa chạy độc lập được. Cần gộp với
base model thành bản fp16 hoàn chỉnh.

1. Vào https://huggingface.co/settings/tokens → tạo token quyền **Write** → copy.
2. Mở https://colab.research.google.com → File → Upload notebook → chọn `colab_merge_model.ipynb`.
3. Runtime → Change runtime type → **T4 GPU** → Save.
4. Dán token vào ô code (`hf_xxx`), chạy lần lượt các ô.
5. Xong → có repo mới **`Kus669/gemma_context_merged`**.

> Đây là bước *đóng gói*, KHÔNG train lại. Chạy vài phút là xong.

---

## 🟩 BƯỚC 2 — Deploy lên Modal (máy cá nhân)

Mở PowerShell:

```powershell
pip install modal
modal setup                 # mở browser -> Approve (1 lần)
```

> **Không cần HF token ở đây.** Repo `gemma_context_merged` là public nên Modal tải thẳng được.
> (Chỉ khi bạn để repo PRIVATE mới cần: chạy `modal secret create huggingface-secret HF_TOKEN=hf_xxx`
> rồi bỏ comment dòng `secrets=...` trong `app.py`.)

Rồi `cd` tới thư mục chứa `app.py` (thư mục `deploy/` này) và chạy:

```powershell
modal serve app.py      # chạy thử, cho URL tạm — Ctrl+C để tắt
modal deploy app.py     # deploy thật, chạy 24/7, cho URL cố định
```

Modal sẽ in ra URL dạng:
```
https://<workspace>--gemma-unsloth-api-serve.modal.run
```
**Copy URL này.**

---

## 🟩 BƯỚC 3 — Test endpoint (máy cá nhân)

```powershell
pip install requests
python test_endpoint.py https://<workspace>--gemma-unsloth-api-serve.modal.run
```

- `✅ Parse được nhãn` → ngon, sang bước 4.
- `⚠️ không parse được nhãn` → model trả format khác, cần chỉnh ô Instruction trong app.
- `❌ Lỗi` → kiểm tra URL / `modal app list`.

---

## BƯỚC 4 — Nối vào app

Mở tool gắn nhãn (`http://127.0.0.1:8084`) → bấm **⚙️ Model**, điền:

| Ô | Giá trị |
|---|---|
| Base URL | `https://<workspace>--gemma-unsloth-api-serve.modal.run/v1` (nhớ `/v1`) |
| API Key | `empty` |
| Model | `Kus669/gemma_context_merged` |
| Temperature | `0` |
| Timeout (ms) | `240000` (đủ vượt cold-start ~2-3 phút lần gọi đầu) |

→ **🧪 Test kết nối** → **Lưu**. Xong. Giờ mỗi lần Submit, claim SUP/REFUTE sẽ được kiểm one-hop.

---

## Sự cố thường gặp

| Triệu chứng | Xử lý |
|---|---|
| Test báo lỗi **CORS** (xem Console F12) | Trong `app.py` bỏ comment dòng `"--allowed-origins", '["*"]'` → `modal deploy` lại |
| `Hết thời gian chờ` | Cold-start chưa xong → tăng Timeout trong ⚙️ Model (240000+), hoặc bấm lại sau khi GPU đã warm |
| Mỗi lần nghỉ >1 phút lại chờ lâu | GPU ngủ sau 60s rảnh. Muốn giữ ấm lâu hơn: sửa `scaledown_window=300` trong `app.py` rồi deploy lại (tốn thêm chút credits idle) |
| `HTTP 404` | Sai Base URL (thiếu `/v1`) hoặc sai tên Model |
| Test OK nhưng "chưa parse được nhãn" | Sửa ô Instruction cho khớp output model |
| Lần đầu trong ngày chậm ~20s | Bình thường (scale-to-zero), app đã có overlay báo |

---

## Chi phí

- L4 ≈ $0.80/giờ, chỉ tính khi GPU đang chạy. Idle 60s → tự tắt → $0.
- $30 credits ≈ 37 giờ chạy thật → kiểm được hàng nghìn claim.
- Theo dõi tại Modal Dashboard → Settings → Billing.

---

## (Nâng cao) Tăng tốc cold-start bằng GPU Snapshot

`app.py` (bản ổn định) cold-start ~1-2 phút lần đầu mỗi phiên. Nếu muốn cold-start chỉ
**vài giây**, dùng bản thử nghiệm `app_snapshot.py`:

```powershell
pip install -U modal          # cần Modal bản mới
modal deploy app_snapshot.py
```

- Deploy đầu tiên chậm (Modal nạp model 1 lần để chụp snapshot GPU). Các cold-start sau vài giây.
- Đây là **app Modal riêng** → endpoint KHÁC. Copy URL mới Modal in ra, thêm `/v1`, dán lại vào ⚙️ Model.
- Là tính năng **experimental** của Modal. Nếu lỗi, quay lại dùng `app.py`.
- Muốn tránh chạy song song 2 app: `modal app stop gemma-unsloth-api` (tắt bản cũ).

So sánh nhanh:

| | `app.py` (ổn định) | `app_snapshot.py` (nhanh) |
|---|---|---|
| Cold-start | ~1-2 phút | **~vài giây** |
| Độ ổn định | Cao | Experimental |
| Khi warm | <1s | <1s |
