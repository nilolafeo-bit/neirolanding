/* ═══════════════════════════════════════════════════════════════════════
   paths-field.js — «поле приводки»

   Портирован на чистый JS с React-компонента background-paths (21st.dev).
   Сохранена вся геометрия оригинала: 36 кривых в семействе, тот же вывод
   пути от индекса, та же нарастающая толщина 0.5 + i*0.03 и непрозрачность
   0.1 + i*0.03, два зеркальных семейства (position 1 и -1), бесконечный
   линейный проход длительностью 20-30 секунд у каждой кривой своей.

   Отличия от оригинала, каждое по делу:
   · Анимация не на framer-motion, а на штриховом пунктире. pathLength и
     pathOffset в исходнике и так компилируются в stroke-dasharray и
     stroke-dashoffset — здесь они заданы напрямую, поэтому кадры считает
     композитор, а не JavaScript.
   · Семейства печатаются разными красками: одно бумагой, другое пурпуром.
     В оригинале обе стопки одного цвета; здесь это две печатные формы,
     сведённые с небольшим сдвигом, — приводка, а не подложка.
   · Заголовок собирается по буквам той же лесенкой задержек, но без
     градиентной заливки текста: в этой системе насыщенность даёт вес, а
     не переход цвета.

   Разметка: <div class="paths" data-paths-field></div>
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var COUNT = 36;          // кривых в одном семействе — как в оригинале
  var VIEWBOX = '0 0 696 316';

  function familyPath(i, position) {
    // Формула оригинала слово в слово: одна кривая Безье, чьи опорные точки
    // разъезжаются по индексу, отчего стопка веером расходится по кадру.
    var a = 380 - i * 5 * position;
    var b = 189 + i * 6;
    var c = 312 - i * 5 * position;
    var d = 216 - i * 6;
    var e = 152 - i * 5 * position;
    var f = 343 - i * 6;
    var g = 616 - i * 5 * position;
    var h = 470 - i * 6;
    var k = 684 - i * 5 * position;
    var l = 875 - i * 6;
    return 'M-' + a + ' -' + b + 'C-' + a + ' -' + b + ' -' + c + ' ' + d + ' ' +
           e + ' ' + f + 'C' + g + ' ' + h + ' ' + k + ' ' + l + ' ' + k + ' ' + l;
  }

  function family(position, tone) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', VIEWBOX);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.className.baseVal = 'paths-plate paths-plate--' + tone;

    for (var i = 0; i < COUNT; i++) {
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', familyPath(i, position));
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', (0.5 + i * 0.03).toFixed(2));
      // Нормируем длину, чтобы пунктир считался в долях пути, а не в пикселях
      p.setAttribute('pathLength', '1');
      p.style.strokeOpacity = (0.1 + i * 0.03).toFixed(3);
      // У каждой кривой свой ход — иначе всё поле дышало бы в такт
      p.style.animationDuration = (20 + Math.random() * 10).toFixed(1) + 's';
      p.style.animationDelay = (-Math.random() * 20).toFixed(1) + 's';
      svg.appendChild(p);
    }
    return svg;
  }

  function init() {
    var hosts = document.querySelectorAll('[data-paths-field]');
    for (var i = 0; i < hosts.length; i++) {
      hosts[i].appendChild(family(1, 'paper'));
      hosts[i].appendChild(family(-1, 'ink'));
    }

    // Заголовок собирается по буквам: та же лесенка, что в оригинале —
    // слово даёт шаг 0.1с, буква внутри слова ещё 0.03с.
    var titles = document.querySelectorAll('[data-paths-title]');
    for (var t = 0; t < titles.length; t++) {
      var el = titles[t];
      var words = (el.textContent || '').trim().split(/\s+/);
      el.textContent = '';
      for (var w = 0; w < words.length; w++) {
        var word = document.createElement('span');
        word.className = 'paths-word';
        for (var c = 0; c < words[w].length; c++) {
          var mask = document.createElement('span');
          mask.className = 'paths-letter';
          var inner = document.createElement('span');
          inner.textContent = words[w][c];
          inner.style.animationDelay = (w * 100 + c * 30) + 'ms';
          mask.appendChild(inner);
          word.appendChild(mask);
        }
        el.appendChild(word);
        if (w < words.length - 1) el.appendChild(document.createTextNode(' '));
      }
      el.classList.add('is-set');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
