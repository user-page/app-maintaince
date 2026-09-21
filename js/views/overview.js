// Tab "Tổng quan": tổng thu/chi/chênh lệch, biểu đồ thu/chi, và số buổi từng người đã tham gia.
import { el, fmt, amountSpan, esc } from '../utils.js';
import { buildBarChart } from '../charts.js';
import { fcPeriodsFor, onFcChange, PAST_PERIODS } from '../dataStore.js';

let attendanceHost = null;
let rosterRef = null, periodDatesRef = null;

export function buildOverview(host, sheets){
  const fc = sheets.fund_collection, ee = sheets.event_expenses;

  // Cả danh sách người lẫn số buổi tham gia đều lấy từ Bảng thu theo đợt, KHÔNG lấy từ
  // Bảng điểm danh: bảng điểm danh chỉ có 14 người và mới ghi 4 buổi (thiếu buổi 12/09),
  // nên ai đi đủ 5 buổi vẫn bị đếm thành 4. Bảng thu theo đợt có đủ 17 người × 5 đợt.
  rosterRef = fc.rows.map(function(r, i){ return { name: r[1], slug: fc.slugs[i] }; });
  periodDatesRef = fc.collect_dates;

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
    'Tất cả ' + rosterRef.length + ' thành viên, tính theo cột "Tham gia" trong Bảng thu theo đợt (' +
    PAST_PERIODS + ' đợt đã diễn ra) — cập nhật ngay khi bạn đánh dấu ở tab Thu theo đợt.'));
  attendanceHost = el('div',{});
  card4.appendChild(attendanceHost);
  host.appendChild(card4);

  onFcChange(renderAttendanceCounts);
  renderAttendanceCounts();
}

function renderAttendanceCounts(){
  if(!attendanceHost || !rosterRef) return;

  const rows = rosterRef.map(function(p){
    const periods = fcPeriodsFor(p.slug);
    // chỉ đếm PAST_PERIODS đợt đã diễn ra — đợt "Buổi tới" là dự kiến, chưa tính là đã đi
    let count = 0, joined = [];
    for(let c=0;c<PAST_PERIODS;c++){
      if(periods[c] && periods[c].join === 'o'){ count++; joined.push(periodDatesRef[c]); }
    }
    return { name: p.name, count: count, joined: joined };
  }).sort(function(a,b){
    if(b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, 'vi');
  });

  const list = el('div',{class:'bar-list'});
  rows.forEach(function(r){
    const pct = (r.count / PAST_PERIODS) * 100;
    const fillCls = r.count===0 ? 'fill zero' : 'fill';
    const title = r.count ? r.name + ' — đã đi: ' + r.joined.join(', ') : r.name + ' — chưa đi buổi nào';
    list.appendChild(el('div',{class:'bar-row', title:title},
      '<span class="name">'+esc(r.name)+'</span>'+
      '<span class="track"><span class="'+fillCls+'" style="width:'+Math.max(pct, r.count===0?0:2)+'%"></span></span>'+
      '<span class="amt num">'+r.count+'/'+PAST_PERIODS+' buổi</span>'));
  });
  attendanceHost.innerHTML = '';
  attendanceHost.appendChild(list);
}
