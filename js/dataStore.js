// LỚP DỮ LIỆU TRUNG TÂM — một nguồn sự thật duy nhất, lưu trên Cloud Firestore.
//
// Bốn collection:
//   members        { name, sort_order }
//   periods        { label, event_date ('YYYY-MM-DD' hoặc null), sort_order }
//   contributions  id = "<memberId>__<periodId>" · { member_id, period_id, amount, joined }
//   expenses       { spend_date, category, description, amount, sort_order }
//
// Mọi con số hiển thị đều TÍNH RA từ đây, không có số cứng:
//   Đóng góp của một người = cộng amount của người đó
//   Tổng thu = cộng toàn bộ amount · Tổng chi = cộng expenses.amount
//   Chênh lệch = tổng thu + tổng chi · Số buổi tham gia = đếm joined='o'
//   Tab Điểm danh = chính cột joined đó, không phải bảng riêng
// Nhờ vậy thêm/sửa/xoá ở tab nào thì mọi tab khác tự khớp theo.
//
// Các view không gọi Firestore trực tiếp — chỉ gọi hàm ở đây và đăng ký onChange.
import { getMods } from './firebase.js';
import { todayISO } from './utils.js';

let canEdit = false;
let usingFallback = false;

let members = [];      // [{id, name, sort_order}]         id là chuỗi
let periods = [];      // [{id, label, event_date, sort_order}]
let cells = {};        // "memberId:periodId" -> {amount, joined}
let expenses = [];     // [{id, spend_date, category, description, amount, sort_order}]

const listeners = [];
const deniedListeners = [];
let unsubscribers = [];

export function onChange(cb){ listeners.push(cb); }
export function onPermissionDenied(cb){ deniedListeners.push(cb); }
function emit(){ listeners.forEach(function(cb){ try{ cb(); }catch(e){ console.error(e); } }); }

export function setCanEdit(v){ canEdit = v; emit(); }
export function getCanEdit(){ return canEdit; }
export function isFallback(){ return usingFallback; }

// ---------- đọc ----------
export function getMembers(){ return members; }
export function getPeriods(){ return periods; }
export function getExpenses(){ return expenses; }

const key = function(mid, pid){ return mid + ':' + pid; };
const cellId = function(mid, pid){ return mid + '__' + pid; };

export function cellFor(mid, pid){
  return cells[key(mid, pid)] || { amount: null, joined: null };
}

// Ba cách gọi một đợt, đừng lẫn:
//   - có ngày        : đã chốt được ngày, kể cả ngày đó còn ở tương lai → dùng để vẽ biểu đồ,
//                      vì tiền của buổi sắp tới cũng đã thu rồi
//   - đã qua         : có ngày VÀ ngày đó không còn ở tương lai → dùng để đếm số buổi tham gia
//   - sắp tới        : chưa chốt ngày, hoặc ngày còn ở tương lai → tô màu riêng trong bảng
// Buổi chưa tới thì chưa ai đi được, nên không được tính vào mẫu số "x trên y buổi".
// Ngày diễn ra tính là đã qua ngay trong hôm đó: tiền thường thu ngay tối hôm nhậu.
export function isPast(p){
  return !!(p && p.event_date) && p.event_date <= todayISO();
}
export function isUpcoming(p){ return !isPast(p); }

// đợt đã chốt ngày, kể cả buổi sắp tới
export function datedPeriods(){
  return periods.filter(function(p){ return !!p.event_date; });
}

// chỉ những đợt đã qua
export function pastPeriods(){
  return periods.filter(isPast);
}

export function memberTotal(mid){
  return periods.reduce(function(s, p){
    const a = cellFor(mid, p.id).amount;
    return s + (typeof a === 'number' ? a : 0);
  }, 0);
}
export function periodTotal(pid){
  return members.reduce(function(s, m){
    const a = cellFor(m.id, pid).amount;
    return s + (typeof a === 'number' ? a : 0);
  }, 0);
}
export function periodJoinCount(pid){
  return members.reduce(function(s, m){ return s + (cellFor(m.id, pid).joined === 'o' ? 1 : 0); }, 0);
}
export function periodPaidCount(pid){
  return members.reduce(function(s, m){
    const a = cellFor(m.id, pid).amount;
    return s + (typeof a === 'number' && a > 0 ? 1 : 0);
  }, 0);
}
export function sessionsAttended(mid){
  return pastPeriods().reduce(function(s, p){ return s + (cellFor(mid, p.id).joined === 'o' ? 1 : 0); }, 0);
}
export function totalThu(){
  return members.reduce(function(s, m){ return s + memberTotal(m.id); }, 0);
}
export function totalChi(){
  return expenses.reduce(function(s, e){ return s + (Number(e.amount) || 0); }, 0);
}
export function netTotal(){ return totalThu() + totalChi(); }

// ---------- nạp dữ liệu ----------
function num(v){ return (v === null || v === undefined || v === '') ? null : Number(v); }
const bySort = function(a, b){ return (a.sort_order || 0) - (b.sort_order || 0); };

