// Tab "Tổng quan": tổng thu/chi/chênh lệch, biểu đồ thu/chi, top đóng góp, số buổi mỗi người tham gia.
import { el, fmt, amountSpan, esc } from '../utils.js';
import { buildBarChart } from '../charts.js';
import { atSessionsFor, onAtChange } from '../dataStore.js';

let attendanceHost = null;
let eaRef = null;

export function buildOverview(host, sheets){
  const fc = sheets.fund_collection, ee = sheets.event_expenses,
        fs = sheets.fund_summary, ea = sheets.event_attendees;
  eaRef = ea;

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

  // ----- Top đóng góp -----
  const card3 = el('div',{class:'card'});
  card3.appendChild(el('h2',{}, 'Top đóng góp'));
  card3.appendChild(el('div',{class:'desc'}, '5 thành viên đóng nhiều nhất, theo Bảng tổng hợp đóng góp.'));
  const top = fs.rows.slice().sort(function(a,b){return b[1]-a[1];}).slice(0,5);
  const maxContrib = top.length ? top[0][1] : 1;
  const list = el('div',{class:'bar-list'});
  top.forEach(function(r){
    const pct = maxContrib>0 ? Math.max((r[1]/maxContrib*100),2) : 2;
    list.appendChild(el('div',{class:'bar-row'},
      '<span class="name">'+esc(r[0])+'</span>'+
      '<span class="track"><span class="fill" style="width:'+pct+'%"></span></span>'+
      '<span class="amt num">'+fmt(r[1])+'</span>'));
  });
  card3.appendChild(list);
  host.appendChild(card3);

  // ----- Số buổi tham gia (tất cả thành viên) -----
  const card4 = el('div',{class:'card'});
  card4.appendChild(el('h2',{}, 'Số buổi tham gia'));
  card4.appendChild(el('div',{class:'desc'}, 'Mỗi thành viên đã tham gia bao nhiêu buổi, theo Bảng điểm danh — cập nhật ngay khi điểm danh thay đổi.'));
  attendanceHost = el('div',{});
  card4.appendChild(attendanceHost);
  host.appendChild(card4);

  onAtChange(renderAttendanceCounts);
  renderAttendanceCounts();
}

function renderAttendanceCounts(){
  if(!attendanceHost || !eaRef) return;
  const ea = eaRef;
  const rows = ea.rows.map(function(r, idx){
    const slug = ea.slugs[idx];
    const sessions = atSessionsFor(slug);
    const count = sessions.filter(function(v){ return v==='o'; }).length;
    return { name: r[1], count: count };
  }).sort(function(a,b){ return b.count - a.count; });

  const maxCount = rows.length ? Math.max.apply(null, rows.map(function(r){ return r.count; })) : 1;
  const list = el('div',{class:'bar-list'});
  rows.forEach(function(r){
    const pct = maxCount>0 ? (r.count/maxCount*100) : 0;
    const fillCls = r.count===0 ? 'fill zero' : 'fill';
    list.appendChild(el('div',{class:'bar-row'},
      '<span class="name">'+esc(r.name)+'</span>'+
      '<span class="track"><span class="'+fillCls+'" style="width:'+Math.max(pct, r.count===0?0:2)+'%"></span></span>'+
      '<span class="amt num">'+r.count+' buổi</span>'));
  });
  attendanceHost.innerHTML = '';
  attendanceHost.appendChild(list);
}
