// Điểm khởi động: dựng khung tabs/panels, nạp dữ liệu (Supabase, hoặc bản chụp tĩnh nếu
// không kết nối được), rồi bật phần đăng nhập/chỉnh sửa.
import { el, fmt } from './utils.js';
import {
  loadFallback, getMembers, getPeriods, getExpenses, pastPeriods,
  totalThu, totalChi, netTotal, onChange, hasPending
} from './dataStore.js';
import { initAuth } from './auth.js';
import { buildOverview } from './views/overview.js';
import { buildCollection } from './views/collection.js';
import { buildExpenses } from './views/expenses.js';
import { buildSummary } from './views/summary.js';
import { buildAttendees } from './views/attendees.js';

const TABS = [
  { id: 'overview',   label: 'Tổng quan' },
  { id: 'collection', label: 'Thu theo đợt' },
  { id: 'expenses',   label: 'Chi tiêu' },
  { id: 'summary',    label: 'Đóng góp' },
  { id: 'attendees',  label: 'Điểm danh' }
];

function renderStatStrip(){
  const strip = document.getElementById('statStrip');
  if(!strip) return;
  const net = netTotal();
  const stats = [
    { label: 'Tổng thu',    value: fmt(totalThu()), cls: 'good' },
    { label: 'Tổng chi',    value: fmt(totalChi()), cls: 'bad' },
    { label: 'Chênh lệch',  value: fmt(net), cls: net < 0 ? 'bad' : 'good' },
    { label: 'Thành viên',  value: getMembers().length },
    { label: 'Đợt đã diễn ra', value: pastPeriods().length, sub: 'trên ' + getPeriods().length + ' đợt' },
    { label: 'Khoản chi',   value: getExpenses().length, sub: 'dòng ghi chép' }
  ];
  strip.innerHTML = stats.map(function(s){
    return '<div class="stat"><span class="label">' + s.label + '</span>' +
      '<span class="value num ' + (s.cls || '') + '">' + s.value + '</span>' +
      (s.sub ? '<span class="sub">' + s.sub + '</span>' : '') + '</div>';
  }).join('');
}

function makePanel(id, hidden){
  return el('section', { class: 'panel', id: 'panel-' + id, role: 'tabpanel',
    'aria-labelledby': 'tab-' + id, hidden: hidden ? '' : null });
}

function selectTab(id){
  TABS.forEach(function(t){
    document.getElementById('tab-' + t.id).setAttribute('aria-selected', t.id === id ? 'true' : 'false');
    document.getElementById('panel-' + t.id).hidden = t.id !== id;
  });
}

function buildTabsAndPanels(){
  const nav = document.getElementById('tabs');
  const panels = document.getElementById('panels');
  TABS.forEach(function(t, i){
    const btn = el('button', { role: 'tab', id: 'tab-' + t.id, 'aria-controls': 'panel-' + t.id,
      'aria-selected': i === 0 ? 'true' : 'false' }, t.label);
    btn.addEventListener('click', function(){ selectTab(t.id); });
    nav.appendChild(btn);
  });

  const p1 = makePanel('overview', false);   panels.appendChild(p1); buildOverview(p1);
  const p2 = makePanel('collection', true);  panels.appendChild(p2); buildCollection(p2);
  const p3 = makePanel('expenses', true);    panels.appendChild(p3); buildExpenses(p3);
  const p4 = makePanel('summary', true);     panels.appendChild(p4); buildSummary(p4);
  const p5 = makePanel('attendees', true);   panels.appendChild(p5); buildAttendees(p5);
}

async function boot(){
  // Nạp bản chụp tĩnh trước để trang hiện ra ngay và vẫn xem được kể cả khi mất mạng;
  // auth.js sẽ nạp đè dữ liệu thật từ Supabase ngay sau đó.
  try{
    const res = await fetch('data/snapshot.json');
    loadFallback(await res.json());
  }catch(e){ console.error('Không đọc được bản chụp tĩnh', e); }

  buildTabsAndPanels();
  onChange(renderStatStrip);
  renderStatStrip();

  const g = document.getElementById('genDate');
  if(g) g.textContent = 'Cập nhật ' + new Date().toLocaleDateString('vi-VN');

  // nhắc trước khi đóng tab nếu còn thứ gõ dở chưa bấm Lưu
  window.addEventListener('beforeunload', function(e){
    if(hasPending()){ e.preventDefault(); e.returnValue = ''; }
  });

  initAuth();
}

boot();
