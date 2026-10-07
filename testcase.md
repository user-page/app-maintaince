# Testcase — Quỹ Duy Trì

Chạy hết danh sách này **trước khi push** mỗi lần sửa. Chưa pass thì chưa đẩy lên.

Ký hiệu: ✅ pass · ❌ fail · ⬜ chưa chạy. Cột cuối để ghi ngày chạy gần nhất.

Đa số test chạy tay trên trình duyệt, khoảng 10–15 phút. Những test có dấu 🤖 là loại nên
viết script tự động nếu sau này dự án lớn hơn.

---

## A. Bất biến — luôn phải đúng, dù dữ liệu thay đổi thế nào

Đây là nhóm quan trọng nhất. Mọi con số trên trang đều phải tính ra từ dữ liệu, không được
hardcode ở đâu. Nếu một trong các test này fail thì có chỗ nào đó đang giữ số cũ.

| # | Kiểm tra | Kỳ vọng |
|---|---|---|
| A1 | Tổng quan: Chênh lệch | Đúng bằng Tổng thu + Tổng chi (tổng chi là số âm) |
| A2 | Cộng tay cột "Tổng" của tất cả các đợt ở tab Thu theo đợt | Bằng Tổng thu trên Tổng quan |
| A3 | Cộng tay cột tiền ở tab Chi tiêu | Bằng Tổng chi trên Tổng quan |
| A4 | Cộng tay cột "Tổng" từng người ở tab Đóng góp | Cũng bằng Tổng thu |
| A5 | Số buổi tham gia của một người bất kỳ | Không lớn hơn số "Đợt đã diễn ra" trên Tổng quan |
| A6 | Số buổi ở tab Tổng quan so với số dấu `o` của người đó ở tab Thu theo đợt | Bằng nhau, trên các đợt có ngày |
| A7 | Tab Điểm danh và tab Thu theo đợt | Cùng một người, cùng một đợt phải cho cùng kết quả — hai tab đọc chung một nguồn |
| A8 | Ô tiền để trống | Tính là 0, không phải `NaN`, và không làm hỏng dòng tổng |
| A9 | Đổi một ô tiền rồi lưu | Tất cả các tổng liên quan (đợt, người, Tổng quan) đổi theo ngay, không cần tải lại trang |

> Quy ước đang dùng: **đợt "đã diễn ra" = đợt có ngày**. Đợt chưa chốt ngày (Buổi tới) không
> tính vào số buổi tham gia. Lưu ý Đợt 6 có ngày 11/10/2026 nên nó *đang được tính*, kể cả khi
> ngày đó chưa tới. Nếu muốn chỉ tính đợt đã qua thật thì phải sửa `pastPeriods()` trong
> `js/dataStore.js` và cập nhật lại test A5, A6.

---

## B. Số liệu mốc — chỉ dùng ngay sau khi nạp dữ liệu lần đầu

Sau khi chạy `tools/import.html`, các con số phải đúng y như dưới. Về sau nhóm thêm bớt dữ
liệu thì bảng này hết dùng được — lúc đó chỉ còn nhóm A là bất biến.

| # | Chỗ xem | Giá trị đúng |
|---|---|---|
| B1 | Dòng log cuối của trang import | `XONG — đã ghi 122 bản ghi.` |
| B2 | Tổng quan · Tổng thu | 18.600 |
| B3 | Tổng quan · Tổng chi | −18.021 |
| B4 | Tổng quan · Chênh lệch | 579 |
| B5 | Tổng quan · Thành viên | 17 |
| B6 | Tổng quan · Đợt đã diễn ra | 6 |
| B7 | Tổng quan · Khoản chi | 10 |
| B8 | Firestore Console | Đúng 4 collection: `members`, `periods`, `contributions`, `expenses` |
| B9 | Số document trong `contributions` | 89 |

---

## C. Thêm / sửa / xoá — mọi tab phải đồng bộ

Một nguồn sự thật duy nhất. Mỗi test dưới đây làm xong phải **kiểm tra lại cả 5 tab**:
Tổng quan · Thu theo đợt · Chi tiêu · Đóng góp · Điểm danh.

