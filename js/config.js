// ============================================================================
//  CẤU HÌNH FIREBASE — dự án maintaince-app-8107b
// ============================================================================
//  Lấy ở đâu (nếu sau này cần đổi): Firebase Console → bánh răng ⚙ Project settings
//  → mục "Your apps" → app Web (</>) → "SDK setup and configuration" → "Config".
//
//  Các giá trị này AN TOÀN khi để lộ trên GitHub. Chúng chỉ nói "database nào",
//  không phải mật khẩu. Quyền ghi được chặn bằng Firestore Security Rules ở phía
//  Google (xem file firestore.rules) — không phải bằng cách giấu mấy dòng này.
// ============================================================================
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCM3-zyxG3zW82k5zDO4IsnCOT8Vmp-B-o',
  authDomain: 'maintaince-app-8107b.firebaseapp.com',
  projectId: 'maintaince-app-8107b',
  storageBucket: 'maintaince-app-8107b.firebasestorage.app',
  messagingSenderId: '936482286012',
  appId: '1:936482286012:web:3fc22ab91dbe8d9629e3b9'
};
// Ghi chú: dự án có bật Google Analytics (measurementId G-MB55655WYP) nhưng trang này
// không nạp thư viện analytics — đỡ một request, và trang vốn không cần theo dõi gì.

// Phiên bản thư viện Firebase nạp từ CDN của Google.
export const FIREBASE_VERSION = '12.19.0';

// Đuôi mặc định khi bạn chỉ gõ username trống không.
export const LOGIN_EMAIL_DOMAIN = 'quy-duy-tri.local';

// Ô đăng nhập nhận CẢ HAI kiểu gõ:
//   - gõ trống không  ("abc")           -> ghép thành "abc@quy-duy-tri.local"
//   - gõ cả địa chỉ   ("abc@mail.com")  -> dùng nguyên như vậy
// Nhờ cách này, dùng địa chỉ email thật để đăng nhập vẫn được mà địa chỉ đó
// KHÔNG phải nằm trong file nào của repo — bạn gõ tay lúc đăng nhập thôi.
// Bí mật thật vẫn là MẬT KHẨU, không phải địa chỉ.
export function toLoginEmail(input){
  const s = String(input || '').trim().toLowerCase();
  return s.indexOf('@') > -1 ? s : s + '@' + LOGIN_EMAIL_DOMAIN;
}
