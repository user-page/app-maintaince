// Điểm khởi động của app: tải dữ liệu tĩnh, dựng khung tabs/panels, gắn sự kiện chung,
// rồi mới kết nối Supabase (auth.js) để bật chỉnh sửa trực tiếp.
import { el, fmt } from './utils.js';
import { init as initStore, getSheets, toggleFc, toggleAt } from './dataStore.js';
import { initAuth } from './auth.js';
import { buildOverview } from './views/overview.js';
import { buildCollection } from './views/collection.js';
import { buildExpenses } from './views/expenses.js';
import { buildSummary } from './views/summary.js';
import { buildAttendees } from './views/attendees.js';

const TABS = [
  {id:'overview', label:'Tổng quan'},
  {id:'collection', label:'Thu theo đợt'},
  {id:'expenses', label:'Chi tiêu'},
  {id:'summary', label:'Đóng góp'},
  {id:'attendees', label:'Điểm danh'}
];

function buildStatStrip(sheets){
  const mf = sheets.maintenance_fund, fc = sheets.fund_collection, fs = sheets.fund_summary, ea = sheets.event_attendees;
  const memberCount = fs.rows.length;
  const sessionsHeld = ea.totals_row.filter(function(v){ return v!==null && v!==undefined; }).length;
  const stats = [
    {label:'Tổng thu (Bảng thu theo đợt)', value:fmt(fc.tong_thu), cls:'good'},
    {label:'Tổng chi (Chi tiêu)', value:fmt(fc.tong_chi), cls:'bad'},
    {label:'Quỹ dư (Sổ quỹ)', value:fmt(mf.balance), cls: mf.balance<0?'bad':'good'},
    {label:'Thành viên', value:memberCount, sub:'trong Bảng tổng hợp'},
    {label:'Buổi đã diễn ra', value:sessionsHeld, sub:'trên '+ea.headers.length + ' cột buổi'},
    {label:'Giao dịch trong sổ', value:mf.rows.length, sub:'dòng ghi chép'}
  ];
  const strip = document.getElementById('statStrip');
  stats.forEach(function(s){
    strip.appendChild(el('div',{class:'stat'},
      '<span class="label">'+s.label+'</span>'+
      '<span class="value num '+(s.cls||'')+'">'+s.value+'</span>'+
      (s.sub?'<span class="sub">'+s.sub+'</span>':'')));
  });
}

function makePanel(id, hidden){
  return el('section', {class:'panel', id:'panel-'+id, role:'tabpanel', 'aria-labelledby':'tab-'+id, hidden: hidden?'':null});
}

function selectTab(id){
  TABS.forEach(function(t){
    document.getElementById('tab-'+t.id).setAttribute('aria-selected', t.id===id ? 'true':'false');
    document.getElementById('panel-'+t.id).hidden = t.id!==id;
  });
}

function buildTabsAndPanels(sheets){
  const tabsNav = document.getElementById('tabs');
  const panelsHost = document.getElementById('panels');
  TABS.forEach(function(t, i){
    const btn = el('button', {role:'tab', id:'tab-'+t.id, 'aria-controls':'panel-'+t.id,
      'aria-selected': i===0 ? 'true':'false'}, t.label);
    btn.addEventListener('click', function(){ selectTab(t.id); });
    tabsNav.appendChild(btn);
  });

  const pOverview = makePanel('overview', false);
  panelsHost.appendChild(pOverview);
  buildOverview(pOverview, sheets);

  const pCollection = makePanel('collection', true);
  panelsHost.appendChild(pCollection);
  buildCollection(pCollection, sheets.fund_collection);

  const pExpenses = makePanel('expenses', true);
  panelsHost.appendChild(pExpenses);
  buildExpenses(pExpenses, sheets.event_expenses);

  const pSummary = makePanel('summary', true);
  panelsHost.appendChild(pSummary);
  buildSummary(pSummary, sheets.fund_summary);

  const pAttendees = makePanel('attendees', true);
  panelsHost.appendChild(pAttendees);
  buildAttendees(pAttendees, sheets.event_attendees);
}

function wireToggleClicks(){
  document.addEventListener('click', function(e){
    const btn = e.target.closest && e.target.closest('button.toggle-cell');
    if(!btn || btn.disabled) return;
    const kind = btn.getAttribute('data-kind');
    const slug = btn.getAttribute('data-slug');
    const idx = Number(btn.getAttribute('data-idx'));
    const field = btn.getAttribute('data-field') || 'join';
    if(kind==='fc') toggleFc(slug, idx, field);
    else if(kind==='at') toggleAt(slug, idx);
  });
}

async function boot(){
  const res = await fetch('data/fund-data.json');
  const DATA = await res.json();
  initStore(DATA);
  const sheets = getSheets();

  buildStatStrip(sheets);
  buildTabsAndPanels(sheets);
  wireToggleClicks();

  const genDate = document.getElementById('genDate');
  if(genDate) genDate.textContent = 'Trang tạo ' + new Date().toLocaleDateString('vi-VN');

  initAuth();
}

boot();
