// Tab "Chưa đóng" — danh sách để đi nhắc tiền. CHỈ XEM, hoàn toàn tính ra từ bảng Thu theo đợt.
//
// Điểm mấu chốt: KHÔNG lấy "ô tiền trống" làm danh sách nợ. Ô trống có ba nguyên nhân khác
// hẳn nhau — đi rồi mà chưa đóng, vắng mặt, và buổi chưa điểm danh — nên phải ghép cột
// Tham gia vào mới phán được. Phép phán định nằm ở payStatus() trong dataStore.js:
//
//   còn nợ   (o, chưa có tiền)  → người cần nhắc, đây là danh sách chính
//   chưa rõ  (chưa điểm danh)   → buổi chưa ghi o/x nên chưa kết luận được
//   vắng     (x, chưa có tiền)  → để riêng, KHÔNG cộng vào nợ, vì sổ vẫn có người vắng mà đóng
//
// Sửa một ô tiền hay bấm một ô o/x ở tab Thu theo đợt là tab này đổi ngay.
// Đợt chưa tới ngày vẫn tính, vì tiền của buổi tới thường thu trước.
import { el, esc, fmt, fmtDate } from '../utils.js';
import {
  getMembers, getPeriods, periodTotal, periodPaidCount, memberTotal,
  periodByStatus, memberByStatus, countByStatus, isUpcoming, onChange
} from '../dataStore.js';

let statHost = null, periodHost = null, tableHost = null;

const COLS = [
  { key: 'name',    label: 'Người',        type: 'text', sortable: true },
  { key: 'owed',    label: 'Còn nợ',       type: 'num',  sortable: true },
  { key: 'list',    label: 'Đợt còn nợ',   type: 'text', sortable: false },
  { key: 'unknown', label: 'Chưa rõ',      type: 'num',  sortable: true },
  { key: 'total',   label: 'Tổng đã đóng', type: 'num',  sortable: true }
];
// Mặc định: ai còn nợ nhiều đợt nhất lên đầu — đó là người cần nhắc trước.
// Để biến ngoài render() vì render() chạy lại mỗi lần dữ liệu đổi; để bên trong thì
// cứ sửa một ô tiền là bảng nhảy về cách sắp mặc định.
let sortKey = 'owed', sortDir = -1;   // -1 = cao xuống thấp

export function buildUnpaid(mount){
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, 'Ai chưa đóng tiền'));
  card.appendChild(el('div', { class: 'desc' },
    'Ghép <strong>ô tiền</strong> với <strong>cột Tham gia</strong> ở bảng Thu theo đợt để phán định, ' +
    'chứ không chỉ nhìn ô tiền trống — vì ô trống còn có thể là vắng mặt hoặc buổi chưa điểm danh. ' +
    'Không nhập gì ở tab này; sửa bên Thu theo đợt là đây đổi theo. Mới nhất trước.'));
  card.appendChild(el('div', { class: 'verdict-key' },
    '<span><span class="key-dot owed"></span><strong>Còn nợ</strong> — có mặt (o) mà ô tiền trống</span>' +
    '<span><span class="key-dot unknown"></span><strong>Chưa rõ</strong> — buổi chưa điểm danh</span>' +
    '<span><span class="key-dot absent"></span><strong>Vắng</strong> (x) — không cộng vào nợ, ' +
    'vì trong sổ vẫn có người vắng mà đóng</span>'));
  statHost = el('div', { class: 'mini-stats' });
  card.appendChild(statHost);
  periodHost = el('div', { class: 'unpaid-list' });
  card.appendChild(periodHost);
  mount.appendChild(card);

  const card2 = el('div', { class: 'card' });
  card2.appendChild(el('h2', {}, 'Còn nợ theo người'));
  card2.appendChild(el('div', { class: 'desc' },
    'Chỉ đếm những đợt người đó <strong>có mặt mà chưa đóng</strong>. Cột "Chưa rõ" là số đợt chưa ' +
    'điểm danh nên chưa phán được. Đang sắp theo số đợt còn nợ, nhiều nhất lên đầu; ' +
    'bấm tiêu đề cột khác để sắp theo cột đó.'));
  tableHost = el('div', {});
  card2.appendChild(tableHost);
  mount.appendChild(card2);

  // bấm tiêu đề để đổi cột sắp; bấm lại cột đang sắp thì đảo chiều
  tableHost.addEventListener('click', function(e){
    const th = e.target.closest && e.target.closest('th[data-sort]');
    if(!th) return;
    const key = th.getAttribute('data-sort');
    if(key === sortKey){ sortDir = -sortDir; }
    else { sortKey = key; sortDir = key === 'name' ? 1 : -1; }   // chữ thì A→Z, số thì cao→thấp
    renderTable();
  });

  // copy danh sách tên của một đợt để dán vào nhóm chat
  periodHost.addEventListener('click', function(e){
    const b = e.target.closest && e.target.closest('button.up-copy');
    if(b) copyPeriod(b);
  });

  onChange(render);
  render();
}

