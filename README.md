# Quỹ Duy Trì

Trang web theo dõi quỹ duy trì của nhóm. Xem được trên điện thoại, chủ trang đăng nhập rồi
thêm/sửa/xoá trực tiếp; mọi số liệu lưu trên **Cloud Firestore (Firebase)**.

Chọn Firebase vì gói miễn phí **không khoá dự án khi lâu không dùng** — khác với Supabase,
vốn tạm dừng dự án sau khoảng 7 ngày không có hoạt động.

## Cấu trúc thư mục

```
index.html            khung trang (không chứa logic)
firestore.rules       luật phân quyền — DÁN VÀO Firebase Console, không tự chạy từ đây
css/
  style.css           toàn bộ giao diện (sáng/tối, responsive)
js/
  config.js           DÁN cấu hình Firebase của bạn vào đây
  firebase.js         nơi duy nhất nạp thư viện Firebase (import động, hỏng CDN vẫn xem được trang)
  utils.js            định dạng số/ngày, escape HTML, dựng phần tử, giữ con trỏ khi vẽ lại
  dataStore.js        NGUỒN SỰ THẬT: giữ dữ liệu, tính mọi con số, và toàn bộ lệnh thêm/sửa/xoá
  auth.js             đăng nhập username + mật khẩu, badge trạng thái
  charts.js           vẽ biểu đồ cột Thu/Chi bằng SVG
  main.js             điểm khởi động: dựng tab/panel, dải chỉ số
  views/
    overview.js       tab Tổng quan (chỉ xem, tự tính)
    collection.js     tab Thu theo đợt — bảng chính, nhập liệu ở đây
    expenses.js       tab Chi tiêu (thêm/sửa/xoá khoản chi)
    summary.js        tab Đóng góp (chỉ xem, tự tính)
    attendees.js      tab Điểm danh (cùng dữ liệu với cột Tham gia)
data/
  snapshot.json       bản chụp tĩnh để xem được khi chưa/không kết nối Firestore
tools/
  import.html         nạp snapshot vào Firestore — CHẠY MỘT LẦN rồi xoá đi được
```

Các view chỉ gọi hàm trong `dataStore.js` và tự vẽ lại khi có thay đổi — không tự gọi Firestore,
nên sửa giao diện từng tab mà không đụng tới phần đăng nhập/ghi dữ liệu, và ngược lại.

---

## Cài đặt Firebase (làm một lần)

