// Tab "Tổng quan": tổng thu/chi/chênh lệch, biểu đồ thu/chi, và số buổi từng người đã tham gia.
import { el, fmt, amountSpan, esc } from '../utils.js';
import { buildBarChart } from '../charts.js';
import { atSessionsFor, onAtChange } from '../dataStore.js';

let attendanceHost = null;
let eaRef = null, rosterRef = null;

export function buildOverview(host, sheets){
  const fc = sheets.fund_collection, ee = sheets.event_expenses,
        ea = sheets.event_attendees;
  eaRef = ea;

  // Danh sách người lấy từ Bảng thu theo đợt (đủ 17 người) chứ không lấy từ bảng điểm danh
  // (chỉ có 14) — để "tất cả thành viên" đúng nghĩa là tất cả.
  rosterRef = fc.rows.map(function(r, i){ return { name: r[1], slug: fc.slugs[i] }; });

  const chiByDate = {};
  ee.rows.forEach(function(r){
    const d = r[1];
    chiByDate[d] = (chiByDate[d]||0) + Math.abs(r[4]);
  });
  const thuByDate = {};
  fc.collect_dates.forEach(function(d, i){ thuByDate[d] = fc.totals_row[i*2+2] || 0; });

  // ----- Tổng thu / Tổng chi / Chênh lệch -----
  const totalsCard = el('div',{class:'card'});
  totalsCard.appendChild(el('h2',{}, 'Tổng thu · Tổng chi · Chênh lệch'));
  totalsCard.appendChild(el('div',{class:'desc'}, 'Theo Bảng thu theo đợt (Fund Collection).'));
  const totalsStrip = el('div',{class:'mini-stats'});
  totalsStrip.appendChild(el('div',{class:'stat'},
    '<span class="label">Tổng thu</span><span class="value num good">'+fmt(fc.tong_thu)+'</span>'));
  totalsStrip.appendChild(el('div',{class:'stat'},
    '<span class="label">Tổng chi</span><span class="value num bad">'+fmt(fc.tong_chi)+'</span>'));
  totalsStrip.appendChild(el('div',{class:'stat'},
    '<span class="label">Chênh lệch</span><span class="value num '+(fc.net<0?'bad':'good')+'">'+fmt(fc.net)+'</span>'));
  totalsCard.appendChild(totalsStrip);
  host.appendChild(totalsCard);

  // ----- Biểu đồ Thu/Chi theo đợt -----
  const card = el('div',{class:'card'});
  card.appendChild(el('h2',{}, 'Thu / Chi theo đợt'));
  card.appendChild(el('div',{class:'desc'}, 'So sánh tổng thu và tổng chi tại mỗi lần thu quỹ, theo dữ liệu trong Bảng thu theo đợt và Chi tiêu.'));
  card.appendChild(el('div',{class:'chart-legend'},
    '<span><span class="dot" style="background:var(--good)"></span>Thu</span>'+
    '<span><span class="dot" style="background:var(--bad)"></span>Chi</span>'));
  card.appendChild(buildBarChart(fc.collect_dates, thuByDate, chiByDate));
  host.appendChild(card);

  // ----- Số buổi tham gia (tất cả thành viên) -----
  const card4 = el('div',{class:'card'});
  card4.appendChild(el('h2',{}, 'Số buổi tham gia'));
  card4.appendChild(el('div',{class:'desc'},
    'Tất cả ' + rosterRef.length + ' thành viên và số buổi từng người đã tham gia, theo Bảng điểm danh — cập nhật ngay khi điểm danh thay đổi.'));
  attendanceHost = el('div',{});
  card4.appendChild(attendanceHost);
  host.appendChild(card4);

  onAtChange(renderAttendanceCounts);
  renderAttendanceCounts();
}

function renderAttendanceCounts(){
  if(!attendanceHost || !eaRef || !rosterRef) return;
  const tracked = {};
  eaRef.slugs.forEach(function(s){ tracked[s] = true; });

  const rows = rosterRef.map(function(p){
    // 3 người (Thảo Rùa, chị Dung, chị Anh) có trong bảng thu nhưng chưa có dòng nào trong
    // bảng điểm danh — hiện 0 buổi kèm ghi chú, để không nhầm với "đi 0 buổi".
    const inSheet = !!tracked[p.slug];
    const count = inSheet
      ? atSessionsFor(p.slug).filter(function(v){ return v==='o'; }).length
      : 0;
    return { name: p.name, count: count, inSheet: inSheet };
  }).sort(function(a,b){
    if(b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, 'vi');
  });

  const maxCount = rows.reduce(function(m,r){ return Math.max(m, r.count); }, 0);
  const list = el('div',{class:'bar-list'});
  let anyMissing = false;
  rows.forEach(function(r){
    const pct = maxCount>0 ? (r.count/maxCount*100) : 0;
    const fillCls = r.count===0 ? 'fill zero' : 'fill';
    // dấu * gọn hơn ghi chú dài — chú thích đặt một lần ở cuối thẻ, đỡ bị cắt trên điện thoại
    const mark = r.inSheet ? '' : '<span class="ink-3"> *</span>';
    if(!r.inSheet) anyMissing = true;
    const title = r.inSheet ? r.name : r.name + ' — chưa có trong bảng điểm danh';
    list.appendChild(el('div',{class:'bar-row', title:title},
      '<span class="name">'+esc(r.name)+mark+'</span>'+
      '<span class="track"><span class="'+fillCls+'" style="width:'+Math.max(pct, r.count===0?0:2)+'%"></span></span>'+
      '<span class="amt num">'+r.count+' buổi</span>'));
  });
  attendanceHost.innerHTML = '';
  attendanceHost.appendChild(list);
  if(anyMissing){
    attendanceHost.appendChild(el('div',{class:'bar-note'},
      '* chưa có dòng nào trong Bảng điểm danh, nên tạm tính 0 buổi.'));
  }
}
