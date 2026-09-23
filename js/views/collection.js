// Tab "Thu theo đợt" — bảng chính, cũng là nơi nhập liệu.
// Mỗi ô có 2 phần: số tiền đóng (gõ được) và trạng thái tham gia (bấm o/x).
// Thêm/xoá được cả người lẫn đợt. Mọi tab khác đọc lại cùng dữ liệu này nên luôn khớp.
import { el, esc, fmt, amountSpan, fmtDate, keepFocus } from '../utils.js';
import {
  getMembers, getPeriods, cellFor, getCanEdit,
  memberTotal, periodTotal, periodJoinCount,
  totalThu, totalChi, netTotal,
  stageCell, isCellDirty, pendingCount, hasPending, saveAll, discardChanges,
  cycleJoined, addMember, renameMember, deleteMember,
  addPeriod, updatePeriod, deletePeriod, onChange
} from '../dataStore.js';

let host = null, tableHost = null, toolbarHost = null;

function joinBtn(v, mid, pid){
  const cls = v === 'o' ? 'o' : v === 'x' ? 'x' : '';
  const label = v === 'o' ? '✓ o' : v === 'x' ? '✕ x' : '—';
  const dis = getCanEdit() ? '' : ' disabled';
  return '<button type="button" class="toggle-cell ' + cls + '" data-act="join" data-m="' + mid +
    '" data-p="' + pid + '"' + dis + ' aria-label="Đổi trạng thái tham gia">' + label + '</button>';
}

function amountCell(v, mid, pid){
  if(!getCanEdit()){
    return '<span class="amt-view">' + (v === null ? '—' : fmt(v)) + '</span>';
  }
  // type="text" + inputmode="decimal": không có nút tăng/giảm, nhưng điện thoại vẫn hiện bàn phím số
  const dirty = isCellDirty(mid, pid) ? ' dirty' : '';
  return '<input class="amt-in' + dirty + '" type="text" inputmode="decimal" autocomplete="off" data-m="' + mid +
    '" data-p="' + pid + '" value="' + (v === null ? '' : v) + '" placeholder="—">';
}

export function buildCollection(mount){
  host = mount;

  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, 'Bảng thu theo đợt'));
  card.appendChild(el('div', { class: 'desc' },
    'Gõ số tiền vào ô rồi bấm <strong>Lưu</strong> — ô chưa lưu có viền vàng. Ô Tham gia (o → x → trống) lưu ngay khi bấm. ' +
    'Mọi con số ở các tab khác — Đóng góp, Tổng thu/chi/chênh lệch, số buổi tham gia — đều tính ra từ bảng này.'));
  card.appendChild(el('div', { id: 'fcEditNote', class: 'edit-note' }, 'Đang kết nối để bật chỉnh sửa…'));

  toolbarHost = el('div', { class: 'toolbar' });
  card.appendChild(toolbarHost);

  tableHost = el('div', {});
  card.appendChild(tableHost);

  const totals = el('div', { class: 'grand-totals', id: 'fcGrandTotals' });
  card.appendChild(totals);
  host.appendChild(card);

  wireEvents();
  onChange(render);
  render();
}

function render(){
  keepFocus(host, function(){
    renderToolbar();
    renderTable();
    renderGrandTotals();
  });
}

function renderToolbar(){
  if(!toolbarHost) return;
  if(!getCanEdit()){ toolbarHost.innerHTML = ''; return; }
  const n = pendingCount();
  toolbarHost.innerHTML =
    '<button type="button" class="chip" data-act="add-member">+ Thêm người</button>' +
    '<button type="button" class="chip" data-act="add-period">+ Thêm đợt</button>' +
    '<span class="tb-gap"></span>' +
    '<button type="button" class="chip save" data-act="save"' + (n ? '' : ' disabled') + '>' +
      (n ? '💾 Lưu ' + n + ' thay đổi' : '💾 Đã lưu') + '</button>' +
    (n ? '<button type="button" class="chip" data-act="discard">Huỷ thay đổi</button>' : '');
}