**1. Tạo dự án.** Vào [console.firebase.google.com](https://console.firebase.google.com) →
*Add project* → đặt tên → tắt Google Analytics cho gọn → Create.

**2. Bật Firestore.** Menu trái → *Build → Firestore Database* → *Create database* →
chọn vùng gần (`asia-southeast1` Singapore) → chọn **Production mode** (luật sẽ dán ở bước 5).

**3. Bật đăng nhập.** *Build → Authentication* → *Get started* → tab *Sign-in method* →
bật **Email/Password** (chỉ dòng trên, không cần Email link) → Save.

Sang tab *Users* → *Add user*:
- Email: `vthang1510@quy-duy-tri.local` — email **giả**, không có thật, chỉ để Firebase có
  định danh. Phần trước `@` chính là username bạn sẽ gõ; phần sau phải khớp `LOGIN_EMAIL_DOMAIN`
  trong `js/config.js`.
- Password: **tự đặt một mật khẩu mạnh** — đây mới là bí mật thật. Đừng dùng lại mật khẩu ở đâu khác.

Tạo xong, copy **User UID** ở cột bên phải.

**4. Lấy cấu hình web.** ⚙ *Project settings* → mục *Your apps* → biểu tượng `</>` (Web) →
đặt nickname → Register app → copy khối `firebaseConfig` → dán các giá trị vào `js/config.js`.

> Mấy giá trị này an toàn khi để công khai trên GitHub. Chúng chỉ nói "database nào", không phải
> mật khẩu. Quyền ghi do Security Rules ở phía Google quyết định.

**5. Dán luật phân quyền.** Mở `firestore.rules`, thay `DÁN_OWNER_UID_VÀO_ĐÂY` bằng UID ở bước 3.
Rồi vào *Firestore Database → tab Rules*, xoá hết nội dung cũ, dán toàn bộ file vào, bấm **Publish**.

**6. Nạp dữ liệu.** Chạy trang ở máy (`python3 -m http.server 8000` trong thư mục này), mở
`http://localhost:8000/tools/import.html`, đăng nhập bằng username + mật khẩu vừa tạo, bấm nút.
Chạy **một lần duy nhất** — chạy lại sẽ ghi đè bằng dữ liệu trong `snapshot.json`.
Xong thì xoá thư mục `tools/` đi cũng được.

**7. Kiểm tra.** Mở `http://localhost:8000` — phải thấy đúng số liệu và đăng nhập được.

---

## Chạy thử ở máy

Trang dùng ES modules nên **không mở bằng cách bấm đúp vào `index.html`** (trình duyệt chặn vì
CORS với `file://`). Phải qua một server tĩnh:

```
cd quy-duy-tri-web
python3 -m http.server 8000
```

rồi mở `http://localhost:8000`.

**Lưu ý:** thêm `localhost` vào Firebase Console → *Authentication → Settings →
Authorized domains* nếu đăng nhập ở máy báo lỗi domain.

## Đưa lên GitHub Pages

```
git add . && git commit -m "..." && git push
```

**Settings → Pages** → Source chọn `main` / `(root)`. Link dạng `https://<user>.github.io/<repo>/`.

**Bắt buộc:** thêm domain đó vào Firebase Console → *Authentication → Settings →
Authorized domains*, nếu không sẽ không đăng nhập được từ trang thật.

---

## Dữ liệu — một nguồn sự thật duy nhất

Bốn collection trên Firestore:

| Collection | Nội dung |
|---|---|
| `members` | `{ name, sort_order }` |
| `periods` | `{ label, event_date, sort_order }` — `event_date` rỗng nghĩa là đợt chưa chốt ngày |
| `contributions` | id = `<memberId>__<periodId>`, `{ member_id, period_id, amount, joined }` |
| `expenses` | `{ spend_date, category, description, amount, sort_order }` |

**Không có số nào ghi cứng.** Mọi con số trên trang đều tính ra từ 4 collection trên:

- Đóng góp của một người = cộng `amount` của người đó
- Tổng thu = cộng toàn bộ `amount` &nbsp;·&nbsp; Tổng chi = cộng `expenses.amount`
- Chênh lệch = tổng thu + tổng chi
- Số buổi tham gia = đếm ô `joined = 'o'` trong các đợt đã có ngày
- Tab Điểm danh = chính cột `joined` đó, không phải bảng riêng

Nhờ vậy thêm/sửa/xoá ở bất kỳ tab nào thì tất cả các tab khác tự khớp theo.

Firestore không có khoá ngoại, nên khi xoá một người (hoặc một đợt), `dataStore.js` tự dọn luôn
các ô đóng góp liên quan trong cùng một batch.

## Sửa dữ liệu ngay trên trang

Sau khi đăng nhập:

- **Thu theo đợt** — gõ số tiền vào ô rồi bấm **Lưu** (ô chưa lưu có viền vàng; có nút *Huỷ thay đổi*).
  Ô Tham gia lưu ngay khi bấm. `+ Thêm người`, `+ Thêm đợt`; `×` cuối tên để xoá người;
  `⋯` trên đầu cột để đổi tên/ngày đợt hoặc xoá đợt (để trống tên rồi OK là xoá).
- **Chi tiêu** — `+ Thêm khoản chi`, sửa từng ô rồi bấm **Lưu**, `×` để xoá.
- **Điểm danh** — bấm o/x, cùng dữ liệu với cột Tham gia.
- **Đóng góp**, **Tổng quan** — chỉ xem, tự tính.

Đóng tab lúc còn thay đổi chưa lưu thì trình duyệt sẽ hỏi lại.

## Đăng nhập & bảo mật

Bạn gõ **username + mật khẩu**. Trang ghép thành `<username>@quy-duy-tri.local` rồi đưa cho
Firebase Auth — email thật của bạn không nằm ở đâu trong repo này, và mật khẩu cũng không
(chỉ bạn gõ vào).

Quyền ghi do `firestore.rules` quyết định ở phía Google: chỉ tài khoản có đúng UID mới
thêm/sửa/xoá được, ai cũng đọc được. Sửa code trong trình duyệt không vượt qua được luật này.

Đổi mật khẩu: Firebase Console → Authentication → Users → ba chấm cuối dòng → *Reset password*
(hoặc xoá user và tạo lại, rồi cập nhật UID mới trong `firestore.rules`).
