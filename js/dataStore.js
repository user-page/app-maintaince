// Lớp dữ liệu trung tâm: giữ dữ liệu tĩnh từ file gốc (fallback khi chưa/không kết nối được
// Supabase), dữ liệu "live" (đang chỉnh sửa trực tiếp), và logic ghi lên Supabase.
// Các view (collection.js, attendees.js) không gọi Supabase trực tiếp — chỉ gọi các hàm ở đây
// và đăng ký callback để tự vẽ lại khi dữ liệu đổi. auth.js là nơi duy nhất biết về Supabase client.
import { cycleStatus } from './utils.js';

// 5 đợt đầu lấy từ file Excel gốc (ô "Đóng" là số tiền, chỉ xem).
// Đợt thứ 6 là "buổi tới" — chưa có trong Excel, cả "Đóng" lẫn "Tham gia" đều nhập tay bằng o/x.
export const PAST_PERIODS = 5;
export const UPCOMING_IDX = 5;
export const PERIOD_COUNT = PAST_PERIODS + 1;

function blankPeriod(){ return { pay:null, join:null }; }

// Dữ liệu cũ trên Supabase chỉ có 5 đợt — đệm thêm cho đủ 6 để không bị undefined khi vẽ bảng.
function normalizePeriods(arr){
  const out = (Array.isArray(arr) ? arr.slice(0, PERIOD_COUNT) : [])
    .map(function(p){ return (p && typeof p === 'object') ? p : blankPeriod(); });
  while(out.length < PERIOD_COUNT) out.push(blankPeriod());
  return out;
}

let sheets = null;
const staticFcBySlug = {};
const staticAtBySlug = {};
let liveFC = null, liveAT = null;   // null = chưa tải xong, dùng tạm dữ liệu tĩnh
let canEdit = false;
let sbClient = null;
const fcWriteChain = {}, atWriteChain = {}; // hàng đợi ghi — mỗi người 1 lượt ghi tại 1 thời điểm

const fcListeners = [];
const atListeners = [];
const permissionDeniedListeners = [];

export function init(DATA){
  sheets = DATA;
  const fc = DATA.fund_collection, ea = DATA.event_attendees;
  fc.rows.forEach((r, i) => { staticFcBySlug[fc.slugs[i]] = r; });
  ea.rows.forEach((r, i) => { staticAtBySlug[ea.slugs[i]] = r; });
}

export function getSheets(){ return sheets; }

export function setSupabaseClient(client){ sbClient = client; }

export function setCanEdit(v){
  canEdit = v;
  fcListeners.forEach(cb => cb());
  atListeners.forEach(cb => cb());
}
export function getCanEdit(){ return canEdit; }

export function onFcChange(cb){ fcListeners.push(cb); }
export function onAtChange(cb){ atListeners.push(cb); }
export function onPermissionDenied(cb){ permissionDeniedListeners.push(cb); }

function staticFcPeriods(row){
  const arr = [];
  for(let c=0;c<PAST_PERIODS;c++){
    arr.push({ pay: row[2+c*2]===undefined?null:row[2+c*2], join: row[3+c*2]===undefined?null:row[3+c*2] });
  }
  return normalizePeriods(arr);   // thêm ô trống cho "buổi tới"
}
function staticAtSessions(row){
  const ea = sheets.event_attendees;
  return row.slice(2, 2 + (ea.headers.length - 2));
}

export function fcPeriodsFor(slug){
  if(liveFC && liveFC[slug] && liveFC[slug].periods) return normalizePeriods(liveFC[slug].periods);
  return staticFcPeriods(staticFcBySlug[slug] || []);
}
export function atSessionsFor(slug){
  if(liveAT && liveAT[slug] && liveAT[slug].sessions) return liveAT[slug].sessions;
  return staticAtSessions(staticAtBySlug[slug] || []);
}

export function bulkSetLiveFc(rows){
  liveFC = {};
  rows.forEach(r => { liveFC[r.slug] = { periods: normalizePeriods(r.periods) }; });
  fcListeners.forEach(cb => cb());
}
export function bulkSetLiveAt(rows){
  liveAT = {};
  rows.forEach(r => { liveAT[r.slug] = { sessions: r.sessions }; });
  atListeners.forEach(cb => cb());
}
export function setLiveFcRow(slug, periods){
  liveFC = liveFC || {};
  liveFC[slug] = { periods: normalizePeriods(periods) };
  fcListeners.forEach(cb => cb());
}
export function setLiveAtRow(slug, sessions){
  liveAT = liveAT || {};
  liveAT[slug] = { sessions };
  atListeners.forEach(cb => cb());
}

// field: 'join' (mặc định) hoặc 'pay'. Ô "Đóng" chỉ bật/tắt được ở đợt "buổi tới" —
// 5 đợt cũ giữ nguyên số tiền lấy từ file Excel, không cho sửa thành o/x.
export function toggleFc(slug, idx, field){
  if(!sbClient || !canEdit) return;
  const isPay = field === 'pay';
  if(isPay && idx !== UPCOMING_IDX) return;
  const periods = fcPeriodsFor(slug).slice();
  const cur = periods[idx] || blankPeriod();
  periods[idx] = isPay
    ? { pay: cycleStatus(cur.pay), join: cur.join }
    : { pay: cur.pay, join: cycleStatus(cur.join) };
  setLiveFcRow(slug, periods);       // cập nhật giao diện ngay (optimistic)
  queueWrite('fc', slug, { periods });
}
export function toggleAt(slug, idx){
  if(!sbClient || !canEdit) return;
  const sessions = atSessionsFor(slug).slice();
  sessions[idx] = cycleStatus(sessions[idx]);
  setLiveAtRow(slug, sessions);
  queueWrite('at', slug, { sessions });
}

function queueWrite(kind, slug, data){
  const chains = kind === 'fc' ? fcWriteChain : atWriteChain;
  const table = kind === 'fc' ? 'qdt_fund_collection' : 'qdt_attendees';
  const patch = kind === 'fc' ? { periods: data.periods } : { sessions: data.sessions };
  const prev = chains[slug] || Promise.resolve();
  chains[slug] = prev.then(function(){
    // .select() để nhận lại đúng hàng vừa ghi — nếu Row Level Security âm thầm chặn
    // (không phải lỗi, chỉ là 0 hàng khớp điều kiện), res.data sẽ rỗng, phải tự coi là thất bại.
    return sbClient.from(table).update(patch).eq('slug', slug).select().then(function(res){
      if(res.error) throw res.error;
      if(!res.data || res.data.length === 0) throw new Error('Ghi bị từ chối (không có quyền)');
    });
  }).catch(function(err){
    console.error('Lưu thất bại', kind, slug, err);
    // gần như chắc chắn là: không (còn) đăng nhập đúng tài khoản chủ trang — Supabase
    // (Row Level Security) từ chối ghi. Quay lại chế độ chỉ xem.
    canEdit = false;
    fcListeners.forEach(cb => cb());
    atListeners.forEach(cb => cb());
    permissionDeniedListeners.forEach(cb => cb());
  });
}
