// Xác thực + kết nối Supabase. Đây là module DUY NHẤT biết tới Supabase client —
// các phần khác của app chỉ nói chuyện qua dataStore.js.
//
// KHÔNG có email hay username thật nào được lưu trong code này (hay bất kỳ file nào trong repo
// GitHub). Người chỉnh sửa gõ username; trang gửi username đó lên một Edge Function trên
// Supabase — nơi DUY NHẤT biết username và email thật. Nếu đúng, function trả về một token
// dùng-một-lần, client đổi ngay sang phiên đăng nhập thật (verifyOtp) nên bật chỉnh sửa luôn,
// không phải mở email.
// Sau khi đăng nhập, trang xác định có được ghi hay không bằng cách "thăm dò" một lần ghi thật
// (xem probeEditPermission ở dưới), chứ không so sánh email ở phía client.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import {
  setSupabaseClient, setCanEdit, getCanEdit,
  loadAll, subscribeRealtime, onPermissionDenied
} from './dataStore.js';

const LOGIN_FUNCTION_URL = SUPABASE_URL + '/functions/v1/request-login-link';

let sb = null;
let realtimeSubscribed = false;

function setSyncStatus(status){
  // status: 'connecting' | 'editor' (chủ trang, ghi được) | 'viewer' (chỉ xem) | 'unavailable'
  const b = document.getElementById('syncBadge');
  if(b){
    if(status==='editor'){ b.className = 'sync-badge live'; b.innerHTML = '<span class="dot"></span>Đang lưu trực tiếp'; }
    else if(status==='viewer'){ b.className = 'sync-badge locked'; b.innerHTML = '🔒 Chỉ xem — bấm để đăng nhập'; }
    else if(status==='unavailable'){ b.className = 'sync-badge'; b.innerHTML = 'Chỉ xem (mất kết nối)'; }
    else { b.className = 'sync-badge connecting'; b.innerHTML = '<span class="dot"></span>Đang kết nối…'; }
  }
  const notes = [document.getElementById('fcEditNote'), document.getElementById('atEditNote')];
  const msg = status==='editor'
    ? '✎ Đã bật chỉnh sửa — bấm vào ô o / x bên dưới để đổi trạng thái.'
    : status==='viewer'
      ? '🔒 Chỉ chủ trang mới chỉnh sửa được — bấm nút góc trên để đăng nhập.'
      : status==='unavailable'
        ? 'Không kết nối được tới máy chủ dữ liệu — đang hiển thị bản dữ liệu tĩnh, chỉ xem.'
        : 'Đang kết nối để kiểm tra quyền chỉnh sửa…';
  notes.forEach(function(n){ if(n){ n.textContent = msg; n.className = 'edit-note' + (status==='editor' ? ' live' : ''); } });
}

// Không có email nào để so sánh ở đây — cách chắc chắn duy nhất để biết phiên đăng nhập hiện
// tại có quyền ghi hay không là thử ghi thật vào một hàng "thăm dò" (qdt_meta) và xem
// Supabase (Row Level Security) có thực sự cho ghi hay không.
function probeEditPermission(){
  if(!sb) return Promise.resolve(false);
  return sb.from('qdt_meta')
    .update({ probed_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .then(function(res){
      if(res.error) return false;
      return !!(res.data && res.data.length > 0);
    })
    .catch(function(){ return false; });
}

async function applySession(){
  const canEdit = await probeEditPermission();
  setCanEdit(canEdit);
  setSyncStatus(canEdit ? 'editor' : 'viewer');
}

function wireLoginBox(){
  const badge = document.getElementById('syncBadge');
  const box = document.getElementById('loginBox');
  const userInput = document.getElementById('loginUsername');
  const msg = document.getElementById('loginMsg');
  const sendBtn = document.getElementById('loginSendBtn');
  const cancelBtn = document.getElementById('loginCancelBtn');

  if(badge) badge.addEventListener('click', function(){
    if(getCanEdit()){ if(sb) sb.auth.signOut(); return; }
    if(box){ box.hidden = !box.hidden; if(!box.hidden && userInput) userInput.focus(); }
  });
  if(cancelBtn) cancelBtn.addEventListener('click', function(){ if(box) box.hidden = true; });
  function doLogin(){
    if(!userInput) return;
    const username = (userInput.value || '').trim();
    if(!username){ if(msg){ msg.textContent = 'Nhập username trước đã.'; msg.className = 'msg err'; } return; }
    if(!sb){ if(msg){ msg.textContent = 'Chưa kết nối được máy chủ, thử lại sau giây lát.'; msg.className = 'msg err'; } return; }

    sendBtn.disabled = true;
    if(msg){ msg.textContent = 'Đang kiểm tra…'; msg.className = 'msg'; }

    // Gửi username lên Edge Function (nơi duy nhất biết username/email thật).
    // Nếu đúng, function trả về một token dùng 1 lần; đổi ngay token đó lấy phiên đăng nhập
    // thật — không cần mở email, bật chỉnh sửa luôn.
    fetch(LOGIN_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ username: username })
    }).then(function(r){ return r.json(); }).then(function(res){
      if(!res || !res.ok || !res.token_hash){
        sendBtn.disabled = false;
        if(msg){ msg.textContent = 'Username không đúng.'; msg.className = 'msg err'; }
        return;
      }
      return sb.auth.verifyOtp({ token_hash: res.token_hash, type: 'magiclink' }).then(function(v){
        sendBtn.disabled = false;
        if(v && v.error){
          if(msg){ msg.textContent = 'Đăng nhập lỗi: ' + v.error.message; msg.className = 'msg err'; }
          return;
        }
        if(msg){ msg.textContent = 'Đã đăng nhập — bật chỉnh sửa.'; msg.className = 'msg ok'; }
        if(userInput) userInput.value = '';
        if(box) box.hidden = true;
        return applySession();
      });
    }).catch(function(err){
      sendBtn.disabled = false;
      if(msg){ msg.textContent = 'Lỗi: ' + (err && err.message ? err.message : err); msg.className = 'msg err'; }
    });
  }

  if(sendBtn) sendBtn.addEventListener('click', doLogin);
  // gõ xong bấm Enter là đăng nhập luôn, khỏi phải bấm nút
  if(userInput) userInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') doLogin(); });
}

export async function initAuth(){
  setSyncStatus('connecting');
  wireLoginBox();

  let createClient;
  try{
    ({ createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'));
  }catch(e){
    console.error('Không tải được thư viện Supabase', e);
    setSyncStatus('unavailable');
    return;
  }

  try{
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }catch(e){ sb = null; }
  if(!sb){ setSyncStatus('unavailable'); return; }

  setSupabaseClient(sb);
  onPermissionDenied(function(){ setSyncStatus('viewer'); });

  // nạp đè dữ liệu thật lên bản chụp tĩnh; nếu không tải được thì giữ bản tĩnh để vẫn xem được
  const ok = await loadAll();
  if(!ok){ setSyncStatus('unavailable'); return; }
  subscribeRealtime();

  await applySession();

  sb.auth.onAuthStateChange(function(event){
    applySession();
    if(event === 'SIGNED_IN'){
      const box = document.getElementById('loginBox');
      if(box) box.hidden = true;
    }
  });

  // dọn token đăng nhập khỏi thanh địa chỉ sau khi client đã đọc xong
  if(window.location.hash && window.location.hash.indexOf('access_token') > -1){
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
