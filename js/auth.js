// Đăng nhập + kết nối Firebase. Module này và firebase.js là nơi duy nhất "biết" Firebase —
// phần còn lại của app chỉ nói chuyện qua dataStore.js.
//
// Bạn gõ USERNAME + MẬT KHẨU. Trang ghép username thành "<username>@<domain giả>" rồi đưa cho
// Firebase Auth. Email thật của bạn KHÔNG nằm ở đâu trong repo này; bí mật thật là mật khẩu,
// và nó không bao giờ được lưu trong code — chỉ bạn gõ vào.
//
// Quyền ghi do Firestore Security Rules quyết định ở phía Google (xem firestore.rules),
// không phải do đoạn code này — nên có sửa code trong trình duyệt cũng không ghi được.
import { LOGIN_EMAIL_DOMAIN } from './config.js';
import { initFirebase, getMods } from './firebase.js';
import { setCanEdit, getCanEdit, loadAll, subscribeRealtime, onPermissionDenied, hasPending } from './dataStore.js';

function setSyncStatus(status){
  // 'connecting' | 'editor' (chủ trang, ghi được) | 'viewer' (chỉ xem) | 'unavailable'
  const b = document.getElementById('syncBadge');
  if(b){
    if(status === 'editor'){ b.className = 'sync-badge live'; b.innerHTML = '<span class="dot"></span>Đang lưu trực tiếp'; }
    else if(status === 'viewer'){ b.className = 'sync-badge locked'; b.innerHTML = '🔒 Chỉ xem — bấm để đăng nhập'; }
    else if(status === 'unavailable'){ b.className = 'sync-badge'; b.innerHTML = 'Chỉ xem (mất kết nối)'; }
    else { b.className = 'sync-badge connecting'; b.innerHTML = '<span class="dot"></span>Đang kết nối…'; }
  }
  const notes = [document.getElementById('fcEditNote'), document.getElementById('atEditNote')];
  const msg = status === 'editor'
    ? '✎ Đã bật chỉnh sửa — gõ số tiền rồi bấm Lưu; bấm ô o / x để đổi trạng thái tham gia.'
    : status === 'viewer'
      ? '🔒 Chỉ chủ trang mới chỉnh sửa được — bấm nút góc trên để đăng nhập.'
      : status === 'unavailable'
        ? 'Không kết nối được tới máy chủ dữ liệu — đang hiển thị bản dữ liệu tĩnh, chỉ xem.'
        : 'Đang kết nối để kiểm tra quyền chỉnh sửa…';
  notes.forEach(function(n){ if(n){ n.textContent = msg; n.className = 'edit-note' + (status === 'editor' ? ' live' : ''); } });
}

function wireLoginBox(){
  const badge = document.getElementById('syncBadge');
  const box = document.getElementById('loginBox');
  const userInput = document.getElementById('loginUsername');
  const passInput = document.getElementById('loginPassword');
  const msg = document.getElementById('loginMsg');
  const sendBtn = document.getElementById('loginSendBtn');
  const cancelBtn = document.getElementById('loginCancelBtn');

  if(badge) badge.addEventListener('click', function(){
    if(getCanEdit()){
      if(hasPending() && !confirm('Còn thay đổi chưa lưu. Đăng xuất và bỏ chúng?')) return;
      const m = getMods();
      if(m) m.fbAuth.signOut(m.auth);
      return;
    }
    if(box){ box.hidden = !box.hidden; if(!box.hidden && userInput) userInput.focus(); }
  });
  if(cancelBtn) cancelBtn.addEventListener('click', function(){ if(box) box.hidden = true; });

  function doLogin(){
    const m = getMods();
    const username = ((userInput && userInput.value) || '').trim().toLowerCase();
    const password = (passInput && passInput.value) || '';

    if(!username || !password){
      if(msg){ msg.textContent = 'Nhập cả username và mật khẩu.'; msg.className = 'msg err'; }
      return;
    }
    if(!m){
      if(msg){ msg.textContent = 'Chưa kết nối được máy chủ, thử lại sau giây lát.'; msg.className = 'msg err'; }
      return;
    }

    sendBtn.disabled = true;
    if(msg){ msg.textContent = 'Đang kiểm tra…'; msg.className = 'msg'; }

    m.fbAuth.signInWithEmailAndPassword(m.auth, username + '@' + LOGIN_EMAIL_DOMAIN, password)
      .then(function(){
        sendBtn.disabled = false;
        if(passInput) passInput.value = '';
        if(msg){ msg.textContent = 'Đã đăng nhập — bật chỉnh sửa.'; msg.className = 'msg ok'; }
        if(box) box.hidden = true;
      })
      .catch(function(err){
        sendBtn.disabled = false;
        const code = (err && err.code) || '';
        // Firebase gộp nhiều lỗi thành invalid-credential; không nói rõ sai cái nào,
        // vừa đúng thực tế vừa đỡ giúp người dò tìm.
        const text = (code.indexOf('invalid-credential') > -1 || code.indexOf('user-not-found') > -1 ||
                      code.indexOf('wrong-password') > -1 || code.indexOf('invalid-email') > -1)
          ? 'Username hoặc mật khẩu không đúng.'
          : (code.indexOf('too-many-requests') > -1
              ? 'Thử sai nhiều lần quá, Firebase tạm khoá. Đợi một lát rồi thử lại.'
              : 'Lỗi đăng nhập: ' + ((err && err.message) || code));
        if(msg){ msg.textContent = text; msg.className = 'msg err'; }
      });
  }

  if(sendBtn) sendBtn.addEventListener('click', doLogin);
  // Enter ở ô nào cũng đăng nhập luôn
  [userInput, passInput].forEach(function(inp){
    if(inp) inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); doLogin(); } });
  });
}

export async function initAuth(){
  setSyncStatus('connecting');
  wireLoginBox();

  let m;
  try{
    m = await initFirebase();
  }catch(e){
    console.error('Không nạp được thư viện Firebase', e);
    setSyncStatus('unavailable');
    return;
  }

  onPermissionDenied(function(){ setSyncStatus('viewer'); });

  // nạp đè dữ liệu thật lên bản chụp tĩnh; không được thì giữ bản tĩnh để vẫn xem được
  const ok = await loadAll();
  if(!ok){ setSyncStatus('unavailable'); return; }
  subscribeRealtime();

  // Firebase tự nhớ phiên đăng nhập, nên mở lại trang vẫn còn quyền sửa tới khi bấm đăng xuất.
  m.fbAuth.onAuthStateChanged(m.auth, function(user){
    const signedIn = !!user;
    setCanEdit(signedIn);
    setSyncStatus(signedIn ? 'editor' : 'viewer');
  });
}
