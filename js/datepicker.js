// Lịch chọn ngày — bấm vào ngày để chọn, không phải gõ.
// Dùng ở hai chỗ: nằm sẵn trong hộp thoại thêm/sửa (buildCalendar), và bật ra cạnh một ô
// trong bảng (openDatePopover). Giá trị luôn là chuỗi 'YYYY-MM-DD' hoặc null.
import { el, fmtDate, todayISO } from './utils.js';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];   // tuần bắt đầu từ thứ Hai

function pad(n){ return (n < 10 ? '0' : '') + n; }
function toISO(y, m, d){ return y + '-' + pad(m + 1) + '-' + pad(d); }

function parseISO(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

function shiftDays(iso, n){
  const p = parseISO(iso);
  const dt = new Date(p.y, p.m, p.d + n);
  return toISO(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function shiftMonths(iso, n){
  const p = parseISO(iso);
  const last = new Date(p.y, p.m + n + 1, 0).getDate();      // số ngày của tháng đích
  const dt = new Date(p.y, p.m + n, Math.min(p.d, last));
  return toISO(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

// opts: { value, allowEmpty, emptyLabel, onPick(iso|null) }
// Trả về { el, getValue(), setValue(iso|null), focus() }
export function buildCalendar(opts){
  opts = opts || {};
  let value = parseISO(opts.value) ? opts.value : null;
  const today = todayISO();
  let cursor = value || today;          // ngày đang được bàn phím trỏ tới; cũng quyết định tháng hiển thị

  const root = el('div', { class: 'cal' });

  function draw(){
    const c = parseISO(cursor);
    const lead = (new Date(c.y, c.m, 1).getDay() + 6) % 7;   // số ô trống trước ngày 1
    let html =
      '<div class="cal-head">' +
        '<button type="button" class="cal-nav" data-nav="-1" aria-label="Tháng trước">‹</button>' +
        '<div class="cal-title" aria-live="polite">Tháng ' + (c.m + 1) + ', ' + c.y + '</div>' +
        '<button type="button" class="cal-nav" data-nav="1" aria-label="Tháng sau">›</button>' +
      '</div><div class="cal-grid">';
    WEEKDAYS.forEach(function(w){ html += '<span class="cal-wd">' + w + '</span>'; });

    // luôn vẽ đủ 6 tuần để lịch không đổi chiều cao khi chuyển tháng
    for(let i = 0; i < 42; i++){
      const dt = new Date(c.y, c.m, 1 - lead + i);
      const iso = toISO(dt.getFullYear(), dt.getMonth(), dt.getDate());
      const cls = 'cal-day' + (dt.getMonth() !== c.m ? ' out' : '') +
        (iso === today ? ' today' : '') + (iso === value ? ' sel' : '');
      html += '<button type="button" class="' + cls + '" data-iso="' + iso + '"' +
        ' tabindex="' + (iso === cursor ? '0' : '-1') + '"' +
        ' aria-label="' + fmtDate(iso) + (iso === today ? ' (hôm nay)' : '') + '"' +
        ' aria-pressed="' + (iso === value ? 'true' : 'false') + '">' + dt.getDate() + '</button>';
    }
    html += '</div><div class="cal-foot">' +
      '<button type="button" class="cal-link" data-pick="today">Hôm nay</button>' +
      (opts.allowEmpty
        ? '<button type="button" class="cal-link" data-pick="none">' + (opts.emptyLabel || 'Bỏ ngày') + '</button>'
        : '') +
      '</div>';
    root.innerHTML = html;
  }

  function focusCursor(){
    const b = root.querySelector('.cal-day[data-iso="' + cursor + '"]');
    if(b) b.focus({ preventScroll: true });
  }

  function pick(iso){
    value = iso;
    if(iso) cursor = iso;
    draw();
    if(opts.onPick) opts.onPick(value);
  }

  root.addEventListener('click', function(e){
    const nav = e.target.closest('[data-nav]');
    if(nav){
      cursor = shiftMonths(cursor, Number(nav.getAttribute('data-nav')));
      draw();
      // giữ con trỏ trên nút vừa bấm để bấm liên tiếp được
      const again = root.querySelector('[data-nav="' + nav.getAttribute('data-nav') + '"]');
      if(again) again.focus();
      return;
    }
    const day = e.target.closest('.cal-day');
    if(day){ pick(day.getAttribute('data-iso')); return; }
    const quick = e.target.closest('[data-pick]');
    if(quick) pick(quick.getAttribute('data-pick') === 'today' ? today : null);
  });

  // bàn phím: mũi tên đi từng ngày / từng tuần, PageUp-PageDown đi từng tháng
  root.addEventListener('keydown', function(e){
    if(!e.target.closest('.cal-day')) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if(step){ cursor = shiftDays(cursor, step); }
    else if(e.key === 'PageUp'){ cursor = shiftMonths(cursor, -1); }
    else if(e.key === 'PageDown'){ cursor = shiftMonths(cursor, 1); }
    else return;
    e.preventDefault();
    draw();
    focusCursor();
  });

  draw();
  return {
    el: root,
    getValue: function(){ return value; },
    setValue: function(iso){ value = parseISO(iso) ? iso : null; if(value) cursor = value; draw(); },
    focus: focusCursor
  };
}

// ---------- lịch bật ra cạnh một ô trong bảng ----------
let openPop = null;

export function closeDatePopover(){
  if(openPop){ const p = openPop; openPop = null; p.cleanup(); }
}

// anchor: phần tử vừa bấm. opts giống buildCalendar; onPick được gọi sau khi lịch đã đóng.
export function openDatePopover(anchor, opts){
  // bấm lại đúng ô đang mở lịch thì coi như đóng lại
  const wasSame = openPop && openPop.anchor === anchor;
  closeDatePopover();
  if(wasSame) return;
  opts = opts || {};

  const pop = el('div', { class: 'cal-pop', role: 'dialog', 'aria-label': 'Chọn ngày' });
  const cal = buildCalendar({
    value: opts.value, allowEmpty: opts.allowEmpty, emptyLabel: opts.emptyLabel,
    onPick: function(iso){
      closeDatePopover();
      if(opts.onPick) opts.onPick(iso);
    }
  });
  pop.appendChild(cal.el);

  // hộp thoại <dialog> nằm ở lớp trên cùng — lịch phải nằm trong nó thì mới bấm được
  (anchor.closest('dialog') || document.body).appendChild(pop);

  // Đặt lịch ngay dưới ô vừa bấm; không đủ chỗ thì bật lên trên. Luôn nằm gọn trong màn hình.
  function place(){
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(r.left, vw - w - 8));
    let top = r.bottom + 6;
    if(top + h > vh - 8) top = r.top - h - 6;
    top = Math.max(8, Math.min(top, vh - h - 8));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }
  place();

  function onDown(e){ if(!pop.contains(e.target) && !anchor.contains(e.target)) closeDatePopover(); }
  function onKey(e){
    if(e.key === 'Escape'){
      e.preventDefault(); e.stopPropagation();
      closeDatePopover();
      if(document.contains(anchor)) anchor.focus();
    }
  }
  // Cuộn trang hay xoay màn hình thì lịch đi theo ô của nó. Ô đó đã bị vẽ lại (không còn trên
  // trang) hoặc đã cuộn khuất hẳn thì đóng lịch.
  function onMove(e){
    if(e && e.target && e.target.nodeType === 1 && pop.contains(e.target)) return;
    if(!document.contains(anchor)){ closeDatePopover(); return; }
    const r = anchor.getBoundingClientRect();
    if(r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth){ closeDatePopover(); return; }
    place();
  }
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onMove, true);
  window.addEventListener('resize', onMove);

  openPop = {
    anchor: anchor,
    cleanup: function(){
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      pop.remove();
    }
  };
  cal.focus();
}
