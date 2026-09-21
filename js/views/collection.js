// Tab "Thu theo đợt" — bảng ma trận Đóng/Tham gia, các ô o/x bấm được khi đã đăng nhập.
// 5 đợt đầu lấy từ file Excel (cột "Đóng" là số tiền, chỉ xem). Đợt cuối là "Buổi tới":
// chưa có số tiền, nên cả "Đóng" lẫn "Tham gia" đều là ô o/x nhập tay.
import { el, esc, fmt, amountSpan } from '../utils.js';
import { fcPeriodsFor, getCanEdit, onFcChange, PAST_PERIODS, UPCOMING_IDX, PERIOD_COUNT } from '../dataStore.js';

let fcTableHost = null, fcTotalsHost = null, upcomingHost = null, upcomingSumHost = null;
let fcRef = null;

function toggleCellHtml(v, kind, slug, idx, field){
  const cls = v==='o' ? 'o' : v==='x' ? 'x' : '';
  const label = v==='o' ? '✓ o' : v==='x' ? '✕ x' : '—';
  const dis = getCanEdit() ? '' : ' disabled';
  const aria = field==='pay' ? 'Đổi trạng thái đã đóng tiền' : 'Đổi trạng thái tham gia';
  return '<button type="button" class="toggle-cell '+cls+'" data-kind="'+kind+'" data-slug="'+esc(slug)+
    '" data-idx="'+idx+'" data-field="'+(field||'join')+'"'+dis+' aria-label="'+aria+'">'+label+'</button>';
}

export function buildCollection(host, fc){
  fcRef = fc;

  // ----- Thẻ nhập nhanh cho "buổi tới" -----
  // Đặt lên đầu tab vì đây là thứ hay dùng nhất, và trên điện thoại thì khỏi phải kéo ngang
  // hết 12 cột của bảng ma trận mới tới được cột "Buổi tới".
  const up = el('div',{class:'card'});
  up.appendChild(el('h2',{}, 'Buổi tới · ai đã đóng tiền'));
  up.appendChild(el('div',{class:'desc'},
    'Ghi trước cho buổi sắp diễn ra: bấm ô <strong>Đóng</strong> khi ai đó đã đưa tiền, ô <strong>Tham gia</strong> khi họ xác nhận đi. Mỗi ô xoay vòng o → x → trống.'));
  upcomingSumHost = el('div',{class:'upcoming-sum'});
  up.appendChild(upcomingSumHost);
  upcomingHost = el('div',{class:'upcoming-list'});
  up.appendChild(upcomingHost);
  host.appendChild(up);

  const card = el('div',{class:'card'});
  card.appendChild(el('h2',{}, 'Bảng thu theo đợt · Fund Collection'));
  card.appendChild(el('div',{class:'desc'},
    'Số tiền mỗi người đã đóng ở từng đợt. Bấm vào ô "Tham gia" để đánh dấu — xoay vòng o → x → trống. ' +
    'Cột <strong>Buổi tới</strong> ở cuối bảng dùng để ghi trước ai đã đóng tiền và ai sẽ tham gia cho buổi sắp diễn ra.'));
  card.appendChild(el('div',{id:'fcEditNote', class:'edit-note'}, 'Đang kết nối để bật chỉnh sửa…'));

  fcTableHost = el('div',{});
  card.appendChild(fcTableHost);

  fcTotalsHost = el('div',{style:'display:flex;gap:22px;flex-wrap:wrap;margin-top:14px;font-size:13px'});
  card.appendChild(fcTotalsHost);

  host.appendChild(card);

  onFcChange(renderAll);
  renderAll();
}

function renderAll(){
  renderUpcomingList();
  renderCollectionTable();
}

// Danh sách dọc, 1 dòng 1 người, 2 ô bấm — dùng được thoải mái trên điện thoại.
function renderUpcomingList(){
  if(!upcomingHost || !fcRef) return;
  const fc = fcRef;
  let paid = 0, joining = 0;

  let html = '<div class="upcoming-row head"><span class="who">Người</span>' +
    '<span class="cell">Đóng</span><span class="cell">Tham gia</span></div>';
  fc.rows.forEach(function(r, idx){
    const slug = fc.slugs[idx];
    const p = fcPeriodsFor(slug)[UPCOMING_IDX] || {};
    if(p.pay==='o') paid++;
    if(p.join==='o') joining++;
    html += '<div class="upcoming-row">' +
      '<span class="who">'+esc(r[1])+'</span>' +
      '<span class="cell">'+toggleCellHtml(p.pay,'fc',slug,UPCOMING_IDX,'pay')+'</span>' +
      '<span class="cell">'+toggleCellHtml(p.join,'fc',slug,UPCOMING_IDX,'join')+'</span>' +
      '</div>';
  });
  upcomingHost.innerHTML = html;

  if(upcomingSumHost){
    upcomingSumHost.innerHTML =
      '<span class="pill good">Đã đóng: '+paid+'/'+fc.rows.length+'</span>' +
      '<span class="pill warn">Sẽ tham gia: '+joining+'/'+fc.rows.length+'</span>';
  }
}

