# Quỹ Duy Trì

Trang web theo dõi quỹ duy trì của nhóm, chuyển từ file `Quỹ duy trì.xlsx`. Xem trực tiếp trên điện thoại, chỉnh sửa được ai đã đóng tiền / ai tham gia (ô o / x), lưu trực tiếp lên Supabase, chỉ chủ trang mới sửa được — đăng nhập bằng cách gõ một username (không lộ email thật trong code, xem mục "Đăng nhập" bên dưới).

## Cấu trúc thư mục

```
index.html            khung trang (không chứa logic)
css/
  style.css           toàn bộ giao diện (sáng/tối, responsive)
js/
  config.js           hằng số: URL/key Supabase (không chứa email hay username thật)
  utils.js            hàm dùng chung: định dạng số/ngày, escape HTML, dựng phần tử
  dataStore.js         NGUỒN SỰ THẬT: giữ dữ liệu, tính mọi con số dẫn xuất, và toàn bộ lệnh thêm/sửa/xoá
  auth.js               đăng nhập bằng username, badge trạng thái — module duy nhất "biết" Supabase
  charts.js              vẽ biểu đồ cột Thu/Chi bằng SVG
  main.js                 điểm khởi động: dựng tab/panel, dải chỉ số
  views/
    overview.js           tab Tổng quan (chỉ xem, tự tính)
    collection.js         tab Thu theo đợt — bảng chính, nhập liệu ở đây
    expenses.js           tab Chi tiêu (thêm/sửa/xoá khoản chi)
    summary.js            tab Đóng góp (chỉ xem, tự tính)
    attendees.js          tab Điểm danh (cùng dữ liệu với cột Tham gia)
data/
  snapshot.json        bản chụp tĩnh để xem được khi chưa/không kết nối Supabase
```

Các view chỉ gọi hàm trong `dataStore.js` và tự vẽ lại khi có thay đổi — không tự gọi Supabase, nên có thể sửa giao diện từng tab mà không đụng tới phần đăng nhập/ghi dữ liệu, và ngược lại.

## Chạy thử ở máy (trước khi đưa lên GitHub)

Trang dùng ES modules (`<script type="module">`) nên **không mở trực tiếp bằng cách bấm đúp vào `index.html`** (trình duyệt sẽ chặn vì lý do bảo mật CORS với `file://`). Cần chạy qua một server tĩnh nhỏ, ví dụ:

```
cd quy-duy-tri-web
python3 -m http.server 8000
```

rồi mở `http://localhost:8000`. Khi đã đưa lên GitHub Pages thì mở bình thường, không cần bước này.

## Đưa lên GitHub Pages

```
cd quy-duy-tri-web
git init
git add .
git commit -m "Add Quỹ Duy Trì site"
git branch -M main
git remote add origin https://github.com/<username>/<ten-repo>.git
git push -u origin main
```

Sau đó: **Settings → Pages** trên GitHub → Source chọn `main` / `(root)` → Save. Sẽ có link dạng `https://<username>.github.io/<ten-repo>/`.

**Bước bắt buộc để nút đăng nhập hoạt động:** vào Supabase Dashboard (project đang dùng) → Authentication → URL Configuration → thêm đúng link GitHub Pages ở trên vào mục **Redirect URLs** → Save.

## Dữ liệu / backend — một nguồn sự thật duy nhất

Bốn bảng trên Supabase:

| Bảng | Nội dung |
|---|---|
| `qdt_members` | danh sách người (id, name, sort_order) |
| `qdt_periods` | các đợt thu / buổi (id, label, event_date, sort_order) |
| `qdt_contributions` | mỗi ô: người X ở đợt Y đóng bao nhiêu (`amount`) và có đi không (`joined` = o/x) |
| `qdt_expenses` | từng khoản chi (ngày, nhóm, nội dung, số tiền âm) |