function render(){
  renderStats();
  renderPeriods();
  renderTable();
}

// ---------- ba con số đầu thẻ ----------
function renderStats(){
  if(!statHost) return;
  const members = getMembers();
  const c = countByStatus();
  const peopleOwing = members.filter(function(m){ return memberByStatus(m.id).owed.length > 0; }).length;

  const stats = [
    { label: 'Lượt còn nợ', value: c.owed, sub: 'đi rồi mà chưa đóng', cls: c.owed ? 'bad' : 'good' },
    { label: 'Người còn nợ', value: peopleOwing + '/' + members.length, sub: 'người cần nhắc' },
    { label: 'Chưa rõ', value: c.unknown, sub: 'buổi chưa điểm danh' }
  ];
  statHost.innerHTML = stats.map(function(s){
    return '<div class="stat"><span class="label">' + s.label + '</span>' +
      '<span class="value ' + (s.cls || '') + '">' + s.value + '</span>' +
      '<span class="sub">' + s.sub + '</span></div>';
  }).join('');
}

// ---------- danh sách theo đợt ----------
function periodWhen(p){
  if(!p.event_date) return 'chưa chốt ngày';
  return fmtDate(p.event_date) + (isUpcoming(p) ? ' · sắp tới' : '');
}

function chips(list, cls){
  return list.map(function(x){
    return '<span class="who-chip' + (cls ? ' ' + cls : '') + '">' + esc(x.name) + '</span>';
  }).join('');
}

function renderPeriods(){
  if(!periodHost) return;
  const members = getMembers(), periods = getPeriods();

  if(!periods.length){
    periodHost.innerHTML = '<div class="up-empty">Chưa có đợt nào.</div>';
    return;
  }

  periodHost.innerHTML = periods.map(function(p){
    const g = periodByStatus(p.id);
    const paid = periodPaidCount(p.id);

    // Nhãn trạng thái của cả đợt: ưu tiên nói về nợ thật; không có nợ thật mới nói tới
    // phần chưa rõ; cả hai đều sạch thì đợt đó xong.
    let badge;
    if(g.owed.length)        badge = '<span class="pill warn">còn nợ ' + g.owed.length + ' người</span>';
    else if(g.unknown.length) badge = '<span class="pill muted">chưa rõ ' + g.unknown.length + ' người</span>';
    else                      badge = '<span class="pill good">không ai nợ</span>';

    // Nút copy chép đúng danh sách đang là việc phải làm của đợt đó.
    const copyWhat = g.owed.length ? 'owed' : (g.unknown.length ? 'unknown' : '');
    const copy = copyWhat
      ? '<button type="button" class="chip up-copy" data-p="' + p.id + '" data-what="' + copyWhat + '">Copy tên</button>'
      : '';

    let body = '';
    if(g.owed.length){
      body += '<div class="up-line owed"><span class="up-tag">Còn nợ</span>' +
        '<span class="up-chips">' + chips(g.owed) + '</span></div>';
    }
    if(g.unknown.length){
      body += '<div class="up-line unknown"><span class="up-tag">Chưa rõ</span>' +
        '<span class="up-chips">' + chips(g.unknown, 'muted') + '</span></div>';
    }
    if(g.absent.length){
      body += '<div class="up-line absent"><span class="up-tag">Vắng</span>' +
        '<span class="up-plain">' + esc(g.absent.map(function(m){ return m.name; }).join(', ')) + '</span></div>';
    }
    if(!body){
      body = '<div class="up-line"><span class="ink-3">Cả nhóm đã đóng đợt này.</span></div>';
    }

    return '<div class="unpaid-period' + (isUpcoming(p) ? ' upcoming' : '') + '">' +
      '<div class="up-head">' +
        '<span class="up-name">' + esc(p.label || '') +
          '<span class="sub-date">' + periodWhen(p) + '</span></span>' +
        badge +
        '<span class="up-tail">' +
          '<span class="up-meta">đã đóng <span class="num">' + paid + '/' + members.length + '</span>' +
            ' · thu <span class="num">' + fmt(periodTotal(p.id)) + '</span></span>' +
          copy +
        '</span>' +
      '</div>' + body + '</div>';
  }).join('');
}

