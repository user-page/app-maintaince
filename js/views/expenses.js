// Tab "Chi tiêu" — danh sách chi tiêu từng buổi, bấm tiêu đề cột để sắp xếp.
import { el, esc, amountSpan, groupPill, sortableTable } from '../utils.js';

export function buildExpenses(host, ee){
  const card = el('div',{class:'card'});
  card.appendChild(el('h2',{}, 'Chi tiêu các buổi · Event Expenses'));
  card.appendChild(el('div',{class:'desc'}, 'Danh sách các khoản chi cho từng buổi, theo sheet Event Expenses.'));
  const headers = ['No','Ngày','Nhóm','Khoản chi','Số tiền'];
  const colTypes = ['num','date','text','text','num'];
  const t = sortableTable(headers, ee.rows, colTypes, function(v,i){
    if(i===0) return '<td class="num num-col">'+esc(v)+'</td>';
    if(i===2) return '<td>'+groupPill(v)+'</td>';
    if(i===4) return '<td class="num-col">'+amountSpan(v)+'</td>';
    return '<td>'+esc(v)+'</td>';
  }, {defaultSort:1, defaultDir:1});
  card.appendChild(t);
  card.appendChild(el('div',{style:'margin-top:12px;font-size:13px'}, 'Tổng chi: '+amountSpan(ee.total)));
  host.appendChild(card);
}