| # | Thao tác | Kỳ vọng |
|---|---|---|
| C1 | Thêm một người mới | Hiện ở Thu theo đợt, Đóng góp, Điểm danh; Tổng quan tăng số Thành viên lên 1; các ô tiền của người đó trống chứ không phải 0 |
| C2 | Đổi tên một người | Tên mới hiện ở cả 5 tab, không chỗ nào còn tên cũ |
| C3 | **Xoá một người** | Biến mất ở cả 5 tab, Tổng thu giảm đúng bằng tổng tiền người đó từng đóng, và **không còn ô mồ côi** trong `contributions` (kiểm tra ở Firestore Console: số document giảm đúng bằng số đợt) |
| C4 | Thêm một đợt mới | Thành cột mới ở Thu theo đợt và Điểm danh; nếu đợt có ngày thì Tổng quan tăng "Đợt đã diễn ra" |
| C5 | **Xoá một đợt** | Cột biến mất, Tổng thu giảm đúng bằng tổng đợt đó, và các ô `contributions` của đợt đó bị xoá theo |
| C6 | Thêm một khoản chi | Hiện ở tab Chi tiêu, Tổng chi và Chênh lệch đổi theo ngay |
| C7 | Xoá một khoản chi | Ngược lại của C6 |
| C8 | Sau mỗi test C1–C7, **tải lại trang** | Dữ liệu vẫn y nguyên — nghĩa là đã ghi thật xuống Firestore chứ không chỉ đổi trên màn hình |

> Firestore không có khoá ngoại. C3 và C5 là hai test dễ fail nhất, vì phải tự xoá tay các ô
> liên quan bằng `writeBatch` ở phía client. Đừng bỏ qua phần kiểm tra trên Console.

---

## D. Nhập liệu, nút Lưu, nút Huỷ

| # | Thao tác | Kỳ vọng |
|---|---|---|
| D1 | Gõ số vào một ô tiền | Ô hiện viền vàng (chưa lưu); nút đổi thành `💾 Lưu N thay đổi` với N đúng |
| D2 | Gõ xong rồi **tải lại trang mà chưa bấm Lưu** | Trình duyệt hỏi xác nhận trước khi rời trang; thoát rồi thì số gõ dở mất, dữ liệu cũ còn nguyên |
| D3 | Bấm **Lưu** | Viền vàng mất, nút đổi thành `💾 Đã lưu`; tải lại trang số vẫn còn |
| D4 | Bấm **Huỷ thay đổi** | Mọi ô quay về giá trị cũ, không ô nào còn viền vàng |
| D5 | Bấm ô `o`/`x` ở cột điểm danh | Lưu **ngay**, không cần bấm Lưu — vì chỉ một cú chạm |
| D6 | Gõ số rồi nhấn `Tab` sang ô kế | Con trỏ sang đúng ô kế tiếp, **không nhảy về đầu bảng**; số vừa gõ vẫn còn viền vàng |
| D7 | Ô tiền | Không có nút mũi tên tăng/giảm; gõ chữ cái thì không nhận |
| D8 | Đang gõ dở mà có người khác sửa dữ liệu | Bảng **không** tự tải lại đè lên thứ đang gõ |
| D11 | Ô ngày ở tab Chi tiêu | Là **nút bấm mở lịch**, không phải ô gõ ngày. Không còn `<input type="date">` ở đâu |
| D12 | Chọn ngày trong lịch bật ra | Ô đổi sang ngày mới + viền vàng, nút Lưu đếm thêm 1; chỉ ghi xuống server khi bấm Lưu |
| D13 | Lịch bật ra | Esc đóng, bấm ra ngoài đóng, cuộn trang thì lịch đi theo ô của nó; luôn nằm gọn trong màn hình |

> D6 từng hỏng: `Tab` chuyển focus trước khi sự kiện `change` chạy, nên bảng vẽ lại và mất con
> trỏ. Chỗ sửa là `keepFocus()` trong `js/utils.js`.

---

## E. Đăng nhập và phân quyền