// ---------- bảng theo người ----------
function renderTable(){
  if(!tableHost) return;

  const rows = getMembers().map(function(m){
    const g = memberByStatus(m.id);
    return {
      name: m.name,
      owed: g.owed.length,
      list: g.owed.map(function(p){ return p.label || '—'; }),
      unknown: g.unknown.length,
      total: memberTotal(m.id)
    };
  });

  // Bằng nhau ở cột đang sắp thì xét tiếp số đợt còn nợ, rồi tên — nhờ vậy thứ tự
  // không nhảy ngẫu nhiên giữa những người cùng số.
  rows.sort(function(a, b){
    if(sortKey === 'name') return a.name.localeCompare(b.name, 'vi') * sortDir;
    const x = a[sortKey], y = b[sortKey];
    if(x !== y) return (x - y) * sortDir;
    if(b.owed !== a.owed) return b.owed - a.owed;
    return a.name.localeCompare(b.name, 'vi');
  });

  let html = '<thead><tr>' + COLS.map(function(c){
    const cls = (c.type === 'num' ? 'num-col ' : '') + (c.sortable ? 'sortable' : '');
    if(!c.sortable) return '<th class="' + cls + '">' + c.label + '</th>';
    const on = c.key === sortKey;
    const arrow = on ? '<span class="arrow">' + (sortDir === -1 ? '▼' : '▲') + '</span>' : '';
    return '<th class="' + cls + '" data-sort="' + c.key + '"' +
      ' aria-sort="' + (on ? (sortDir === -1 ? 'descending' : 'ascending') : 'none') + '"' +
      ' title="Bấm để sắp theo cột này">' + c.label + arrow + '</th>';
  }).join('') + '</tr></thead><tbody>';

  rows.forEach(function(r){
    const owed = r.owed
      ? '<span class="pill warn">' + r.owed + ' đợt</span>'
      : '<span class="pill good">không nợ</span>';
    const list = r.owed
      ? r.list.map(function(l){ return '<span class="who-chip">' + esc(l) + '</span>'; }).join('')
      : '<span class="ink-3">—</span>';
    const unk = r.unknown
      ? '<span class="num">' + r.unknown + '</span>'
      : '<span class="ink-3">—</span>';
    html += '<tr><td>' + esc(r.name) + '</td>' +
      '<td class="num-col">' + owed + '</td>' +
      '<td class="wrap-cell">' + list + '</td>' +
      '<td class="num-col">' + unk + '</td>' +
      '<td class="num-col num">' + fmt(r.total) + '</td></tr>';
  });

  const c = countByStatus();
  html += '</tbody><tfoot><tr><td>Tổng</td>' +
    '<td class="num-col num">' + c.owed + '</td>' +
    '<td></td>' +
    '<td class="num-col num">' + c.unknown + '</td>' +
    '<td class="num-col"></td></tr></tfoot>';

  const table = el('table', {});
  table.innerHTML = html;
  const scroll = el('div', { class: 'table-scroll' });
  scroll.appendChild(table);
  tableHost.innerHTML = '';
  tableHost.appendChild(scroll);
}

// ---------- copy danh sách ----------
function copyPeriod(btn){
  const pid = btn.getAttribute('data-p');
  const what = btn.getAttribute('data-what');
  const p = getPeriods().filter(function(x){ return x.id === pid; })[0];
  if(!p) return;
  const list = periodByStatus(pid)[what] || [];
  if(!list.length) return;
  const names = list.map(function(m){ return m.name; });
  const why = what === 'owed' ? ' người đi rồi mà chưa đóng' : ' người chưa đóng (buổi chưa điểm danh)';
  const text = (p.label || 'Đợt') + (p.event_date ? ' (' + fmtDate(p.event_date) + ')' : '') +
    ' — ' + names.length + why + ':\n' + names.join(', ');

  copyText(text).then(function(ok){
    const old = btn.textContent;
    btn.textContent = ok ? '✓ Đã copy' : 'Copy không được';
    btn.disabled = true;
    setTimeout(function(){ btn.textContent = old; btn.disabled = false; }, 1600);
  });
}

// navigator.clipboard chỉ có ở https / localhost; mở trang bằng file:// thì phải dùng
// đường cũ (textarea + execCommand), nên giữ cả hai.
function copyText(text){
  if(navigator.clipboard && window.isSecureContext){
    return navigator.clipboard.writeText(text).then(function(){ return true; }, function(){ return legacyCopy(text); });
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text){
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}
