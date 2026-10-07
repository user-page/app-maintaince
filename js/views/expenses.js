// Tab "Chi tiêu" — thêm / sửa / xoá được từng khoản chi.
// Tổng chi và Chênh lệch ở các tab khác cộng thẳng từ đây nên đổi ở đây là mọi nơi đổi theo.
import { el, esc, fmt, amountSpan, fmtDate, keepFocus } from '../utils.js';
import {
  getExpenses, getCanEdit, totalChi, addExpense, deleteExpense, onChange,
  stageExpense, isExpenseDirty, pendingCount, saveAll, discardChanges
} from '../dataStore.js';
import { openForm, confirmDialog } from '../dialog.js';
import { openDatePopover, todayISO } from '../datepicker.js';

const CAL_ICON = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">' +
  '<rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
  '<path d="M1.5 6.5h13M5 1.2v3M11 1.2v3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

let listHost = null, toolbarHost = null, mountRef = null;

export function buildExpenses(mount){
  mountRef = mount;
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, 'Chi tiêu'));
  card.appendChild(el('div', { class: 'desc' },
    'Các khoản đã chi, mới nhất ở trên — ngày, nội dung (nhậu, rượu, nước…) và số tiền (số âm). ' +
    'Sửa ô nào xong thì bấm <strong>Lưu</strong>; ô chưa lưu có viền vàng. Tổng chi và Chênh lệch ở tab Tổng quan cộng thẳng từ bảng này.'));
  toolbarHost = el('div', { class: 'toolbar' });
  card.appendChild(toolbarHost);
  listHost = el('div', {});
  card.appendChild(listHost);
  mount.appendChild(card);

  // gõ xong một ô thì chỉ ghi nhận vào bộ nhớ — lên server khi bấm Lưu
  mount.addEventListener('change', function(e){
    const inp = e.target.closest && e.target.closest('[data-exp]');
    if(!inp) return;
    const id = inp.dataset.exp, f = inp.dataset.field;
    const patch = {};
    if(f === 'amount'){
      const raw = inp.value.replace(/[^\d.\-]/g, '').trim();
      patch.amount = raw === '' ? 0 : Number(raw);
    }
    else if(f === 'spend_date') patch.spend_date = inp.value || null;
    else patch[f] = inp.value;
    stageExpense(id, patch);
  });
  mount.addEventListener('keydown', function(e){
    const inp = e.target.closest && e.target.closest('input.amt-in');
    if(inp && e.key === 'Enter'){ e.preventDefault(); inp.blur(); }
  });

  mount.addEventListener('click', function(e){
    const t = e.target.closest && e.target.closest('[data-act]');
    if(!t) return;
    const act = t.getAttribute('data-act');
    if(act === 'add-exp'){
      addExpenseDialog();
    } else if(act === 'pick-date'){
      // chọn ngày bằng lịch; cũng như các ô gõ tay, chỉ ghi nhận tạm cho tới khi bấm Lưu
      const id = t.dataset.exp;
      openDatePopover(t, {
        value: t.dataset.date || null, allowEmpty: true, emptyLabel: 'Bỏ ngày',
        onPick: function(iso){ stageExpense(id, { spend_date: iso }); }
      });
    } else if(act === 'del-exp'){
      const row = getExpenses().filter(function(x){ return x.id === t.dataset.exp; })[0];
      if(!row) return;
      const what = [row.spend_date ? fmtDate(row.spend_date) : '', row.description || row.category || '']
        .filter(Boolean).join(' · ');
      confirmDialog({
        title: 'Xoá khoản chi này?',
        message: (what ? what + ' — ' : '') + fmt(row.amount) + '. Không khôi phục lại được.',
        confirmLabel: 'Xoá hẳn', danger: true
      }).then(function(ok){ if(ok) deleteExpense(row.id); });
    } else if(act === 'save'){
      saveAll();
    } else if(act === 'discard'){
      confirmDialog({
        title: 'Bỏ thay đổi chưa lưu?',
        message: 'Có ' + pendingCount() + ' thay đổi chưa lưu. Bỏ đi thì các ô quay về số liệu đang có trên máy chủ.',
        confirmLabel: 'Bỏ thay đổi', cancelLabel: 'Giữ lại', danger: true
      }).then(function(ok){ if(ok) discardChanges(); });
    }
  });

  onChange(render);
  render();
}

function render(){
  if(!listHost) return;
  keepFocus(mountRef, draw);
}

