// Tab "Đóng góp" — hoàn toàn TÍNH RA từ bảng thu, không có số cứng và không nhập gì ở đây.
// Sửa một ô tiền ở tab Thu theo đợt là bảng này đổi ngay.
import { el, esc, fmt } from '../utils.js';
import { getMembers, getPeriods, cellFor, memberTotal, totalThu, sessionsAttended, pastPeriods, onChange } from '../dataStore.js';

let tableHost = null;

export function buildSummary(mount){
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, 'Tổng hợp đóng góp'));
  card.appendChild(el('div', { class: 'desc' },
    'Cộng từ bảng Thu theo đợt — mỗi người đã đóng tổng bao nhiêu, ở mấy đợt, và đi mấy buổi.'));
  tableHost = el('div', {});
  card.appendChild(tableHost);
  mount.appendChild(card);
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
  }).sort(function(a, b){
    if(b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name, 'vi');
  });

  const grand = totalThu();
  let html = '<thead><tr><th>Người</th><th class="num-col">Tổng đã đóng</th>' +
    '<th class="num-col">Số lần đóng</th><th class="num-col">Số buổi đi</th>' +
    '<th class="num-col">% tổng quỹ</th></tr></thead><tbody>';
  rows.forEach(function(r){
    const pct = grand > 0 ? (r.total / grand * 100) : 0;
    html += '<tr><td>' + esc(r.name) + '</td>' +
      '<td class="num-col num">' + fmt(r.total) + '</td>' +
      '<td class="num-col num">' + r.times + '</td>' +
      '<td class="num-col num">' + r.sessions + '/' + nPast + '</td>' +
      '<td class="num-col num">' + pct.toFixed(1) + '%</td></tr>';
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
