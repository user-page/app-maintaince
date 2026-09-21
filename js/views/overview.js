// Tab "Tổng quan" — mọi con số đều tính ra từ cùng một nguồn, không có số cứng.
import { el, fmt, esc, fmtDate } from '../utils.js';
import { buildBarChart } from '../charts.js';
import {
  getMembers, getPeriods, getExpenses, pastPeriods,
  periodTotal, sessionsAttended, totalThu, totalChi, netTotal, onChange
} from '../dataStore.js';

let statsHost = null, chartHost = null, attendHost = null, attendDesc = null;

export function buildOverview(mount){
  const totalsCard = el('div', { class: 'card' });
  totalsCard.appendChild(el('h2', {}, 'Tổng thu · Tổng chi · Chênh lệch'));
  totalsCard.appendChild(el('div', { class: 'desc' },
    'Cộng trực tiếp từ bảng Thu theo đợt và bảng Chi tiêu.'));
  statsHost = el('div', { class: 'mini-stats' });
  totalsCard.appendChild(statsHost);
  mount.appendChild(totalsCard);

  const chartCard = el('div', { class: 'card' });
  chartCard.appendChild(el('h2', {}, 'Thu / Chi theo đợt'));
  chartCard.appendChild(el('div', { class: 'desc' },
    'Mỗi đợt thu được bao nhiêu so với chi bao nhiêu.'));
  chartCard.appendChild(el('div', { class: 'chart-legend' },
    '<span><span class="dot" style="background:var(--good)"></span>Thu</span>' +
    '<span><span class="dot" style="background:var(--bad)"></span>Chi</span>'));
  chartHost = el('div', {});
  chartCard.appendChild(chartHost);
  mount.appendChild(chartCard);

  const attendCard = el('div', { class: 'card' });
  attendCard.appendChild(el('h2', {}, 'Số buổi tham gia'));
  attendDesc = el('div', { class: 'desc' }, '');
  attendCard.appendChild(attendDesc);
  attendHost = el('div', {});
  attendCard.appendChild(attendHost);
  mount.appendChild(attendCard);

  onChange(render);
  render();
}

function render(){
  renderStats();
  renderChart();
  renderAttendance();
}

function renderStats(){
  if(!statsHost) return;
  const net = netTotal();
  statsHost.innerHTML =
    '<div class="stat"><span class="label">Tổng thu</span><span class="value num good">' + fmt(totalThu()) + '</span></div>' +
    '<div class="stat"><span class="label">Tổng chi</span><span class="value num bad">' + fmt(totalChi()) + '</span></div>' +
    '<div class="stat"><span class="label">Chênh lệch</span><span class="value num ' + (net < 0 ? 'bad' : 'good') + '">' + fmt(net) + '</span></div>';
}

function renderChart(){
  if(!chartHost) return;
  const ps = pastPeriods();
  const labels = ps.map(function(p){ return fmtDate(p.event_date); });
  const thu = {}, chi = {};
  ps.forEach(function(p){ thu[fmtDate(p.event_date)] = periodTotal(p.id); });
  getExpenses().forEach(function(e){
    if(!e.spend_date) return;
    const k = fmtDate(e.spend_date);
    chi[k] = (chi[k] || 0) + Math.abs(Number(e.amount) || 0);
  });
  chartHost.innerHTML = '';
  chartHost.appendChild(buildBarChart(labels, thu, chi));
}

function renderAttendance(){
  if(!attendHost) return;
  const members = getMembers(), nPast = pastPeriods().length;
  if(attendDesc){
    attendDesc.textContent = 'Tất cả ' + members.length + ' thành viên trên ' + nPast +
      ' đợt đã diễn ra — tính từ cột Tham gia, cập nhật ngay khi bạn đánh dấu.';
  }

  const rows = members.map(function(m){
    return { name: m.name, count: sessionsAttended(m.id) };
  }).sort(function(a, b){
    if(b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, 'vi');
  });

  const list = el('div', { class: 'bar-list' });
  rows.forEach(function(r){
    const pct = nPast > 0 ? (r.count / nPast * 100) : 0;
    const cls = r.count === 0 ? 'fill zero' : 'fill';
    list.appendChild(el('div', { class: 'bar-row' },
      '<span class="name">' + esc(r.name) + '</span>' +
      '<span class="track"><span class="' + cls + '" style="width:' + Math.max(pct, r.count === 0 ? 0 : 2) + '%"></span></span>' +
      '<span class="amt num">' + r.count + '/' + nPast + ' buổi</span>'));
  });
  attendHost.innerHTML = '';
  attendHost.appendChild(list);
}