// Nhóm đang dùng nhiều nhất làm gợi ý sẵn, đỡ phải gõ lại mỗi lần
function usualCategory(){
  const count = {};
  let best = 'Chi Nhậu', top = 0;
  getExpenses().forEach(function(e){
    const c = (e.category || '').trim();
    if(!c) return;
    count[c] = (count[c] || 0) + 1;
    if(count[c] > top){ top = count[c]; best = c; }
  });
  return best;
}

function addExpenseDialog(){
  openForm({
    title: 'Thêm khoản chi', submitLabel: 'Thêm khoản chi',
    fields: [
      { name: 'amount', label: 'Số tiền đã chi', type: 'amount', required: true, placeholder: 'vd. 2500',
        hint: 'Gõ số dương là được — trang tự ghi thành khoản chi (số âm).' },
      { name: 'description', label: 'Nội dung', placeholder: 'vd. nhậu, rượu, nước…' },
      { name: 'category', label: 'Nhóm', value: usualCategory() },
      { name: 'date', label: 'Ngày chi', type: 'date', value: todayISO(), required: true,
        requiredMsg: 'Chọn một ngày trên lịch.' }
    ]
  }).then(function(r){
    if(!r || r.action !== 'submit') return;
    addExpense({
      spend_date: r.values.date, category: r.values.category || usualCategory(),
      description: r.values.description, amount: -Math.abs(r.values.amount)
    });
  });
}

function draw(){
  const rows = getExpenses(), editable = getCanEdit();

  if(editable){
    const n = pendingCount();
    toolbarHost.innerHTML =
      '<button type="button" class="chip" data-act="add-exp">+ Thêm khoản chi</button>' +
      '<span class="tb-gap"></span>' +
      '<button type="button" class="chip save" data-act="save"' + (n ? '' : ' disabled') + '>' +
        (n ? '💾 Lưu ' + n + ' thay đổi' : '💾 Đã lưu') + '</button>' +
      (n ? '<button type="button" class="chip" data-act="discard">Huỷ thay đổi</button>' : '');
  } else {
    toolbarHost.innerHTML = '';
  }

  let html = '<thead><tr><th>Ngày</th><th>Nhóm</th><th>Nội dung</th><th class="num-col">Số tiền</th>' +
    (editable ? '<th></th>' : '') + '</tr></thead><tbody>';

  rows.forEach(function(r){
    if(editable){
      const d = isExpenseDirty(r.id) ? ' dirty' : '';
      html += '<tr>' +
        '<td><button type="button" class="date-btn' + d + (r.spend_date ? '' : ' empty') + '" data-act="pick-date" data-exp="' + r.id +
          '" data-date="' + (r.spend_date || '') + '" aria-haspopup="dialog" title="Bấm để chọn ngày">' + CAL_ICON +
          '<span>' + (r.spend_date ? fmtDate(r.spend_date) : 'Chọn ngày') + '</span></button></td>' +
        '<td><input type="text" class="w-sm' + d + '" data-exp="' + r.id + '" data-field="category" value="' + esc(r.category || '') + '"></td>' +
        '<td><input type="text" class="' + d.trim() + '" data-exp="' + r.id + '" data-field="description" value="' + esc(r.description || '') + '"></td>' +
        '<td class="num-col"><input type="text" inputmode="decimal" autocomplete="off" class="amt-in' + d + '" data-exp="' + r.id + '" data-field="amount" value="' + (r.amount === null ? '' : r.amount) + '"></td>' +
        '<td><button type="button" class="row-del" data-act="del-exp" data-exp="' + r.id + '" title="Xoá">×</button></td>' +
        '</tr>';
    } else {
      html += '<tr><td>' + (r.spend_date ? fmtDate(r.spend_date) : '—') + '</td>' +
        '<td>' + esc(r.category || '') + '</td>' +
        '<td>' + esc(r.description || '') + '</td>' +
        '<td class="num-col">' + amountSpan(r.amount) + '</td></tr>';
    }
  });
  if(!rows.length){
    html += '<tr><td colspan="' + (editable ? 5 : 4) + '" class="center ink-3">Chưa có khoản chi nào.</td></tr>';
  }
  html += '</tbody><tfoot><tr><td colspan="3">Tổng chi</td>' +
    '<td class="num-col num">' + fmt(totalChi()) + '</td>' + (editable ? '<td></td>' : '') + '</tr></tfoot>';

  const table = el('table', {});
  table.innerHTML = html;
  const scroll = el('div', { class: 'table-scroll' });
  scroll.appendChild(table);
  listHost.innerHTML = '';
  listHost.appendChild(scroll);
}
