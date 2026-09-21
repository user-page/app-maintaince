// Tab "Điểm danh" — CÙNG dữ liệu với cột "Tham gia" ở tab Thu theo đợt, chỉ khác cách trình bày
// (bỏ cột tiền cho dễ nhìn). Sửa ở đây thì tab kia đổi theo và ngược lại — không còn hai nguồn lệch nhau.
import { el, esc, fmtDate } from '../utils.js';
import {
  getMembers, getPeriods, cellFor, getCanEdit,
  periodJoinCount, sessionsAttended, pastPeriods, cycleJoined, onChange
} from '../dataStore.js';

let tableHost = null;

export function buildAttendees(mount){
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, 'Điểm danh'));
  card.appendChild(el('div', { class: 'desc' },
    'Ai có mặt ở buổi nào. Đây chính là cột "Tham gia" của tab Thu theo đợt — sửa ở đâu cũng như nhau.'));
  card.appendChild(el('div', { id: 'atEditNote', class: 'edit-note' }, 'Đang kết nối để bật chỉnh sửa…'));
  tableHost = el('div', {});
  card.appendChild(tableHost);
  mount.appendChild(card);

  mount.addEventListener('click', function(e){
    const b = e.target.closest && e.target.closest('button.toggle-cell');
    if(b && !b.disabled) cycleJoined(Number(b.dataset.m), Number(b.dataset.p));
  });

  onChange(render);
  render();
}

function render(){
  if(!tableHost) return;
  const members = getMembers(), periods = getPeriods(), nPast = pastPeriods().length;

  let thead = '<thead><tr><th class="sticky-col">Người</th>';
  periods.forEach(function(p){
    const up = p.event_date ? '' : ' upcoming';
    thead += '<th class="center' + up + '">' + esc(p.label || '') +
      '<br><span class="sub-date">' + (p.event_date ? fmtDate(p.event_date) : 'chưa chốt') + '</span></th>';
  });
  thead += '<th class="num-col">Số buổi</th></tr></thead>';

  let tbody = '<tbody>';
  members.forEach(function(m){
    tbody += '<tr><td class="sticky-col">' + esc(m.name) + '</td>';
    periods.forEach(function(p){
      const v = cellFor(m.id, p.id).joined;
      const cls = v === 'o' ? 'o' : v === 'x' ? 'x' : '';
      const label = v === 'o' ? '✓ o' : v === 'x' ? '✕ x' : '—';
      const dis = getCanEdit() ? '' : ' disabled';
      const up = p.event_date ? '' : ' upcoming';
      tbody += '<td class="center' + up + '"><button type="button" class="toggle-cell ' + cls +
        '" data-m="' + m.id + '" data-p="' + p.id + '"' + dis + '>' + label + '</button></td>';
    });
    tbody += '<td class="num-col num total-col">' + sessionsAttended(m.id) + '/' + nPast + '</td></tr>';
  });
  tbody += '</tbody>';

  let tfoot = '<tfoot><tr><td class="sticky-col">Có mặt</td>';
  periods.forEach(function(p){
    const up = p.event_date ? '' : ' upcoming';
    tfoot += '<td class="center num' + up + '">' + periodJoinCount(p.id) + '</td>';
  });
  tfoot += '<td class="num-col"></td></tr></tfoot>';

  const table = el('table', { class: 'matrix' });
  table.innerHTML = thead + tbody + tfoot;
  const scroll = el('div', { class: 'table-scroll' });
  scroll.appendChild(table);
  tableHost.innerHTML = '';
  tableHost.appendChild(scroll);
}
