// Cấu hình Supabase (backend lưu dữ liệu chỉnh sửa trực tiếp: ai đóng tiền / ai tham gia).
// Anon/publishable key an toàn để lộ ra client — quyền ghi được chặn bằng Row Level Security
// ở phía Supabase, không phải bằng cách giấu key này.
//
// Lưu ý: email của tài khoản chủ trang KHÔNG được lưu ở đây (hay bất kỳ đâu trong code này) để
// tránh lộ trên GitHub — nó chỉ tồn tại trong policy phía Supabase (auth.js xác định quyền
// chỉnh sửa bằng cách "thăm dò" một request thật, xem server có cho ghi hay không).
export const SUPABASE_URL = 'https://prvcgymdhgxfkyzqwgrm.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBydmNneW1kaGd4Zmt5enF3Z3JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTA5MTUsImV4cCI6MjEwMzMyNjkxNX0.iWgkqXKQfmqMC5K9OBQvArS-ImWCxwtcam452LhW1E4';
