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

// Đăng nhập: bạn chỉ gõ username, trang tự ghép thành "<username>@<domain>" để đưa cho
// Firebase Auth. Đây là email GIẢ, không có thật, chỉ để Firebase có cái định danh —
// nên email thật của bạn không nằm ở đâu trong repo này. Bí mật thật là MẬT KHẨU.
export const LOGIN_EMAIL_DOMAIN = 'quy-duy-tri.local';
