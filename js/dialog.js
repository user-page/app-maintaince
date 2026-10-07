// Hộp thoại thêm / sửa / xác nhận — thay cho prompt() và confirm() của trình duyệt.
// Dựa trên thẻ <dialog>: tự giữ con trỏ bàn phím bên trong, Esc để đóng, nền phía sau bị khoá.
import { el, esc, fmtDate } from './utils.js';
import { buildCalendar, closeDatePopover } from './datepicker.js';

const DAY_NAMES = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
let seq = 0;

function longDate(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return '';
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return DAY_NAMES[dt.getDay()] + ', ' + fmtDate(iso);
}

function mount(dlg){
  document.body.appendChild(dlg);
  if(typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');           // trình duyệt quá cũ: vẫn hiện, chỉ thiếu khoá nền
}

function wireClose(dlg, finish){
  // bấm ra vùng nền tối quanh hộp thoại thì đóng
  dlg.addEventListener('mousedown', function(e){ if(e.target === dlg) finish(null); });
  dlg.addEventListener('cancel', function(e){ e.preventDefault(); finish(null); });   // phím Esc
}

// cfg: {
//   title, submitLabel,
//   fields: [{ name, label, type: 'text' | 'amount' | 'date', value, placeholder, hint, required,
//              allowEmpty, emptyLabel }],
//   danger: { label, message, confirmLabel }      // nút xoá, có bước hỏi lại ngay trong hộp thoại
// }
// Trả về Promise: { action: 'submit', values } | { action: 'delete' } | null (đã huỷ)
export function openForm(cfg){
  return new Promise(function(resolve){
    const uid = 'dlg' + (++seq);
    const dlg = el('dialog', { class: 'dlg', 'aria-labelledby': uid + '-t' });
    const calendars = {};
    let done = false;

    let body = '';
    cfg.fields.forEach(function(f){
      const id = uid + '-' + f.name;
      body += '<div class="dlg-field" data-field="' + f.name + '">';
      if(f.type === 'date'){
        body += '<span class="dlg-label" id="' + id + '-l">' + esc(f.label) + '</span>' +
          '<div class="dlg-date-now" id="' + id + '-now"></div>' +
          '<div class="dlg-cal" id="' + id + '-cal" role="group" aria-labelledby="' + id + '-l"></div>';
      } else {
        body += '<label class="dlg-label" for="' + id + '">' + esc(f.label) + '</label>' +
          '<input id="' + id + '" name="' + f.name + '" type="text" autocomplete="off"' +
          (f.type === 'amount' ? ' inputmode="decimal" class="num"' : '') +
          ' value="' + esc(f.value === null || f.value === undefined ? '' : f.value) + '"' +
          (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
      }
      if(f.hint) body += '<div class="dlg-hint">' + esc(f.hint) + '</div>';
      body += '<div class="dlg-err" role="alert"></div></div>';
    });

    dlg.innerHTML =
      '<form class="dlg-form" novalidate>' +
        '<header class="dlg-head"><h3 id="' + uid + '-t">' + esc(cfg.title) + '</h3></header>' +
        '<div class="dlg-body">' + body + '</div>' +
        '<footer class="dlg-foot">' +
          (cfg.danger ? '<button type="button" class="btn danger-ghost" data-role="ask-delete">' + esc(cfg.danger.label) + '</button>' : '') +
          '<span class="tb-gap"></span>' +
          '<button type="button" class="btn ghost" data-role="cancel">Huỷ</button>' +
          '<button type="submit" class="btn primary">' + esc(cfg.submitLabel || 'Lưu') + '</button>' +
        '</footer>' +
        (cfg.danger
          ? '<div class="dlg-confirm" hidden>' +
              '<p>' + esc(cfg.danger.message) + '</p>' +
              '<div class="dlg-foot">' +
                '<span class="tb-gap"></span>' +
                '<button type="button" class="btn ghost" data-role="back">Quay lại</button>' +
                '<button type="button" class="btn danger" data-role="delete">' + esc(cfg.danger.confirmLabel || 'Xoá hẳn') + '</button>' +
              '</div></div>'
          : '') +
      '</form>';

    // gắn lịch vào các ô ngày
    cfg.fields.forEach(function(f){
      if(f.type !== 'date') return;
      const id = uid + '-' + f.name;
      const now = dlg.querySelector('#' + id + '-now');
      function show(iso){
        now.textContent = iso ? longDate(iso) : (f.emptyLabel || 'Chưa chọn ngày');
        now.classList.toggle('empty', !iso);
      }
      const cal = buildCalendar({
        value: f.value || null, allowEmpty: !!f.allowEmpty, emptyLabel: f.emptyLabel,
        onPick: function(iso){
          show(iso);
          const box = dlg.querySelector('.dlg-field[data-field="' + f.name + '"]');
          if(iso && box.classList.contains('bad')){
            box.classList.remove('bad');
            box.querySelector('.dlg-err').textContent = '';
          }
        }
      });
      dlg.querySelector('#' + id + '-cal').appendChild(cal.el);
      calendars[f.name] = cal;
      show(cal.getValue());
    });

    function finish(result){
      if(done) return;
      done = true;
      closeDatePopover();
      if(dlg.open && typeof dlg.close === 'function') dlg.close();
      dlg.remove();
      resolve(result);
    }

    function collect(){
      const values = {};
      cfg.fields.forEach(function(f){
        if(f.type === 'date'){ values[f.name] = calendars[f.name].getValue(); return; }
        const raw = dlg.querySelector('[name="' + f.name + '"]').value.trim();
        if(f.type === 'amount'){
          const cleaned = raw.replace(/[^\d.\-]/g, '');
          values[f.name] = cleaned === '' || isNaN(Number(cleaned)) ? null : Number(cleaned);
        } else {
          values[f.name] = raw;
        }
      });
      return values;
    }

    function validate(values){
      let firstBad = null;
      cfg.fields.forEach(function(f){
        const box = dlg.querySelector('.dlg-field[data-field="' + f.name + '"]');
        const v = values[f.name];
        const missing = f.required && (v === null || v === undefined || v === '');
        box.classList.toggle('bad', missing);
        box.querySelector('.dlg-err').textContent = missing ? (f.requiredMsg || 'Chưa điền mục này.') : '';
        if(missing && !firstBad) firstBad = box;
      });
      if(firstBad){
        const inp = firstBad.querySelector('input') || firstBad.querySelector('.cal-day[tabindex="0"]');
        if(inp) inp.focus();
      }
      return !firstBad;
    }

    // gõ vào là xoá luôn dòng báo lỗi của ô đó, đừng để nó nằm lại khi đã sửa
    dlg.addEventListener('input', function(e){
      const box = e.target.closest && e.target.closest('.dlg-field');
      if(!box || !box.classList.contains('bad')) return;
      box.classList.remove('bad');
      box.querySelector('.dlg-err').textContent = '';
    });

    dlg.querySelector('form').addEventListener('submit', function(e){
      e.preventDefault();
      const values = collect();
      if(validate(values)) finish({ action: 'submit', values: values });
    });

    dlg.addEventListener('click', function(e){
      const b = e.target.closest('[data-role]');
      if(!b) return;
      const role = b.getAttribute('data-role');
      const panel = dlg.querySelector('.dlg-confirm');
      if(role === 'cancel') finish(null);
      else if(role === 'delete') finish({ action: 'delete' });
      else if(role === 'ask-delete' || role === 'back'){
        const asking = role === 'ask-delete';
        dlg.querySelector('.dlg-body').hidden = asking;
        dlg.querySelector('form > .dlg-foot').hidden = asking;
        panel.hidden = !asking;
        // mặc định đặt con trỏ vào "Quay lại" — lỡ tay nhấn Enter cũng không xoá mất
        (asking ? panel.querySelector('[data-role="back"]') : dlg.querySelector('[data-role="ask-delete"]')).focus();
      }
    });

    wireClose(dlg, finish);
    mount(dlg);

    const first = dlg.querySelector('.dlg-body input');
    if(first){ first.focus(); first.select(); }
  });
}

// Hỏi lại trước một việc không hoàn tác được. Trả về Promise<boolean>.
// cfg: { title, message, confirmLabel, cancelLabel, danger }
export function confirmDialog(cfg){
  return new Promise(function(resolve){
    const uid = 'dlg' + (++seq);
    const dlg = el('dialog', { class: 'dlg dlg-small', 'aria-labelledby': uid + '-t', 'aria-describedby': uid + '-m' });
    let done = false;
    dlg.innerHTML =
      '<div class="dlg-form">' +
        '<header class="dlg-head"><h3 id="' + uid + '-t">' + esc(cfg.title) + '</h3></header>' +
        '<div class="dlg-body"><p id="' + uid + '-m">' + esc(cfg.message) + '</p></div>' +
        '<footer class="dlg-foot"><span class="tb-gap"></span>' +
          '<button type="button" class="btn ghost" data-role="no">' + esc(cfg.cancelLabel || 'Huỷ') + '</button>' +
          '<button type="button" class="btn ' + (cfg.danger ? 'danger' : 'primary') + '" data-role="yes">' +
            esc(cfg.confirmLabel || 'Đồng ý') + '</button>' +
        '</footer></div>';

    function finish(v){
      if(done) return;
      done = true;
      if(dlg.open && typeof dlg.close === 'function') dlg.close();
      dlg.remove();
      resolve(v === true);
    }
    dlg.addEventListener('click', function(e){
      const b = e.target.closest('[data-role]');
      if(b) finish(b.getAttribute('data-role') === 'yes');
    });
    wireClose(dlg, finish);
    mount(dlg);
    dlg.querySelector('[data-role="no"]').focus();
  });
}
