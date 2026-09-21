// Các hàm tiện ích dùng chung: định dạng số, escape HTML, dựng phần tử DOM, bảng có thể sắp xếp.

export function fmt(n){
  if(n===null||n===undefined||n==='') return '—';
  var num = Number(n);
  if(isNaN(num)) return String(n);
  return num.toLocaleString('vi-VN');
}

export function amountSpan(n){
  if(n===null||n===undefined||n==='') return '<span class="ink-3">—</span>';
  var num = Number(n);
  var cls = num < 0 ? 'neg' : (num > 0 ? 'pos' : '');
  var sign = num > 0 ? '+' : '';
  return '<span class="num amount '+cls+'">'+sign+fmt(num)+'</span>';
}

export function statusPill(v){
  if(v==='o') return '<span class="pill good">✓ o</span>';
  if(v==='x') return '<span class="pill bad">✕ x</span>';
  if(v===null||v===undefined||v==='') return '<span class="pill muted">—</span>';
  return '<span class="pill muted">'+esc(v)+'</span>';
}

export function groupPill(v){
  if(v==='Thu') return '<span class="pill good">Thu</span>';
  if(v==='Chi Nhậu') return '<span class="pill bad">Chi Nhậu</span>';
  return esc(v||'—');
}

// '2026-05-16' (kiểu Postgres) -> '16/05/2026'
export function fmtDate(iso){
  if(!iso) return '';
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(iso);
}

export function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

export function el(tag, attrs, html){
  var e = document.createElement(tag);
  if(attrs) for(var k in attrs){ if(attrs[k]!==null && attrs[k]!==undefined) e.setAttribute(k, attrs[k]); }
  if(html !== undefined) e.innerHTML = html;
  return e;
}

export function cycleStatus(v){
  if(v==='o') return 'x';
  if(v==='x') return null;
  return 'o';
}

// bảng có thể bấm tiêu đề cột để sắp xếp — dùng cho tab "Chi tiêu"
export function sortableTable(headers, rows, colTypes, renderCell, opts){
  opts = opts || {};
  var state = {col: opts.defaultSort!==undefined?opts.defaultSort:0, dir: opts.defaultDir||1};
  var scroll = el('div',{class:'table-scroll'});
  var table = el('table',{});
  scroll.appendChild(table);

  function render(){
    var sorted = rows.slice();
    if(state.col!==null){
      sorted.sort(function(a,b){
        var av=a[state.col], bv=b[state.col];
        if(av===null||av===undefined) av = colTypes[state.col]==='num'?-Infinity:'';
        if(bv===null||bv===undefined) bv = colTypes[state.col]==='num'?-Infinity:'';
        if(colTypes[state.col]==='num') return (av-bv)*state.dir;
        if(colTypes[state.col]==='date'){
          var pa=String(av).split('/').reverse().join(''), pb=String(bv).split('/').reverse().join('');
          return pa<pb?-1*state.dir:pa>pb?1*state.dir:0;
        }
        return String(av).localeCompare(String(bv))*state.dir;
      });
    }
    var thead = '<thead><tr>'+headers.map(function(hd,i){
      var cls = colTypes[i]==='num'?'num-col ':'';
      var sortable = opts.sortableCols ? opts.sortableCols.indexOf(i)>-1 : true;
      var arrow = state.col===i ? '<span class="arrow">'+(state.dir===1?'▲':'▼')+'</span>' : '';
      return '<th class="'+cls+(sortable?'sortable':'')+'" data-col="'+i+'">'+esc(hd)+arrow+'</th>';
    }).join('')+'</tr></thead>';
    var tbody = '<tbody>'+sorted.map(function(r){
      return '<tr>'+r.map(function(v,i){ return renderCell(v,i,r); }).join('')+'</tr>';
    }).join('')+'</tbody>';
    table.innerHTML = thead+tbody;
    table.querySelectorAll('th.sortable').forEach(function(th){
      th.addEventListener('click', function(){
        var c = Number(th.getAttribute('data-col'));
        if(state.col===c){ state.dir *= -1; } else { state.col=c; state.dir=1; }
        render();
      });
    });
  }
  render();
  return scroll;
}
