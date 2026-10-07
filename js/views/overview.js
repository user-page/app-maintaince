// Tab "Tổng quan" — mọi con số đều tính ra từ cùng một nguồn, không có số cứng.
import { el, esc, fmtDate } from '../utils.js';
import { buildBarChart } from '../charts.js';
import {
  getMembers, getExpenses, pastPeriods, datedPeriods, cellFor,
  periodTotal, sessionsAttended, onChange
} from '../dataStore.js';

let chartHost = null, attendHost = null, attendDesc = null;

export function buildOverview(mount){
  // Ba con số Tổng thu / Tổng chi / Chênh lệch đã nằm trên dải chỉ số ở đầu trang,
  // không lặp lại ở đây nữa — mỗi con số chỉ xuất hiện một lần.
  const chartCard = el('div', { class: 'card' });
  chartCard.appendChild(el('h2', {}, 'Thu / Chi theo đợt'));
  chartCard.appendChild(el('div', { class: 'desc' },
    'Mỗi đợt thu được bao nhiêu so với chi bao nhiêu. Cũ nhất bên trái.'));
  chartCard.appendChild(el('div', { class: 'chart-legend' },
    '<span><span class="dot" style="background:var(--good)"></span>Thu</span>' +
    '<span><span class="dot" style="background:var(--bad)"></span>Chi</span>'));
  chartHost = el('div', {});
  chartCard.appendChild(chartHost);
  mount.appendChild(chartCard);

  const attendCard = el('div', { class: 'card' });
  attendCard.appendChild(el('h2', {}, 'Ai đi những buổi nào'));
  attendDesc = el('div', { class: 'desc' }, '');
  attendCard.appendChild(attendDesc);
  attendHost = el('div', {});
  attendCard.appendChild(attendHost);
  mount.appendChild(attendCard);

  onChange(render);
  render();
}

function render(){
  renderChart();
  renderAttendance();
}

function renderChart(){
  if(!chartHost) return;
  // Biểu đồ là trục thời gian nên đọc từ trái sang phải, cũ -> mới — ngược với thứ tự
  // "mới nhất trước" của các bảng.
  const ps = datedPeriods().slice().sort(function(a, b){
    return a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0;
  });
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
  const members = getMembers();
  // cũ -> mới, cùng chiều với biểu đồ ngay phía trên
  const ps = pastPeriods().slice().sort(function(a, b){
    return a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0;
  });
  const nPast = ps.length;
  if(attendDesc){
    attendDesc.textContent = 'Mỗi ô là một buổi đã qua, cũ nhất bên trái. Ô đậm là có mặt. ' +
      'Buổi chưa tới chưa tính vào đây. Lấy từ cột Tham gia ở bảng Thu theo đợt.';
  }

  const rows = members.map(function(m){
    return { id: m.id, name: m.name, count: sessionsAttended(m.id) };
  }).sort(function(a, b){
    if(b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, 'vi');
  });

  const list = el('div', { class: 'attend-list' });
  rows.forEach(function(r){
    let marks = '';
    ps.forEach(function(p){
      const v = cellFor(r.id, p.id).joined;
      const cls = v === 'o' ? 'on' : v === 'x' ? 'off' : 'blank';
      const what = v === 'o' ? 'có mặt' : v === 'x' ? 'vắng' : 'chưa ghi';
      marks += '<span class="mk ' + cls + '" title="' + fmtDate(p.event_date) + ' — ' + what + '"></span>';
    });
    list.appendChild(el('div', { class: 'attend-row' },
      '<span class="name">' + esc(r.name) + '</span>' +
      '<span class="marks" role="img" aria-label="' + r.count + ' trên ' + nPast + ' buổi">' + marks + '</span>' +
      '<span class="amt num">' + r.count + '/' + nPast + '</span>'));
  });
  attendHost.innerHTML = '';
  attendHost.appendChild(list);
}