| # | Trạng thái | Kỳ vọng |
|---|---|---|
| E1 | Chưa đăng nhập | Badge ghi `🔒 Chỉ xem — bấm để đăng nhập`; mọi ô tiền, ô `o`/`x`, nút thêm/xoá đều **không bấm được** |
| E2 | Đăng nhập đúng | Badge đổi thành `Đang lưu trực tiếp`, các nút mở khoá |
| E3 | Sai mật khẩu | Báo `Tên đăng nhập hoặc mật khẩu không đúng.` — **không** được lộ là tài khoản có tồn tại hay không |
| E4 | Sai tên đăng nhập | Cùng một câu báo lỗi như E3, không khác chữ nào |
| E5 | Đăng xuất | Badge về trạng thái chỉ xem, mọi nút khoá lại ngay, không cần tải lại trang |
| E6 | Chặn mạng tới `gstatic.com` rồi mở trang | Badge ghi `Chỉ xem (mất kết nối)`, trang vẫn hiện số liệu tĩnh từ `data/snapshot.json`, không trắng trang 🤖 |
| E7 | Đăng nhập rồi, nhưng rules chặn | Hiện thông báo lỗi rõ ràng, không im lặng nuốt lỗi |
| E8 | Gõ **cả địa chỉ email** vào ô tên đăng nhập | Đăng nhập được — trang dùng nguyên địa chỉ đó, không ghép thêm đuôi |
| E9 | Gõ **username trống không** (không có `@`) | Trang tự ghép đuôi `LOGIN_EMAIL_DOMAIN` trong `js/config.js` rồi mới gửi đi |
| E10 | Gõ email lẫn chữ hoa và thừa khoảng trắng hai đầu | Vẫn đăng nhập được — trang tự cắt khoảng trắng và đổi về chữ thường |

> E3 và E4 phải giống nhau **từng chữ**. Khác nhau là lộ tài khoản nào có thật.
>
> E8–E10 tồn tại để địa chỉ email đăng nhập **không phải nằm trong file nào của repo**: chủ trang
> gõ tay lúc đăng nhập. Đừng "tiện tay" điền địa chỉ thật vào `LOGIN_EMAIL_DOMAIN` hay bất kỳ
> file nào — repo này public.

---

## F. Bảo mật — soát lại mỗi lần đổi cấu hình hoặc trước khi public

| # | Kiểm tra | Cách làm | Kỳ vọng |
|---|---|---|---|
| F1 | Email thật không có trong repo, kể cả lịch sử | `git log --all -S'<địa chỉ email thật>' --oneline` | Không commit nào |
| F2 | Username và email đăng nhập không có trong **mã nguồn hiện tại** | `git grep -n '<username>'` | Không kết quả |
| F3 | Không có mật khẩu, token, service-account key nào bị commit | `git grep -nE 'password\s*=\|BEGIN PRIVATE KEY\|service_account'` | Không kết quả |
| F4 | Firestore rules còn đúng | Mở Console → Firestore → Rules | `allow write` chỉ cho đúng UID chủ trang; có dòng `match /{document=**} { allow read, write: if false; }` ở cuối |
| F5 | Không ai tự đăng ký tài khoản được | Console → Authentication → Settings → User actions | *Enable create (sign-up)* đang **tắt** |
| F6 | `tools/` đã xoá sau khi nạp xong | `ls tools/` | Không còn thư mục |
| F7 | Ghi mà không đăng nhập | Mở Console trình duyệt khi chưa đăng nhập, thử gọi hàm ghi | Bị Firestore từ chối với `permission-denied` |

> Hai điều cố ý và **không** phải lỗi: khối `FIREBASE_CONFIG` trong `js/config.js` để công khai
> là bình thường (nó chỉ định danh database, không phải mật khẩu), và `allow read: if true`
> nghĩa là dữ liệu quỹ ai cũng đọc được — đúng thiết kế của một trang public. Muốn kín thì phải
> đổi sang `allow read: if request.auth != null` và cả nhóm phải có tài khoản.

---

## G. Giao diện

