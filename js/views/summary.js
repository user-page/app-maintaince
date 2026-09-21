// Tab "Đóng góp" — tổng số tiền mỗi người đã đóng, sắp xếp giảm dần.
import { el, esc, fmt } from '../utils.js';

export function buildSummary(host, fs){
  const card = el('div',{class:'card'});
  card.appendChild(el('h2',{}, 'Tổng hợp đóng góp · Fund Summary'));
  card.appendChild(el('div',{class:'desc'}, 'Tổng số tiền mỗi thành viên đã đóng, sắp xếp giảm dần.'));
  const rows = fs.rows.slice().sort(function(a,b){return b[1]-a[1];});
  const max = rows.length ? rows[0][1] : 1;
  const list = el('div',{class:'bar-list'});
  rows.forEach(function(r){
    const pct = max>0 ? (r[1]/max*100) : 0;
    const fillCls = r[1]===0 ? 'fill zero' : 'fill';
    list.appendChild(el('div',{class:'bar-row'},
      '<span class="name">'+esc(r[0])+'</span>'+
      '<span class="track"><span class="'+fillCls+'" style="width:'+Math.max(pct,r[1]===0?0:2)+'%"></span></span>'+
      '<span class="amt num">'+fmt(r[1])+'</span>'));
  });
  card.appendChild(list);
  host.appendChild(card);
}