function renderCollectionTable(){
  if(!fcTableHost || !fcRef) return;
  const fc = fcRef;
  const table = el('table',{class:'matrix'});
  // "Đợt N (ngày)" trải ngang phía trên, căn giữa cặp cột của nó — vẫn chỉ 2 cột dữ liệu
  // thật sự cho mỗi đợt (Đóng, Tham gia), không thêm cột riêng.
  let thead = '<thead><tr><th class="sticky-col" rowspan="2">Người</th>';
  fc.collect_dates.forEach(function(d,i){
    thead += '<th class="num-col" colspan="2">Đợt '+(i+1)+'<br><span style="font-weight:400;text-transform:none;letter-spacing:0">'+d+'</span></th>';
  });
  thead += '<th class="center upcoming" colspan="2">Buổi tới<br><span style="font-weight:400;text-transform:none;letter-spacing:0">chưa chốt ngày</span></th>';
  thead += '</tr><tr>';
  fc.collect_dates.forEach(function(){ thead += '<th class="num-col">Đóng</th><th class="center">Tham gia</th>'; });
  thead += '<th class="center upcoming">Đóng</th><th class="center upcoming">Tham gia</th>';
  thead += '</tr></thead>';

  const joinCounts = new Array(PERIOD_COUNT).fill(0);
  let upcomingPaidCount = 0;
  let tbody = '<tbody>';
  fc.rows.forEach(function(r, idx){
    const slug = fc.slugs[idx];
    const periods = fcPeriodsFor(slug);
    tbody += '<tr><td class="sticky-col">'+esc(r[1])+'</td>';
    for(let c=0;c<PERIOD_COUNT;c++){
      const pay = periods[c].pay, join = periods[c].join;
      if(join==='o') joinCounts[c]++;
      if(c===UPCOMING_IDX){
        // buổi tới: chưa có số tiền → ô "Đóng" cũng là o/x bấm được
        if(pay==='o') upcomingPaidCount++;
        tbody += '<td class="center upcoming">'+toggleCellHtml(pay,'fc',slug,c,'pay')+'</td>'+
          '<td class="center upcoming">'+toggleCellHtml(join,'fc',slug,c,'join')+'</td>';
      } else {
        tbody += '<td class="num-col">'+amountSpan(pay)+'</td>'+
          '<td class="center">'+toggleCellHtml(join,'fc',slug,c,'join')+'</td>';
      }
    }
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let tfoot = '<tfoot><tr><td class="sticky-col">Tổng</td>';
  for(let c=0;c<PAST_PERIODS;c++){
    tfoot += '<td class="num-col num">'+fmt(fc.totals_row[2+c*2])+'</td>'+
      '<td class="center num">'+joinCounts[c]+'</td>';
  }
  tfoot += '<td class="center num upcoming">'+upcomingPaidCount+'</td>'+
    '<td class="center num upcoming">'+joinCounts[UPCOMING_IDX]+'</td>';
  tfoot += '</tr></tfoot>';

  table.innerHTML = thead+tbody+tfoot;
  const scroll = el('div',{class:'table-scroll'}); scroll.appendChild(table);
  fcTableHost.innerHTML = '';
  fcTableHost.appendChild(scroll);

  if(fcTotalsHost){
    fcTotalsHost.innerHTML =
      '<span>Tổng thu: '+amountSpan(fc.tong_thu)+'</span>'+
      '<span>Tổng chi: '+amountSpan(fc.tong_chi)+'</span>'+
      '<span>Chênh lệch: '+amountSpan(fc.net)+'</span>'+
      '<span>Buổi tới — đã đóng: <strong class="num">'+upcomingPaidCount+'</strong>/'+fc.rows.length+
      ' · sẽ tham gia: <strong class="num">'+joinCounts[UPCOMING_IDX]+'</strong>/'+fc.rows.length+'</span>';
  }
}