| # | Kiểm tra | Kỳ vọng |
|---|---|---|
| G1 | Mở ở màn hình điện thoại (rộng 390px) | **Không trượt ngang** toàn trang; bảng rộng thì tự nó cuộn ngang trong khung của nó |
| G2 | Biểu đồ cột ở Tổng quan | Các cột có hiện màu, không phải khung rỗng |
| G3 | Số cột ở bảng điểm danh | Khớp với số đợt — đếm đúng, không lẫn hai cột "No" và "Người" |
| G4 | Chế độ tối của hệ điều hành | Chữ vẫn đọc được, không chỗ nào chữ trắng trên nền trắng |
| G5 | Số tiền | Hiển thị có dấu chấm phân cách nghìn, số âm có dấu trừ rõ ràng |
| G6 | Chuyển qua lại giữa 5 tab | Không lỗi JS trong Console (mở `⌥⌘I`) |
| G7 | Thứ tự cột đợt ở tab Thu theo đợt và tab Điểm danh | **Mới nhất bên trái**: Đợt 6, Đợt 5, … Đợt 1. Đợt chưa chốt ngày đứng trước tất cả. Hai tab cùng một thứ tự |
| G8 | Thứ tự dòng ở tab Chi tiêu | Ngày giảm dần; khoản vừa thêm nằm trên cùng |
| G9 | Biểu đồ ở Tổng quan | Vẫn đọc trái → phải theo thời gian, cũ → mới |
| G10 | Sau khi đảo thứ tự, dòng "Tổng" dưới bảng | Tổng của cột nào vẫn nằm đúng dưới cột đó — đối chiếu một đợt bất kỳ bằng cách cộng tay |
| G11 | Thêm / sửa người, đợt, khoản chi | Mở **hộp thoại trong trang**, không phải hộp thoại xám của trình duyệt. Không nơi nào còn dùng `prompt()` / `confirm()` |
| G12 | Hộp thoại | Esc đóng · bấm ra nền tối đóng · con trỏ bàn phím không ra khỏi hộp thoại · trên điện thoại nằm gọn trong màn hình |
| G13 | Lịch chọn ngày | Tuần bắt đầu từ T2 · hôm nay có viền · ngày đang chọn tô đậm · luôn 6 tuần nên không nhảy chiều cao khi đổi tháng · mũi tên và PageUp/PageDown đi được bằng bàn phím |
| G14 | Bỏ trống mục bắt buộc rồi bấm Lưu | Hộp thoại **không** đóng, mục thiếu viền đỏ kèm dòng báo lỗi; gõ vào là lỗi biến mất ngay |
| G15 | Nút xoá trong hộp thoại sửa | Hỏi lại ngay trong hộp thoại đó, con trỏ mặc định ở "Quay lại" — nhấn Enter nhầm không xoá mất gì |
| G16 | Ô nhập trong hộp thoại trên iPhone | Cỡ chữ 16px, chạm vào không bị tự phóng to trang |
| G17 | Tab Tổng quan | Tổng thu · Tổng chi · Chênh lệch **chỉ xuất hiện một lần**, ở dải chỉ số đầu trang. Không có thẻ nào lặp lại ba con số đó |
| G18 | Ô "Chênh lệch" ở dải chỉ số | Đứng đầu, có nền khác năm ô còn lại, số to hơn |
| G19 | Bảng Thu theo đợt và Điểm danh | Cuộn xuống: hàng tiêu đề và hàng Tổng vẫn dính. Cuộn sang phải: cột tên vẫn dính trái |
| G20 | Hàng tiêu đề thứ hai (Đóng · Tham gia) | Dính ngay dưới hàng tên đợt, không chồng lên và không hở — kể cả khi đổi cỡ chữ |
| G21 | Khối "Ai đi những buổi nào" | Mỗi người một dãy ô, mỗi ô là một buổi, cũ nhất bên trái; ô đậm = có mặt |
| G22 | Biểu đồ trên điện thoại | Chữ vẫn đọc được, cuộn ngang trong khung của nó chứ không bị thu nhỏ |
| G23 | Ô tiền trong bảng | Rộng 78px trên máy tính, 62px trên điện thoại — không bị `min-width` của ô chữ nong ra 90px |