// Thứ tự hiển thị của đợt và khoản chi: MỚI NHẤT TRƯỚC.
//   - dòng chưa có ngày (đợt chưa chốt, khoản vừa thêm) đứng đầu, vì đó là thứ đang làm dở
//   - rồi tới ngày giảm dần ('YYYY-MM-DD' nên so chuỗi là đủ)
//   - cùng ngày thì cái thêm sau đứng trước
// Sắp ở đây một lần để mọi tab cùng một thứ tự; view không tự sắp lại.
function newestFirst(field){
  return function(a, b){
    const da = a[field] || '', db = b[field] || '';
    if(da !== db){
      if(!da) return -1;
      if(!db) return 1;
      return da < db ? 1 : -1;
    }
    return (b.sort_order || 0) - (a.sort_order || 0);
  };
}

function absorb(ms, ps, cs, es){
  members  = (ms || []).slice().sort(bySort);
  periods  = (ps || []).slice().sort(newestFirst('event_date'));
  expenses = (es || []).slice().sort(newestFirst('spend_date'));
  cells = {};
  (cs || []).forEach(function(c){
    cells[key(c.member_id, c.period_id)] = { amount: num(c.amount), joined: c.joined || null };
  });
  emit();
}

function docsToArray(snap){
  const out = [];
  snap.forEach(function(d){ out.push(Object.assign({ id: d.id }, d.data())); });
  return out;
}

export async function loadAll(){
  const m = getMods();
  if(!m) return false;
  try{
    const { getDocs, collection } = m.fs;
    const r = await Promise.all([
      getDocs(collection(m.db, 'members')),
      getDocs(collection(m.db, 'periods')),
      getDocs(collection(m.db, 'contributions')),
      getDocs(collection(m.db, 'expenses'))
    ]);
    usingFallback = false;
    absorb(docsToArray(r[0]), docsToArray(r[1]), docsToArray(r[2]), docsToArray(r[3]));
    return true;
  }catch(e){ console.error('Không tải được dữ liệu Firestore', e); return false; }
}

// Bản chụp tĩnh kèm theo trang — chỉ dùng khi chưa/không kết nối được Firestore.
export function loadFallback(snap){
  usingFallback = true;
  absorb(snap.members, snap.periods, snap.contributions, snap.expenses);
}

// Firestore đẩy thay đổi về ngay; nhưng không nạp đè khi đang có thứ gõ dở chưa lưu.
export function subscribeRealtime(){
  const m = getMods();
  if(!m || unsubscribers.length) return;
  const { onSnapshot, collection } = m.fs;
  ['members', 'periods', 'contributions', 'expenses'].forEach(function(name){
    unsubscribers.push(onSnapshot(collection(m.db, name), function(){
      if(!hasPending()) loadAll();
    }, function(err){ console.error('Realtime ' + name, err); }));
  });
}

// ---------- thay đổi chờ lưu ----------
// Những gì GÕ bằng bàn phím chỉ giữ tạm ở đây, chỉ ghi lên server khi bấm Lưu.
// Ngược lại, bấm ô o/x thì lưu ngay vì chỉ một cú chạm.
const dirtyCells = {};
const dirtyExpenses = {};

export function isCellDirty(mid, pid){ return !!dirtyCells[key(mid, pid)]; }
export function isExpenseDirty(id){ return !!dirtyExpenses[id]; }
export function pendingCount(){
  return Object.keys(dirtyCells).length + Object.keys(dirtyExpenses).length;
}
export function hasPending(){ return pendingCount() > 0; }

export function stageCell(mid, pid, patch){
  const cur = cellFor(mid, pid);
  cells[key(mid, pid)] = {
    amount: patch.hasOwnProperty('amount') ? patch.amount : cur.amount,
    joined: patch.hasOwnProperty('joined') ? patch.joined : cur.joined
  };
  dirtyCells[key(mid, pid)] = true;
  emit();
}

export function stageExpense(id, patch){
  const row = expenses.filter(function(e){ return e.id === id; })[0];
  if(!row) return;
  Object.assign(row, patch);
  dirtyExpenses[id] = true;
  emit();
}

// ---------- ghi ----------
// Nếu Firestore từ chối (hết quyền / mất phiên) thì quay về chế độ chỉ xem và nạp lại số thật.
function fail(err){
  console.error('Ghi thất bại', err);
  canEdit = false;
  deniedListeners.forEach(function(cb){ cb(); });
  return loadAll();
}

function guard(){ const m = getMods(); return (m && canEdit) ? m : null; }

