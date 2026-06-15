# ViMHoPFC Labeling Tool

Giao diện gắn nhãn cho dữ liệu **multi-hop fact-checking**. Tool giúp annotator đọc hai ngữ cảnh liên quan đến cùng một sample, nhận diện entity cầu nối/subject entity, viết claim theo nhãn `SUP`, `REFUTE`, `NEI`, rồi bôi chọn evidence trong từng context để gắn với claim tương ứng.

## Tính năng chính

- Hiển thị `Context A` và `Context B` theo dạng hai box xếp trên/dưới.
- Tự highlight entity có sẵn trong dữ liệu, gồm `bridge_entity`, `subject_entity`, các entity nằm trong marker `[[...]]`, và một số answer/entity liên quan trong JSON.
- Tạo, sửa, xóa claim với nhãn `SUP`, `REFUTE`, `NEI`.
- Bôi chọn trực tiếp một đoạn trong Context A hoặc Context B để tạo evidence.
- Evidence tự sinh tag theo claim và nhãn, ví dụ `Evidence SUP 1`, `Evidence REFUTE 2`, `Evidence NEI 1.2`.
- Lưu annotation tạm thời bằng `localStorage` theo tên file CSV.
- Export kết quả ra `JSON` hoặc `CSV`.
- Có bộ lọc theo `status` và ô tìm kiếm theo entity/context/question.

## Cấu trúc thư mục

```text
.
├── index.html
├── styles.css
├── app.js
├── data.sample.csv
├── run_server.ps1
└── README.md
```

## Chạy tool

Yêu cầu: máy có Python trong `PATH`.

Tại thư mục project, chạy:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_server.ps1
```

Sau đó mở browser tại:

```text
http://127.0.0.1:8084
```

Nếu port `8084` đang bận, sửa biến `$port` trong `run_server.ps1`.

## Chính sách dữ liệu

Repo chỉ chứa `data.sample.csv` với dữ liệu mock nhỏ để demo. Không commit hoặc push file dữ liệu thật. Nếu cần dùng dữ liệu thật, hãy nạp file bằng nút `Nạp CSV` trong browser; annotation export sẽ được tải về máy của annotator.

## Dữ liệu đầu vào

Tool tự nạp file mock `data.sample.csv` nằm cùng thư mục để demo giao diện. Dữ liệu thật không được commit vào repo; khi cần gắn nhãn thật, bấm nút `Nạp CSV` trên giao diện và chọn file CSV local trên máy.

Các cột CSV đang được app sử dụng:

| Cột | Vai trò |
| --- | --- |
| `bridge_entity` | Entity cầu nối giữa hai context |
| `subject_entity` | Subject entity của sample |
| `bridge_type`, `subject_type` | Loại entity, hiển thị ở phần metadata |
| `segment_text` | Fallback cho Context B |
| `sub_question_result` | JSON chứa `document_a_segments`, `document_b_segments`, sub-question, answer, reasoning |
| `multi_hop_result` | JSON chứa multi-hop question, answer, fact A, fact B |
| `status`, `rank` | Dùng cho metadata và filter |

Ưu tiên lấy context theo thứ tự:

1. `Context A`: `sub_question_result.analysis.document_a_segments`
2. `Context B`: `sub_question_result.analysis.document_b_segments`
3. Nếu Context B không có trong JSON, dùng `segment_text`

## Quy trình gắn nhãn

1. Chọn sample bằng nút trước/sau hoặc nhập số sample.
2. Đọc `Context A`, `Context B`, bridge entity, subject entity, multi-hop question và answer.
3. Bấm `+ SUP`, `+ REFUTE`, hoặc `+ NEI` để thêm claim mới.
4. Viết nội dung claim trong ô claim tương ứng.
5. Bôi đen đoạn evidence trong Context A hoặc Context B.
6. Chọn claim đích và nhãn evidence ở panel `Evidence`.
7. Bấm `Gắn evidence`.
8. Kiểm tra tag evidence xuất hiện ngay trong context.
9. Khi hoàn tất, dùng `Export JSON` hoặc `Export CSV`.

## Ý nghĩa nhãn

- `SUP`: claim được hỗ trợ bởi evidence đã chọn.
- `REFUTE`: claim bị bác bỏ hoặc mâu thuẫn với evidence đã chọn.
- `NEI`: context hiện có chưa đủ thông tin để kết luận claim đúng/sai.

Với bài toán multi-hop, annotator nên chọn evidence đủ để thể hiện đường suy luận qua hai context. Nếu claim cần cả hai hop, hãy gắn evidence từ cả Context A và Context B vào cùng claim.

## Lưu trữ và export

Annotation được lưu trong browser `localStorage`, theo key gắn với tên file CSV. Nếu reload trang, annotation vẫn còn trên cùng browser.

`Export JSON` gồm toàn bộ cấu trúc claim/evidence theo từng sample.

`Export CSV` gồm các cột:

- `sample_key`
- `row_number`
- `bridge_entity`
- `subject_entity`
- `claim_id`
- `claim_label`
- `claim_text`
- `evidence_id`
- `evidence_label`
- `evidence_tag`
- `context_id`
- `start`
- `end`
- `evidence_text`

## Ghi chú kỹ thuật

- Tool là static web app, không cần build step và không cần cài package JavaScript.
- CSV parser được viết trong `app.js`, hỗ trợ field có quote và newline.
- Evidence được lưu bằng offset `start/end` trên text đã render sạch marker `[[...]]`.
- Entity highlight và evidence highlight có thể chồng nhau; evidence tag được render bằng CSS để không làm lệch offset khi tiếp tục bôi chọn text.

## Troubleshooting

Nếu trang không tự nạp dữ liệu:

- Đảm bảo đang mở qua `http://127.0.0.1:8084`, không mở trực tiếp file `index.html`.
- Kiểm tra `data.sample.csv` nằm cùng thư mục với `index.html`, hoặc nạp CSV thật bằng nút `Nạp CSV`.
- Mở DevTools console để xem lỗi parse CSV/JSON nếu file đầu vào khác schema.

Nếu nút `Gắn evidence` bị disable:

- Cần tạo ít nhất một claim trước.
- Cần bôi chọn text nằm hoàn toàn trong một context, không kéo selection qua cả hai context.

Nếu muốn xóa dữ liệu annotation tạm:

- Xóa site data/localStorage của `127.0.0.1:8084` trong browser.
- Hoặc đổi tên file CSV, app sẽ dùng một key localStorage khác.


