// Tab "Điểm danh" — ai tham gia buổi nào, các ô o/x bấm được khi đã đăng nhập.
import { el, esc } from '../utils.js';
import { atSessionsFor, getCanEdit, onAtChange } from '../dataStore.js';

let atTableHost = null;
let eaRef = null;

function toggleCellHtml(v, kind, slug, idx){
  const cls = v==='o' ? 'o' : v==='x' ? 'x' : '';
  const label = v==='o' ? '✓ o' : v==='x' ? '✕ x' : '—';
  const dis = getCanEdit() ? '' : ' disabled';
  return '<button type="button" class="toggle-cell '+cls+'" data-kind="'+kind+'" data-slug="'+esc(slug)+'" data-idx="'+idx+'"'+dis+' aria-label="Đổi trạng thái">'+label+'</button>';
}

export function buildAttendees(host, ea){
  eaRef = ea;
  const card = el('div',{class:'card'});
  card.appendChild(el('h2',{}, 'Điểm danh các buổi · Event Attendees'));
  card.appendChild(el('div',{class:'desc'}, 'Bấm vào ô để đánh dấu ai tham gia buổi nhậu — xoay vòng o → x → trống. Buổi 5, 6 để trống cho các buổi sắp tới.'));
  card.appendChild(el('div',{id:'atEditNote', class:'edit-note'}, 'Đang kết nối để bật chỉnh sửa…'));
  atTableHost = el('div',{});
  card.appendChild(atTableHost);
  host.appendChild(card);

  onAtChange(renderAttendeesTable);
  renderAttendeesTable();
}

function renderAttendeesTable(){
  if(!atTableHost || !eaRef) return;
  const ea = eaRef;
  const table = el('table',{class:'matrix'});
  const sessionHeaders = ea.headers.slice(2); // Buổi 1..6
  let thead = '<thead><tr><th class="sticky-col">Người</th>'+
    sessionHeaders.map(function(h){ return '<th class="center">'+esc(h.replace(/\n/g,' '))+'</th>'; }).join('')+
    '</tr></thead>';

  const counts = sessionHeaders.map(function(){ return 0; });
  const tbody = '<tbody>'+ea.rows.map(function(r, idx){
    const slug = ea.slugs[idx];
    const sessions = atSessionsFor(slug);
    const cells = sessions.map(function(v,i){
      if(v==='o') counts[i]++;
      return '<td class="center">'+toggleCellHtml(v,'at',slug,i)+'</td>';
    }).join('');
    return '<tr><td class="sticky-col">'+esc(r[1])+'</td>'+cells+'</tr>';
  }).join('')+'</tbody>';

  const tfoot = '<tfoot><tr><td class="sticky-col">Tổng có mặt</td>'+
    counts.map(function(c){ return '<td class="center num">'+c+'</td>'; }).join('')+
    '</tr></tfoot>';

  table.innerHTML = thead+tbody+tfoot;
  const scroll = el('div',{class:'table-scroll'}); scroll.appendChild(table);
  atTableHost.innerHTML = '';
  atTableHost.appendChild(scroll);
}