export function saveAll(){
  const m = guard();
  if(!m || !hasPending()) return Promise.resolve(false);
  const { writeBatch, doc } = m.fs;
  const cellKeys = Object.keys(dirtyCells);
  const expIds = Object.keys(dirtyExpenses);

  const batch = writeBatch(m.db);
  cellKeys.forEach(function(k){
    const p = k.split(':');
    const c = cells[k] || { amount: null, joined: null };
    batch.set(doc(m.db, 'contributions', cellId(p[0], p[1])), {
      member_id: p[0], period_id: p[1], amount: c.amount, joined: c.joined
    });
  });
  expIds.forEach(function(id){
    const row = expenses.filter(function(e){ return e.id === id; })[0];
    if(!row) return;
    batch.update(doc(m.db, 'expenses', id), {
      spend_date: row.spend_date || null, category: row.category || '',
      description: row.description || '', amount: Number(row.amount) || 0
    });
  });

  return batch.commit().then(function(){
    cellKeys.forEach(function(k){ delete dirtyCells[k]; });
    expIds.forEach(function(id){ delete dirtyExpenses[id]; });
    emit();
    return true;
  }).catch(fail);
}

export function discardChanges(){
  Object.keys(dirtyCells).forEach(function(k){ delete dirtyCells[k]; });
  Object.keys(dirtyExpenses).forEach(function(k){ delete dirtyExpenses[k]; });
  return loadAll();
}

export function setCell(mid, pid, patch){
  const m = guard();
  const cur = cellFor(mid, pid);
  const next = {
    amount: patch.hasOwnProperty('amount') ? patch.amount : cur.amount,
    joined: patch.hasOwnProperty('joined') ? patch.joined : cur.joined
  };
  cells[key(mid, pid)] = next;
  emit();
  if(!m) return Promise.resolve(false);
  return m.fs.setDoc(m.fs.doc(m.db, 'contributions', cellId(mid, pid)), {
    member_id: mid, period_id: pid, amount: next.amount, joined: next.joined
  }).then(function(){
    // lần ghi này gửi cả số tiền đang chờ của chính ô đó, nên ô đó hết "chưa lưu"
    delete dirtyCells[key(mid, pid)];
    emit();
    return true;
  }).catch(fail);
}

export function cycleJoined(mid, pid){
  const cur = cellFor(mid, pid).joined;
  const next = cur === 'o' ? 'x' : (cur === 'x' ? null : 'o');
  return setCell(mid, pid, { joined: next });
}

function nextOrder(list){
  return list.length ? Math.max.apply(null, list.map(function(x){ return x.sort_order || 0; })) + 1 : 0;
}

export function addMember(name){
  const m = guard(); if(!m) return Promise.resolve(false);
  return m.fs.addDoc(m.fs.collection(m.db, 'members'), { name: name, sort_order: nextOrder(members) })
    .then(loadAll).catch(fail);
}
export function renameMember(id, name){
  const m = guard(); if(!m) return Promise.resolve(false);
  return m.fs.updateDoc(m.fs.doc(m.db, 'members', id), { name: name }).then(loadAll).catch(fail);
}
// Firestore không có khoá ngoại nên phải tự dọn các ô đóng góp của người/đợt bị xoá.
export function deleteMember(id){
  const m = guard(); if(!m) return Promise.resolve(false);
  const batch = m.fs.writeBatch(m.db);
  batch.delete(m.fs.doc(m.db, 'members', id));
  periods.forEach(function(p){ batch.delete(m.fs.doc(m.db, 'contributions', cellId(id, p.id))); });
  return batch.commit().then(loadAll).catch(fail);
}

export function addPeriod(label, date){
  const m = guard(); if(!m) return Promise.resolve(false);
  return m.fs.addDoc(m.fs.collection(m.db, 'periods'),
    { label: label, event_date: date || null, sort_order: nextOrder(periods) })
    .then(loadAll).catch(fail);
}
export function updatePeriod(id, patch){
  const m = guard(); if(!m) return Promise.resolve(false);
  return m.fs.updateDoc(m.fs.doc(m.db, 'periods', id), patch).then(loadAll).catch(fail);
}
export function deletePeriod(id){
  const m = guard(); if(!m) return Promise.resolve(false);
  const batch = m.fs.writeBatch(m.db);
  batch.delete(m.fs.doc(m.db, 'periods', id));
  members.forEach(function(mm){ batch.delete(m.fs.doc(m.db, 'contributions', cellId(mm.id, id))); });
  return batch.commit().then(loadAll).catch(fail);
}

export function addExpense(row){
  const m = guard(); if(!m) return Promise.resolve(false);
  return m.fs.addDoc(m.fs.collection(m.db, 'expenses'), {
    spend_date: row.spend_date || null, category: row.category || 'Chi Nhậu',
    description: row.description || '', amount: Number(row.amount) || 0,
    sort_order: nextOrder(expenses)
  }).then(loadAll).catch(fail);
}
export function updateExpense(id, patch){
  const m = guard(); if(!m) return Promise.resolve(false);
  return m.fs.updateDoc(m.fs.doc(m.db, 'expenses', id), patch).then(loadAll).catch(fail);
}
export function deleteExpense(id){
  const m = guard(); if(!m) return Promise.resolve(false);
  return m.fs.deleteDoc(m.fs.doc(m.db, 'expenses', id)).then(loadAll).catch(fail);
}
