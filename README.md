# Quỹ Duy Trì

Trang web theo dõi quỹ duy trì của nhóm, chuyển từ file `Quỹ duy trì.xlsx`. Xem trực tiếp trên điện thoại, chỉnh sửa được ai đã đóng tiền / ai tham gia (ô o / x), lưu trực tiếp lên Supabase, chỉ chủ trang mới sửa được — đăng nhập bằng cách gõ một username (không lộ email thật trong code, xem mục "Đăng nhập" bên dưới).

## Cấu trúc thư mục

```
index.html            khung trang (không chứa logic)
css/
  style.css           toàn bộ giao diện (sáng/tối, responsive)
js/
  config.js           hằng số: URL/key Supabase (không chứa email hay username thật)
  utils.js            hàm dùng chung: định dạng số, escape HTML, dựng phần tử, bảng sắp xếp được
  dataStore.js         nơi giữ trạng thái dữ liệu (tĩnh + đang chỉnh sửa) và logic ghi lên Supabase
  auth.js               đăng nhập bằng username, badge trạng thái, realtime — module duy nhất "biết" Supabase
  charts.js              vẽ biểu đồ cột Thu/Chi bằng SVG
  main.js                 điểm khởi động: tải dữ liệu, dựng tab/panel, gắn sự kiện
  views/
    overview.js           tab Tổng quan
    collection.js         tab Thu theo đợt (bảng Đóng / Tham gia)
    expenses.js           tab Chi tiêu
    summary.js            tab Đóng góp
    attendees.js          tab Điểm danh
data/
  fund-data.json       dữ liệu gốc lấy từ 5 sheet trong file Excel
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

## Dữ liệu / backend

Ba bảng trên Supabase:
- `qdt_fund_collection` (slug, periods) — trạng thái Đóng/Tham gia theo từng đợt
- `qdt_attendees` (slug, sessions) — trạng thái điểm danh theo từng buổi
- `qdt_meta` (id, probed_at) — không chứa dữ liệu thật, chỉ dùng để "thăm dò" xem phiên đăng nhập hiện tại có quyền ghi hay không

Ai cũng đọc được (public), chỉ chủ trang ghi được (Row Level Security, không phụ thuộc vào việc giấu key trong code — anon key trong `config.js` vốn được thiết kế để lộ ra client, giống publishable key của Stripe).

## Đăng nhập (không lộ email thật lên GitHub)

Username và email của chủ trang **không nằm trong bất kỳ file nào ở repo này**. Chúng chỉ tồn tại ở hai nơi phía Supabase, không commit lên git:
- Policy RLS của các bảng trên (so khớp `auth.jwt() ->> 'email'`)
- Edge Function `request-login-link` (Deno, deploy thẳng lên Supabase, không nằm trong thư mục này)

Khi bấm nút đăng nhập và gõ username, trang gọi Edge Function đó; function kiểm tra username, nếu đúng thì tự gửi magic link tới email thật (chỉ nó biết), rồi luôn trả về cùng một câu trả lời chung — dù username đúng hay sai — để không ai đoán được username hợp lệ bằng cách dò thử. Sau khi đăng nhập, trang tự kiểm tra quyền ghi bằng cách thử ghi thật vào bảng `qdt_meta`, không so sánh email ở phía trình duyệt.
