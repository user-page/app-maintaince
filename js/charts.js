// Biểu đồ cột Thu/Chi vẽ tay bằng SVG (không cần thư viện ngoài).
import { fmt, esc, el } from './utils.js';

export function buildBarChart(dates, thuMap, chiMap){
  // Khung vẽ rộng theo số đợt, mỗi đợt một khoảng cố định. Nhờ vậy chữ trên biểu đồ
  // giữ nguyên cỡ dù có bao nhiêu đợt; trên điện thoại thì cuộn ngang như các bảng,
  // còn hơn là thu nhỏ đến mức không đọc được.
  var n0 = Math.max(dates.length, 1);
  var padL = 46, padB = 32, padT = 8, padR = 12;
  var w = Math.max(360, padL + padR + n0 * 92), h = 216;
  var n = n0;
  var maxVal = 1;
  dates.forEach(function(d){ maxVal = Math.max(maxVal, thuMap[d]||0, chiMap[d]||0); });
  maxVal = Math.ceil(maxVal/500)*500;
  var groupW = (w - padL - padR) / n;
  var barW = Math.min(24, groupW*0.3);
  var scaleY = (h - padT - padB) / maxVal;

  var svg = '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Biểu đồ thu chi theo đợt" ' +
    'style="display:block;width:'+w+'px;height:auto;margin:0 auto">';
  var steps = 4;
  for(var s=0;s<=steps;s++){
    var val = maxVal/steps*s;
    var y = h - padB - val*scaleY;
    svg += '<line x1="'+padL+'" y1="'+y+'" x2="'+(w-padR)+'" y2="'+y+'" stroke="var(--line)" stroke-width="1"/>';
    svg += '<text x="'+(padL-8)+'" y="'+(y+3)+'" text-anchor="end" font-size="11" fill="var(--ink-2)" font-family="IBM Plex Mono, monospace">'+fmt(val)+'</text>';
  }
  dates.forEach(function(d, i){
    var cx = padL + groupW*i + groupW/2;
    var thuV = thuMap[d]||0, chiV = chiMap[d]||0;
    var xThu = cx - barW - 2, xChi = cx + 2;
    var yThu = h - padB - thuV*scaleY, yChi = h - padB - chiV*scaleY;
    svg += '<rect x="'+xThu+'" y="'+yThu+'" width="'+barW+'" height="'+(thuV*scaleY)+'" rx="2" fill="var(--good)"/>';
    svg += '<rect x="'+xChi+'" y="'+yChi+'" width="'+barW+'" height="'+(chiV*scaleY)+'" rx="2" fill="var(--bad)"/>';
    svg += '<text x="'+cx+'" y="'+(h-padB+16)+'" text-anchor="middle" font-size="11.5" fill="var(--ink-2)" font-family="Public Sans, sans-serif">'+esc(d.slice(0,5))+'</text>';
  });
  svg += '<line x1="'+padL+'" y1="'+(h-padB)+'" x2="'+(w-padR)+'" y2="'+(h-padB)+'" stroke="var(--ink-3)" stroke-width="1"/>';
  svg += '</svg>';
  var box = el('div', { class: 'chart-scroll' }, svg);
  return box;
}
