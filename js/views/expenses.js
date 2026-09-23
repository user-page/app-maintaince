// Tab "Chi tiêu" — thêm / sửa / xoá được từng khoản chi.
// Tổng chi và Chênh lệch ở các tab khác cộng thẳng từ đây nên đổi ở đây là mọi nơi đổi theo.
import { el, esc, fmt, amountSpan, fmtDate, keepFocus } from '../utils.js';
import {
  getExpenses, getCanEdit, totalChi, addExpense, deleteExpense, onChange,
  stageExpense, isExpenseDirty, pendingCount, saveAll, discardChanges
} from '../dataStore.js';

let listHost = null, toolbarHost = null, mountRef = null;

export function buildExpenses(mount){
  mountRef = mount;
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, 'Chi tiêu'));
  card.appendChild(el('div', { class: 'desc' },
    'Các khoản đã chi — ngày, nội dung (nhậu, rượu, nước…) và số tiền (ghi số âm). ' +
    'Gõ xong bấm <strong>Lưu</strong>; ô chưa lưu có viền vàng. Tổng chi và Chênh lệch ở tab Tổng quan cộng thẳng từ bảng này.'));
  toolbarHost = el('div', { class: 'toolbar' });
  card.appendChild(toolbarHost);
  listHost = el('div', {});
  card.appendChild(listHost);
  mount.appendChild(card);

  // gõ xong một ô thì chỉ ghi nhận vào bộ nhớ — lên server khi bấm Lưu
  mount.addEventListener('change', function(e){
    const inp = e.target.closest && e.target.closest('[data-exp]');
    if(!inp) return;
    const id = Number(inp.dataset.exp), f = inp.dataset.field;
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
      addExpense({ spend_date: new Date().toISOString().slice(0, 10), category: 'Chi Nhậu', description: '', amount: 0 });
    } else if(act === 'del-exp'){
      const row = t.closest('tr');
      const what = row ? (row.querySelector('[data-field="description"]') || {}).value || '' : '';
      if(confirm('Xoá khoản chi "' + what + '"? Không khôi phục lại được.'))
        deleteExpense(Number(t.dataset.exp));
    } else if(act === 'save'){
      saveAll();
    } else if(act === 'discard'){
      if(confirm('Bỏ ' + pendingCount() + ' thay đổi chưa lưu và lấy lại số liệu trên máy chủ?'))
        discardChanges();
    }
  });

  onChange(render);
  render();
}

function render(){
  if(!listHost) return;
  keepFocus(mountRef, draw);
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
        '<td><input type="date" class="' + d.trim() + '" data-exp="' + r.id + '" data-field="spend_date" value="' + (r.spend_date || '') + '"></td>' +
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