> G1 từng lỗi 6px vì `nav.tabs` có margin âm không khớp padding của `body` ở màn hình nhỏ.
> G3 từng đếm thừa 2 vì lấy thẳng `headers.length`.
>
> Thứ tự "mới nhất trước" được sắp **một lần** trong `absorb()` của `js/dataStore.js`, theo ngày chứ
> không theo thứ tự nhập. Các view không tự sắp lại; riêng biểu đồ cố ý đảo về cũ → mới.
>
> Hàng tiêu đề thứ hai ghim bằng biến `--head1`, do `pinHeaderRows()` trong `js/utils.js` đo
> chiều cao hàng đầu rồi gán. Đừng thay bằng số cứng trong CSS — chiều cao đó đổi theo cỡ chữ
> và theo việc nhãn có xuống dòng hay không.
>
> Hộp thoại nằm ở `js/dialog.js` (`openForm`, `confirmDialog`), lịch ở `js/datepicker.js`
> (`buildCalendar` dùng trong hộp thoại, `openDatePopover` bật ra cạnh ô trong bảng).
> `todayISO()` lấy ngày theo giờ máy — đừng quay lại dùng `toISOString()`, nó tính theo UTC nên
> ở Việt Nam trước 7 giờ sáng sẽ ra ngày hôm qua.

---

## H. Triển khai

Chỉ chạy khối lệnh này **sau khi** các nhóm liên quan ở trên đã pass hết.

```bash
cd "/Users/macbookpro/Claude Code/App_Maintaince/quy-duy-tri-web"

# 1. xem mình sắp đưa cái gì lên — đọc kỹ, đừng add mù
git status
git diff

# 2. đóng gói
git add -A
git commit -m "<một câu tả việc vừa sửa>"

# 3. xem lại lần cuối rồi mới đẩy
git log --oneline origin/main..HEAD
git push
```

Đang đứng sẵn trong thư mục rồi thì bỏ dòng `cd` đi. Đứng ở thư mục con nào đó bên trong dự án
thì dùng `cd "$(git rev-parse --show-toplevel)"` — nó tự tìm về gốc repo, khỏi phụ thuộc đường dẫn.

Dùng `git add -A` chứ đừng dùng `git add .` — `-A` bắt được cả file bị xoá, `.` thì không.
Đợt bỏ `tools/` sau này sẽ thấy rõ khác biệt.

Nếu đẩy nhầm và trang thật hỏng, **đừng sửa vội trong hoảng loạn** — quay về bản tốt trước đã,
sửa sau:

```bash
git revert HEAD      # tạo commit mới đảo ngược commit vừa rồi, không xoá lịch sử
git push
```

| # | Bước | Cách làm | Kỳ vọng |
|---|---|---|---|
| H1 | Soát trước khi commit | `git status` và `git diff` | Chỉ thấy đúng những file mình cố ý sửa |
| H2 | Soát trước khi push | `git log --oneline origin/main..HEAD` | Đúng số commit mình định đẩy, không dính commit lạ |
| H3 | Đợi build | Tab Actions của repo | `pages-build-deployment` xanh (3–7 phút) |
| H4 | Kiểm tra bản trên server đã mới chưa | Trong Console trình duyệt: `fetch('js/dataStore.js',{cache:'reload'}).then(r=>r.headers.get('last-modified')).then(console.log)` | Giờ phải là sau lúc push |
| H5 | Nghiệm thu trên trang thật | Chạy lại nhóm A và E | Pass hết |

> **Đừng tin vào việc thêm `?v=2` vào URL.** Nó chỉ làm mới `index.html`; các file trong `js/`
> được module loader nạp riêng và vẫn lấy từ cache. Dùng tab Network → tick *Disable cache*,
> hoặc cửa sổ ẩn danh. Nhiều lần tưởng lỗi code hoá ra chỉ là cache hoặc Pages chưa build xong —
> H4 là cách phân biệt chắc chắn.

---

## Mức ưu tiên khi không đủ thời gian

Sửa nhỏ, chỉ đụng giao diện một tab: chạy **A1–A4, G6**, rồi H.

Sửa đụng `dataStore.js` hoặc `auth.js`: chạy **toàn bộ A, C, D, E**.

Đổi cấu hình Firebase, đổi rules, đổi tài khoản: chạy **toàn bộ E và F**.

Trước khi chia sẻ link cho người ngoài nhóm: chạy **toàn bộ F**.
