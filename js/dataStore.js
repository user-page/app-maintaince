// LỚP DỮ LIỆU TRUNG TÂM — một nguồn sự thật duy nhất.
//
// Mọi thứ hiển thị trên trang đều TÍNH RA từ 4 bảng dưới đây, không có số cứng nào:
//   qdt_members        danh sách người
//   qdt_periods        các đợt thu / buổi
//   qdt_contributions  mỗi ô: người X ở đợt Y đóng bao nhiêu (amount) và có đi không (joined)
//   qdt_expenses       các khoản chi
//
// Nhờ vậy thêm/sửa/xoá ở bất kỳ tab nào thì tất cả các tab khác tự khớp theo:
// - Đóng góp của một người   = cộng amount của người đó
// - Tổng thu                 = cộng toàn bộ amount
// - Tổng chi                 = cộng toàn bộ qdt_expenses.amount
// - Chênh lệch               = tổng thu + tổng chi (chi là số âm)
// - Số buổi tham gia         = đếm số ô joined = 'o'
// - Điểm danh                = chính cột joined đó, không phải bảng riêng
//
// Các view không gọi Supabase trực tiếp — chỉ gọi hàm ở đây và đăng ký onChange để vẽ lại.

let sb = null;
let canEdit = false;
let usingFallback = false;

let members = [];      // [{id, name, sort_order}]
let periods = [];      // [{id, label, event_date, sort_order}]
let cells = {};        // "memberId:periodId" -> {amount, joined}
let expenses = [];     // [{id, spend_date, category, description, amount, sort_order}]

const listeners = [];
const deniedListeners = [];
let writeChain = Promise.resolve();

export function onChange(cb){ listeners.push(cb); }
export function onPermissionDenied(cb){ deniedListeners.push(cb); }
function emit(){ listeners.forEach(function(cb){ try{ cb(); }catch(e){ console.error(e); } }); }

export function setSupabaseClient(c){ sb = c; }
export function setCanEdit(v){ canEdit = v; emit(); }
export function getCanEdit(){ return canEdit; }
export function isFallback(){ return usingFallback; }

// ---------- đọc ----------
export function getMembers(){ return members; }
export function getPeriods(){ return periods; }
export function getExpenses(){ return expenses; }

const key = function(mid, pid){ return mid + ':' + pid; };

export function cellFor(mid, pid){
  return cells[key(mid, pid)] || { amount: null, joined: null };
}

