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
  addPeriod, updatePeriod, deletePeriod, isUpcoming, isPast, onChange
} from '../dataStore.js';
import { openForm, confirmDialog } from '../dialog.js';

let host = null, tableHost = null, toolbarHost = null;

function joinBtn(v, mid, pid){
  const cls = v === 'o' ? 'o' : v === 'x' ? 'x' : '';
  // nhóm vốn ghi o / x trong sổ Excel — giữ đúng ký hiệu đó, màu lo phần còn lại
  const label = v === 'o' ? 'o' : v === 'x' ? 'x' : '·';
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

// Dòng ngày dưới tên đợt. Ba trạng thái: chưa chốt ngày · đã chốt nhưng chưa tới · đã qua.
function periodWhen(p){
  if(!p.event_date) return 'chưa chốt ngày';
  return fmtDate(p.event_date) + (isPast(p) ? '' : ' · sắp tới');
}

function renderTable(){
  const members = getMembers(), periods = getPeriods();

  let thead = '<thead><tr><th class="sticky-col" rowspan="2">Người</th>';
  periods.forEach(function(p){
    const up = isUpcoming(p) ? ' upcoming' : '';
    const edit = getCanEdit()
      ? '<button type="button" class="col-edit" data-act="edit-period" data-p="' + p.id + '" title="Sửa / xoá đợt" aria-label="Sửa hoặc xoá ' + esc(p.label || 'đợt') + '">⋯</button>'
      : '';
    thead += '<th class="center' + up + '" colspan="2">' + esc(p.label || '') + edit +
      '<br><span class="sub-date">' + periodWhen(p) + '</span></th>';
  });
  thead += '<th class="num-col" rowspan="2">Tổng đóng</th></tr><tr>';
  periods.forEach(function(p){
    const up = isUpcoming(p) ? ' upcoming' : '';
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
      const up = isUpcoming(p) ? ' upcoming' : '';
      tbody += '<td class="num-col' + up + '">' + amountCell(c.amount, m.id, p.id) + '</td>' +
        '<td class="center' + up + '">' + joinBtn(c.joined, m.id, p.id) + '</td>';
    });
    tbody += '<td class="num-col num total-col">' + fmt(memberTotal(m.id)) + '</td></tr>';
  });
  tbody += '</tbody>';

  let tfoot = '<tfoot><tr><td class="sticky-col">Tổng</td>';
  periods.forEach(function(p){
    const up = isUpcoming(p) ? ' upcoming' : '';
    tfoot += '<td class="num-col num' + up + '">' + fmt(periodTotal(p.id)) + '</td>' +
      '<td class="center num' + up + '">' + periodJoinCount(p.id) + '</td>';
  });
  tfoot += '<td class="num-col num total-col">' + fmt(totalThu()) + '</td></tr></tfoot>';

  const table = el('table', { class: 'matrix' });
  table.innerHTML = thead + tbody + tfoot;
  const scroll = el('div', { class: 'table-scroll pinned' });
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
    stageCell(inp.dataset.m, inp.dataset.p,
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
      cycleJoined(t.dataset.m, t.dataset.p);

    } else if(act === 'save'){
      saveAll();

    } else if(act === 'discard'){
      confirmDialog({
        title: 'Bỏ thay đổi chưa lưu?',
        message: 'Có ' + pendingCount() + ' thay đổi chưa lưu. Bỏ đi thì các ô quay về số liệu đang có trên máy chủ.',
        confirmLabel: 'Bỏ thay đổi', cancelLabel: 'Giữ lại', danger: true
      }).then(function(ok){ if(ok) discardChanges(); });

    } else if(act === 'add-member'){
      addMemberDialog();

    } else if(act === 'rename-member'){
      editMemberDialog(t.dataset.m);

    } else if(act === 'del-member'){
      const m = memberById(t.dataset.m);
      if(!m) return;
      confirmDialog({
        title: 'Xoá "' + m.name + '"?', message: memberDeleteWarning(m),
        confirmLabel: 'Xoá hẳn', danger: true
      }).then(function(ok){ if(ok) deleteMember(m.id); });

    } else if(act === 'add-period'){
      addPeriodDialog();

    } else if(act === 'edit-period'){
      editPeriodDialog(t.dataset.p);
    }
  });
}

// ---------- hộp thoại thêm / sửa ----------
function memberById(id){ return getMembers().filter(function(x){ return x.id === id; })[0]; }
function periodById(id){ return getPeriods().filter(function(x){ return x.id === id; })[0]; }

function memberDeleteWarning(m){
  return 'Xoá "' + m.name + '" khỏi tất cả các bảng, kể cả số tiền đã đóng và điểm danh của người này. ' +
    'Không khôi phục lại được.';
}

// "Đợt 6" đang là số lớn nhất thì gợi ý "Đợt 7"
function nextPeriodLabel(){
  let max = 0;
  getPeriods().forEach(function(p){
    const m = String(p.label || '').match(/^Đợt\s+(\d+)/i);
    if(m) max = Math.max(max, Number(m[1]));
  });
  return 'Đợt ' + (max + 1);
}

function periodFields(label, date){
  return [
    { name: 'label', label: 'Tên đợt', value: label, required: true, placeholder: 'vd. Đợt 7 hoặc Buổi tới' },
    { name: 'date', label: 'Ngày diễn ra', type: 'date', value: date, allowEmpty: true, emptyLabel: 'Chưa chốt ngày',
      hint: 'Đợt chưa chốt ngày vẫn ghi được ai đã đóng tiền, nhưng chưa tính vào số buổi tham gia.' }
  ];
}

function addMemberDialog(){
  openForm({
    title: 'Thêm người', submitLabel: 'Thêm',
    fields: [{ name: 'name', label: 'Tên', required: true, placeholder: 'vd. Anh Tư' }]
  }).then(function(r){
    if(r && r.action === 'submit') addMember(r.values.name);
  });
}

function editMemberDialog(id){
  const m = memberById(id);
  if(!m) return;
  openForm({
    title: 'Sửa tên', submitLabel: 'Lưu',
    fields: [{ name: 'name', label: 'Tên', value: m.name, required: true }],
    danger: { label: 'Xoá người này', message: memberDeleteWarning(m) }
  }).then(function(r){
    if(!r) return;
    if(r.action === 'delete') deleteMember(id);
    else if(r.values.name !== m.name) renameMember(id, r.values.name);
  });
}

function addPeriodDialog(){
  openForm({
    title: 'Thêm đợt', submitLabel: 'Thêm đợt',
    fields: periodFields(nextPeriodLabel(), null)
  }).then(function(r){
    if(r && r.action === 'submit') addPeriod(r.values.label, r.values.date);
  });
}

function editPeriodDialog(pid){
  const p = periodById(pid);
  if(!p) return;
  openForm({
    title: 'Sửa đợt', submitLabel: 'Lưu',
    fields: periodFields(p.label || '', p.event_date || null),
    danger: {
      label: 'Xoá đợt này',
      message: 'Xoá đợt "' + (p.label || '') + '" cùng toàn bộ số tiền và điểm danh của đợt đó. Không khôi phục lại được.'
    }
  }).then(function(r){
    if(!r) return;
    if(r.action === 'delete') deletePeriod(pid);
    else if(r.values.label !== (p.label || '') || r.values.date !== (p.event_date || null))
      updatePeriod(pid, { label: r.values.label, event_date: r.values.date });
  });
}
