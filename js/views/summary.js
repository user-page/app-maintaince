// Tab "Đóng góp" — hoàn toàn TÍNH RA từ bảng thu, không có số cứng và không nhập gì ở đây.
// Sửa một ô tiền ở tab Thu theo đợt là bảng này đổi ngay.
import { el, esc, fmt } from '../utils.js';
import { getMembers, getPeriods, cellFor, memberTotal, totalThu, sessionsAttended, pastPeriods, onChange } from '../dataStore.js';

let tableHost = null;

// Sắp xếp để ngoài render() — render() chạy lại mỗi lần dữ liệu đổi, để bên trong thì
// cứ đổi một ô tiền là bảng nhảy về cách sắp mặc định.
// Mặc định: ai đóng nhiều lần nhất lên đầu.
const COLS = [
  { key: 'name',     label: 'Người',        type: 'text' },
  { key: 'total',    label: 'Tổng đã đóng', type: 'num' },
  { key: 'times',    label: 'Số lần đóng',  type: 'num' },
  { key: 'sessions', label: 'Số buổi đi',   type: 'num' },
  { key: 'pct',      label: '% tổng quỹ',   type: 'num' }
];
let sortKey = 'times', sortDir = -1;   // -1 = cao xuống thấp

export function buildSummary(mount){
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, 'Tổng hợp đóng góp'));
  card.appendChild(el('div', { class: 'desc' },
    'Cộng từ bảng Thu theo đợt — mỗi người đã đóng tổng bao nhiêu, ở mấy đợt, và đi mấy buổi. ' +
    'Đang sắp theo số lần đóng, nhiều nhất lên đầu; bấm tiêu đề cột khác để sắp theo cột đó.'));
  tableHost = el('div', {});
  card.appendChild(tableHost);
  mount.appendChild(card);

  // bấm tiêu đề để đổi cột sắp; bấm lại cột đang sắp thì đảo chiều
  tableHost.addEventListener('click', function(e){
    const th = e.target.closest && e.target.closest('th[data-sort]');
    if(!th) return;
    const key = th.getAttribute('data-sort');
    if(key === sortKey){ sortDir = -sortDir; }
    else { sortKey = key; sortDir = key === 'name' ? 1 : -1; }   // chữ thì A→Z, số thì cao→thấp
    render();
  });

  onChange(render);
  render();
}

function render(){
  if(!tableHost) return;
  const members = getMembers(), periods = getPeriods(), nPast = pastPeriods().length;

  const rows = members.map(function(m){
    const paidTimes = periods.filter(function(p){
      const a = cellFor(m.id, p.id).amount;
      return typeof a === 'number' && a > 0;
    }).length;
    return { name: m.name, total: memberTotal(m.id), times: paidTimes, sessions: sessionsAttended(m.id) };
  });

  const grand = totalThu();
  rows.forEach(function(r){ r.pct = grand > 0 ? (r.total / grand * 100) : 0; });

  // Bằng nhau ở cột đang sắp thì xét tiếp tổng đã đóng, rồi tên — nhờ vậy thứ tự
  // không nhảy ngẫu nhiên giữa những người cùng số.
  rows.sort(function(a, b){
    const x = a[sortKey], y = b[sortKey];
    if(sortKey === 'name') return a.name.localeCompare(b.name, 'vi') * sortDir;
    if(x !== y) return (x - y) * sortDir;
    if(b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name, 'vi');
  });

  let html = '<thead><tr>' + COLS.map(function(c){
    const arrow = c.key === sortKey ? '<span class="arrow">' + (sortDir === -1 ? '▼' : '▲') + '</span>' : '';
    return '<th class="' + (c.type === 'num' ? 'num-col ' : '') + 'sortable" data-sort="' + c.key + '"' +
      ' aria-sort="' + (c.key === sortKey ? (sortDir === -1 ? 'descending' : 'ascending') : 'none') + '"' +
      ' title="Bấm để sắp theo cột này">' + c.label + arrow + '</th>';
  }).join('') + '</tr></thead><tbody>';
  rows.forEach(function(r){
    html += '<tr><td>' + esc(r.name) + '</td>' +
      '<td class="num-col num">' + fmt(r.total) + '</td>' +
      '<td class="num-col num">' + r.times + '</td>' +
      '<td class="num-col num">' + r.sessions + '/' + nPast + '</td>' +
      '<td class="num-col num">' + r.pct.toFixed(1) + '%</td></tr>';
  });
  html += '</tbody><tfoot><tr><td>Tổng</td><td class="num-col num">' + fmt(grand) + '</td>' +
    '<td class="num-col"></td><td class="num-col"></td><td class="num-col num">100%</td></tr></tfoot>';

  const table = el('table', {});
  table.innerHTML = html;
  const scroll = el('div', { class: 'table-scroll' });
  scroll.appendChild(table);
  tableHost.innerHTML = '';
  tableHost.appendChild(scroll);
}
