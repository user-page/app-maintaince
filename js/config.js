// ============================================================================
//  CẤU HÌNH FIREBASE — dán thông tin dự án của bạn vào đây
// ============================================================================
//  Lấy ở đâu: Firebase Console → bánh răng ⚙ Project settings → mục "Your apps"
//  → chọn app Web (</>) → phần "SDK setup and configuration" → chọn "Config".
//
//  Các giá trị này AN TOÀN khi để lộ trên GitHub. Chúng chỉ nói "database nào",
//  không phải mật khẩu. Quyền ghi được chặn bằng Firestore Security Rules ở phía
//  Google (xem file firestore.rules) — không phải bằng cách giấu mấy dòng này.
// ============================================================================
export const FIREBASE_CONFIG = {
  apiKey: 'DÁN_API_KEY_VÀO_ĐÂY',
  authDomain: 'TEN-DU-AN.firebaseapp.com',
  projectId: 'TEN-DU-AN',
  storageBucket: 'TEN-DU-AN.firebasestorage.app',
  messagingSenderId: 'DÁN_SENDER_ID',
  appId: 'DÁN_APP_ID'
};

// Phiên bản thư viện Firebase nạp từ CDN của Google.
export const FIREBASE_VERSION = '12.19.0';

// Đăng nhập: bạn chỉ gõ username, trang tự ghép thành "<username>@<domain>" để đưa cho
// Firebase Auth. Đây là email GIẢ, không có thật, chỉ để Firebase có cái định danh —
// nên email thật của bạn không nằm ở đâu trong repo này. Bí mật thật là MẬT KHẨU.
export const LOGIN_EMAIL_DOMAIN = 'quy-duy-tri.local';