// Đợt "đã diễn ra" = có ngày. Đợt chưa chốt ngày (Buổi tới) không tính vào số buổi tham gia.
export function pastPeriods(){
  return periods.filter(function(p){ return !!p.event_date; });
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

function absorb(ms, ps, cs, es){
  members  = (ms || []).slice().sort(function(a,b){ return a.sort_order - b.sort_order; });
  periods  = (ps || []).slice().sort(function(a,b){ return a.sort_order - b.sort_order; });
  expenses = (es || []).slice().sort(function(a,b){ return a.sort_order - b.sort_order; });
  cells = {};
  (cs || []).forEach(function(c){
    cells[key(c.member_id, c.period_id)] = { amount: num(c.amount), joined: c.joined || null };
  });
  emit();
}

export async function loadAll(){
  if(!sb) return false;
  try{
    const r = await Promise.all([
      sb.from('qdt_members').select('id,name,sort_order'),
      sb.from('qdt_periods').select('id,label,event_date,sort_order'),
      sb.from('qdt_contributions').select('member_id,period_id,amount,joined'),
      sb.from('qdt_expenses').select('id,spend_date,category,description,amount,sort_order')
    ]);
    if(r.some(function(x){ return x.error; })){
      console.error('Lỗi tải dữ liệu', r.map(function(x){ return x.error; }));
      return false;
    }
    usingFallback = false;
    absorb(r[0].data, r[1].data, r[2].data, r[3].data);
    return true;
  }catch(e){ console.error('Không tải được dữ liệu', e); return false; }
}

// Bản chụp tĩnh kèm theo trang — chỉ dùng khi không kết nối được Supabase, để trang vẫn xem được.
export function loadFallback(snap){
  usingFallback = true;
  absorb(snap.members, snap.periods, snap.contributions, snap.expenses);
}

// Không nạp đè khi đang có thay đổi chưa lưu — nếu không thì thứ vừa gõ bị mất trắng.
function reloadIfClean(){ if(!hasPending()) loadAll(); }

export function subscribeRealtime(){
  if(!sb) return;
  sb.channel('qdt-all')
    .on('postgres_changes', { event:'*', schema:'public', table:'qdt_members' }, reloadIfClean)
    .on('postgres_changes', { event:'*', schema:'public', table:'qdt_periods' }, reloadIfClean)
    .on('postgres_changes', { event:'*', schema:'public', table:'qdt_contributions' }, reloadIfClean)
    .on('postgres_changes', { event:'*', schema:'public', table:'qdt_expenses' }, reloadIfClean)
    .subscribe();
}

// ---------- thay đổi chờ lưu ----------
// Những gì GÕ bằng bàn phím (số tiền, ngày, nội dung khoản chi) chỉ được giữ tạm ở đây và
// chỉ ghi lên server khi bấm nút Lưu. Ngược lại, bấm ô o/x thì lưu ngay vì chỉ một cú chạm.
const dirtyCells = {};      // "mid:pid" -> true
const dirtyExpenses = {};   // id -> true

export function isCellDirty(mid, pid){ return !!dirtyCells[key(mid, pid)]; }
export function isExpenseDirty(id){ return !!dirtyExpenses[id]; }
export function pendingCount(){
  return Object.keys(dirtyCells).length + Object.keys(dirtyExpenses).length;
}
export function hasPending(){ return pendingCount() > 0; }

// Gõ số tiền vào một ô — chỉ đổi trong bộ nhớ, chưa ghi lên server.
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

export function saveAll(){
  if(!sb || !canEdit || !hasPending()) return Promise.resolve(false);
  const cellKeys = Object.keys(dirtyCells);
  const expIds = Object.keys(dirtyExpenses);

  const rows = cellKeys.map(function(k){
    const p = k.split(':');
    const c = cells[k] || { amount: null, joined: null };
    return { member_id: Number(p[0]), period_id: Number(p[1]),
             amount: c.amount, joined: c.joined, updated_at: new Date().toISOString() };
  });

  return run(function(){
    const jobs = [];
    if(rows.length) jobs.push(sb.from('qdt_contributions').upsert(rows, { onConflict: 'member_id,period_id' }));
    expIds.forEach(function(id){
      const row = expenses.filter(function(e){ return e.id === Number(id); })[0];
      if(!row) return;
      jobs.push(sb.from('qdt_expenses').update({
        spend_date: row.spend_date || null, category: row.category || '',
        description: row.description || '', amount: Number(row.amount) || 0
      }).eq('id', Number(id)));
    });
    return Promise.all(jobs).then(function(res){
      const bad = res.filter(function(x){ return x && x.error; })[0];
      return bad || { error: null };
    });
  }).then(function(ok){
    if(ok){
      cellKeys.forEach(function(k){ delete dirtyCells[k]; });
      expIds.forEach(function(id){ delete dirtyExpenses[id]; });
      emit();
    }
    return ok;
  });
}

export function discardChanges(){
  Object.keys(dirtyCells).forEach(function(k){ delete dirtyCells[k]; });
  Object.keys(dirtyExpenses).forEach(function(k){ delete dirtyExpenses[k]; });
  return loadAll();
}

// ---------- ghi ----------
// Mọi thao tác ghi đi qua một hàng đợi: cập nhật giao diện ngay (optimistic), nếu server từ chối
// thì nạp lại dữ liệu thật và chuyển về chế độ chỉ xem.
function run(fn){
  if(!sb || !canEdit) return Promise.resolve(false);
  writeChain = writeChain.then(fn).then(function(res){
    if(res && res.error) throw res.error;
    return true;
  }).catch(function(err){
    console.error('Ghi thất bại', err);
    canEdit = false;
    deniedListeners.forEach(function(cb){ cb(); });
    return loadAll();
  });
  return writeChain;
}

export function setCell(mid, pid, patch){
  const cur = cellFor(mid, pid);
  const next = {
    amount: patch.hasOwnProperty('amount') ? patch.amount : cur.amount,
    joined: patch.hasOwnProperty('joined') ? patch.joined : cur.joined
  };
  cells[key(mid, pid)] = next;
  emit();
  return run(function(){
    return sb.from('qdt_contributions')
      .upsert({ member_id: mid, period_id: pid, amount: next.amount, joined: next.joined,
                updated_at: new Date().toISOString() },
              { onConflict: 'member_id,period_id' });
  }).then(function(ok){
    // lần ghi này gửi cả số tiền đang chờ của chính ô đó, nên ô đó hết "chưa lưu"
    if(ok){ delete dirtyCells[key(mid, pid)]; emit(); }
    return ok;
  });
}

export function cycleJoined(mid, pid){
  const cur = cellFor(mid, pid).joined;
  const next = cur === 'o' ? 'x' : (cur === 'x' ? null : 'o');
  return setCell(mid, pid, { joined: next });
}

export function addMember(name){
  const order = members.length ? Math.max.apply(null, members.map(function(m){ return m.sort_order; })) + 1 : 0;
  return run(function(){ return sb.from('qdt_members').insert({ name: name, sort_order: order }); })
    .then(loadAll);
}
export function renameMember(id, name){
  return run(function(){ return sb.from('qdt_members').update({ name: name }).eq('id', id); }).then(loadAll);
}
export function deleteMember(id){
  return run(function(){ return sb.from('qdt_members').delete().eq('id', id); }).then(loadAll);
}

export function addPeriod(label, date){
  const order = periods.length ? Math.max.apply(null, periods.map(function(p){ return p.sort_order; })) + 1 : 0;
  return run(function(){
    return sb.from('qdt_periods').insert({ label: label, event_date: date || null, sort_order: order });
  }).then(loadAll);
}
export function updatePeriod(id, patch){
  return run(function(){ return sb.from('qdt_periods').update(patch).eq('id', id); }).then(loadAll);
}
export function deletePeriod(id){
  return run(function(){ return sb.from('qdt_periods').delete().eq('id', id); }).then(loadAll);
}

export function addExpense(row){
  const order = expenses.length ? Math.max.apply(null, expenses.map(function(e){ return e.sort_order; })) + 1 : 0;
  return run(function(){
    return sb.from('qdt_expenses').insert({
      spend_date: row.spend_date || null, category: row.category || 'Chi Nhậu',
      description: row.description || '', amount: Number(row.amount) || 0, sort_order: order });
  }).then(loadAll);
}
export function updateExpense(id, patch){
  return run(function(){ return sb.from('qdt_expenses').update(patch).eq('id', id); }).then(loadAll);
}
export function deleteExpense(id){
  return run(function(){ return sb.from('qdt_expenses').delete().eq('id', id); }).then(loadAll);
}