function renderTable(){
  const members = getMembers(), periods = getPeriods();

  let thead = '<thead><tr><th class="sticky-col" rowspan="2">Người</th>';
  periods.forEach(function(p){
    const up = p.event_date ? '' : ' upcoming';
    const edit = getCanEdit()
      ? '<button type="button" class="col-edit" data-act="edit-period" data-p="' + p.id + '" title="Sửa / xoá đợt">⋯</button>'
      : '';
    thead += '<th class="center' + up + '" colspan="2">' + esc(p.label || '') + edit +
      '<br><span class="sub-date">' + (p.event_date ? fmtDate(p.event_date) : 'chưa chốt ngày') + '</span></th>';
  });
  thead += '<th class="num-col" rowspan="2">Tổng đóng</th></tr><tr>';
  periods.forEach(function(p){
    const up = p.event_date ? '' : ' upcoming';
    thead += '<th class="num-col' + up + '">Đóng</th><th class="center' + up + '">Tham gia</th>';
  });
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  members.forEach(function(m){
    const del = getCanEdit()
      ? '<button type="button" class="row-del" data-act="del-member" data-m="' + m.id + '" title="Xoá người này">×</button>'
      : '';
    const nameCell = getCanEdit()
      ? '<span class="name-edit" data-act="rename-member" data-m="' + m.id + '" title="Bấm để đổi tên">' + esc(m.name) + '</span>'
      : esc(m.name);
    tbody += '<tr><td class="sticky-col">' + nameCell + del + '</td>';
    periods.forEach(function(p){
      const c = cellFor(m.id, p.id);
      const up = p.event_date ? '' : ' upcoming';
      tbody += '<td class="num-col' + up + '">' + amountCell(c.amount, m.id, p.id) + '</td>' +
        '<td class="center' + up + '">' + joinBtn(c.joined, m.id, p.id) + '</td>';
    });
    tbody += '<td class="num-col num total-col">' + fmt(memberTotal(m.id)) + '</td></tr>';
  });
  tbody += '</tbody>';

  let tfoot = '<tfoot><tr><td class="sticky-col">Tổng</td>';
  periods.forEach(function(p){
    const up = p.event_date ? '' : ' upcoming';
    tfoot += '<td class="num-col num' + up + '">' + fmt(periodTotal(p.id)) + '</td>' +
      '<td class="center num' + up + '">' + periodJoinCount(p.id) + '</td>';
  });
  tfoot += '<td class="num-col num total-col">' + fmt(totalThu()) + '</td></tr></tfoot>';

  const table = el('table', { class: 'matrix' });
  table.innerHTML = thead + tbody + tfoot;
  const scroll = el('div', { class: 'table-scroll' });
  scroll.appendChild(table);
  tableHost.innerHTML = '';
  tableHost.appendChild(scroll);
}

function renderGrandTotals(){
  const g = document.getElementById('fcGrandTotals');
  if(!g) return;
  g.innerHTML =
    '<span>Tổng thu: ' + amountSpan(totalThu()) + '</span>' +
    '<span>Tổng chi: ' + amountSpan(totalChi()) + '</span>' +
    '<span>Chênh lệch: ' + amountSpan(netTotal()) + '</span>';
}

function wireEvents(){
  // số tiền: chỉ ghi nhận vào bộ nhớ khi rời ô / bấm Enter — lên server khi bấm Lưu
  host.addEventListener('change', function(e){
    const inp = e.target.closest && e.target.closest('input.amt-in');
    if(!inp) return;
    const raw = inp.value.replace(/[^\d.\-]/g, '').trim();
    stageCell(Number(inp.dataset.m), Number(inp.dataset.p),
      { amount: raw === '' ? null : Number(raw) });
  });
  host.addEventListener('keydown', function(e){
    const inp = e.target.closest && e.target.closest('input.amt-in');
    if(!inp) return;
    if(e.key === 'Enter'){ e.preventDefault(); inp.blur(); }
  });

  host.addEventListener('click', function(e){
    const t = e.target.closest && e.target.closest('[data-act]');
    if(!t) return;
    const act = t.getAttribute('data-act');

    if(act === 'join' && !t.disabled){
      cycleJoined(Number(t.dataset.m), Number(t.dataset.p));

    } else if(act === 'save'){
      saveAll();

    } else if(act === 'discard'){
      if(confirm('Bỏ ' + pendingCount() + ' thay đổi chưa lưu và lấy lại số liệu trên máy chủ?'))
        discardChanges();

    } else if(act === 'add-member'){
      const name = prompt('Tên người mới:');
      if(name && name.trim()) addMember(name.trim());

    } else if(act === 'rename-member'){
      const cur = t.textContent;
      const name = prompt('Đổi tên:', cur);
      if(name && name.trim() && name.trim() !== cur) renameMember(Number(t.dataset.m), name.trim());

    } else if(act === 'del-member'){
      const row = t.closest('tr');
      const nm = row ? row.querySelector('.sticky-col').textContent.replace('×', '').trim() : '';
      if(confirm('Xoá "' + nm + '" khỏi tất cả các bảng? Không khôi phục lại được.'))
        deleteMember(Number(t.dataset.m));

    } else if(act === 'add-period'){
      const label = prompt('Tên đợt mới (vd "Đợt 6" hoặc "Buổi tới"):');
      if(!label || !label.trim()) return;
      const date = prompt('Ngày (dd/mm/yyyy) — để trống nếu chưa chốt:');
      addPeriod(label.trim(), parseDate(date));

    } else if(act === 'edit-period'){
      editPeriod(Number(t.dataset.p));
    }
  });
}

function parseDate(s){
  if(!s || !s.trim()) return null;
  const m = s.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(!m) return null;
  return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

function editPeriod(pid){
  const p = getPeriods().filter(function(x){ return x.id === pid; })[0];
  if(!p) return;
  const label = prompt('Tên đợt (để trống rồi OK để XOÁ đợt này):', p.label || '');
  if(label === null) return;
  if(!label.trim()){
    if(confirm('Xoá đợt "' + (p.label || '') + '" cùng toàn bộ số liệu của đợt đó? Không khôi phục lại được.'))
      deletePeriod(pid);
    return;
  }
  const cur = p.event_date ? fmtDate(p.event_date) : '';
  const date = prompt('Ngày (dd/mm/yyyy) — để trống nếu chưa chốt:', cur);
  if(date === null) return;
  updatePeriod(pid, { label: label.trim(), event_date: parseDate(date) });
}
