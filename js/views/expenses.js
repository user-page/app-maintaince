// Tab "Chi tiêu" — thêm / sửa / xoá được từng khoản chi.
// Tổng chi và Chênh lệch ở các tab khác cộng thẳng từ đây nên đổi ở đây là mọi nơi đổi theo.
import { el, esc, fmt, amountSpan, fmtDate } from '../utils.js';
import {
  getExpenses, getCanEdit, totalChi, addExpense, updateExpense, deleteExpense, onChange
} from '../dataStore.js';

let listHost = null, toolbarHost = null, mountRef = null;

export function buildExpenses(mount){
  mountRef = mount;
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, 'Chi tiêu'));
  card.appendChild(el('div', { class: 'desc' },
    'Các khoản đã chi. Số tiền ghi số âm. Tổng chi và Chênh lệch ở tab Tổng quan cộng thẳng từ bảng này.'));
  toolbarHost = el('div', { class: 'toolbar' });
  card.appendChild(toolbarHost);
  listHost = el('div', {});
  card.appendChild(listHost);
  mount.appendChild(card);

  mount.addEventListener('change', function(e){
    const inp = e.target.closest && e.target.closest('[data-exp]');
    if(!inp) return;
    const id = Number(inp.dataset.exp), f = inp.dataset.field;
    const patch = {};
    if(f === 'amount') patch.amount = Number(inp.value) || 0;
    else if(f === 'spend_date') patch.spend_date = inp.value || null;
    else patch[f] = inp.value;
    updateExpense(id, patch);
  });

  mount.addEventListener('click', function(e){
    const t = e.target.closest && e.target.closest('[data-act]');
    if(!t) return;
    if(t.getAttribute('data-act') === 'add-exp'){
      addExpense({ spend_date: new Date().toISOString().slice(0, 10), category: 'Chi Nhậu', description: '', amount: 0 });
    } else if(t.getAttribute('data-act') === 'del-exp'){
      const row = t.closest('tr');
      const what = row ? (row.querySelector('[data-field="description"]') || {}).value || '' : '';
      if(confirm('Xoá khoản chi "' + what + '"? Không khôi phục lại được.'))
        deleteExpense(Number(t.dataset.exp));
    }
  });

  onChange(render);
  render();
}

function render(){
  if(!listHost) return;
  const rows = getExpenses(), editable = getCanEdit();

  toolbarHost.innerHTML = editable
    ? '<button type="button" class="chip" data-act="add-exp">+ Thêm khoản chi</button>' : '';

  let html = '<thead><tr><th>Ngày</th><th>Nhóm</th><th>Nội dung</th><th class="num-col">Số tiền</th>' +
    (editable ? '<th></th>' : '') + '</tr></thead><tbody>';

  rows.forEach(function(r){
    if(editable){
      html += '<tr>' +
        '<td><input type="date" data-exp="' + r.id + '" data-field="spend_date" value="' + (r.spend_date || '') + '"></td>' +
        '<td><input type="text" class="w-sm" data-exp="' + r.id + '" data-field="category" value="' + esc(r.category || '') + '"></td>' +
        '<td><input type="text" data-exp="' + r.id + '" data-field="description" value="' + esc(r.description || '') + '"></td>' +
        '<td class="num-col"><input type="number" class="amt-in" data-exp="' + r.id + '" data-field="amount" value="' + (r.amount === null ? '' : r.amount) + '"></td>' +
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