Thêm `qdt_meta` — không chứa dữ liệu thật, chỉ dùng để "thăm dò" xem phiên đăng nhập hiện tại có quyền ghi hay không.

**Không có số nào được ghi cứng.** Mọi con số trên trang đều tính ra từ 4 bảng trên:

- Đóng góp của một người = cộng `amount` của người đó
- Tổng thu = cộng toàn bộ `amount` &nbsp;·&nbsp; Tổng chi = cộng `qdt_expenses.amount`
- Chênh lệch = tổng thu + tổng chi
- Số buổi tham gia = đếm ô `joined = 'o'` trong các đợt đã có ngày
- Tab Điểm danh = chính cột `joined` đó, không phải bảng riêng

Nhờ vậy thêm/sửa/xoá ở bất kỳ tab nào thì tất cả các tab khác tự khớp theo — không còn khả năng hai bảng nói hai số khác nhau.

Ai cũng đọc được (public), chỉ chủ trang thêm/sửa/xoá được (Row Level Security, không phụ thuộc vào việc giấu key trong code — anon key trong `config.js` vốn được thiết kế để lộ ra client, giống publishable key của Stripe).

`data/snapshot.json` là bản chụp tĩnh kèm theo trang: nạp trước để trang hiện ra ngay và vẫn xem được khi mất mạng, sau đó bị dữ liệu thật từ Supabase ghi đè.

## Sửa dữ liệu ngay trên trang

Sau khi đăng nhập:

- **Thu theo đợt** — một bảng duy nhất; gõ thẳng số tiền vào ô, bấm ô Tham gia để xoay o → x → trống. `+ Thêm người`, `+ Thêm đợt`; bấm `×` cuối tên để xoá người, bấm `⋯` trên đầu cột để đổi tên/ngày đợt hoặc xoá đợt (để trống tên rồi OK là xoá).
- **Chi tiêu** — `+ Thêm khoản chi`, sửa trực tiếp từng ô, `×` để xoá.
- **Điểm danh** — bấm o/x, cùng dữ liệu với cột Tham gia.
- **Đóng góp** và **Tổng quan** — chỉ xem, tự tính.

Xoá một người sẽ xoá luôn mọi ô đóng góp của người đó (khoá ngoại `on delete cascade`); xoá một đợt cũng vậy.

## Đăng nhập (không lộ email thật lên GitHub)

Username và email của chủ trang **không nằm trong bất kỳ file nào ở repo này**. Chúng chỉ tồn tại ở hai nơi phía Supabase, không commit lên git:
- Policy RLS của các bảng trên (so khớp `auth.jwt() ->> 'email'`)
- Edge Function `request-login-link` (Deno, deploy thẳng lên Supabase, không nằm trong thư mục này)

Khi bấm nút đăng nhập và gõ username, trang gọi Edge Function đó. Function so username với giá trị nó giữ; nếu đúng thì dùng service-role key (chỉ có ở phía server) sinh một token đăng nhập **dùng một lần** và trả về cho trang. Trang đổi ngay token đó lấy phiên đăng nhập thật bằng `verifyOtp` — nên chỉnh sửa bật lên luôn, không phải mở email. Nếu username sai, function trả `{ ok: false }` và cố tình chậm lại ~0,7 giây cho việc dò tìm tốn thời gian hơn.

Sau khi đăng nhập, trang tự kiểm tra quyền ghi bằng cách thử ghi thật vào bảng `qdt_meta`, không so sánh email ở phía trình duyệt. Phiên đăng nhập được lưu lại nên lần sau mở trang vẫn còn quyền sửa, tới khi bấm vào badge để đăng xuất.

**Lưu ý bảo mật:** với cách này username đóng vai trò như mật khẩu — ai biết nó cũng chỉnh sửa được. Đổi username: sửa `OWNER_USERNAME` trong Edge Function rồi deploy lại (không đụng gì tới repo này). Muốn chắc hơn thì thêm một mã PIN kiểm tra cùng lúc trong chính function đó.
