/* ─────────────────────────────────────────────────────────────────
   NeiroLanding — общий клиентский JS
   ───────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // Приём заявок — form-relay на своём сервере в РФ.
  // Контракт: POST, тело JSON, ответ {ok:true}. Имена полей произвольные —
  // сервис печатает их в письмо как «ключ: значение», поэтому ключи русские.
  // Origin сайта прописан в allowedOrigins этого site_id на сервере,
  // иначе приёмник ответит 403 origin_not_allowed.
  const RELAY_URL = 'https://hooks.neirolanding.ru/api/submit/neirolanding';
  const METRIKA_ID = 108781023;

  function goal(name, params) {
    if (typeof window.ym === 'function') window.ym(METRIKA_ID, 'reachGoal', name, params);
  }

  // ─── Mobile menu toggle ──────────────────────────────────────────
  function initMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('mobile-menu');
    const nav = document.querySelector('.nl-nav');
    if (!toggle || !menu) return;

    function setOpen(open) {
      menu.classList.toggle('open', open);
      if (nav) nav.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // ─── Sticky nav shadow ───────────────────────────────────────────
  function initNavScroll() {
    const nav = document.querySelector('.nl-nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ─── Reveal on scroll ────────────────────────────────────────────
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );
    els.forEach((el) => io.observe(el));
  }

  // ─── FAQ accordion ───────────────────────────────────────────────
  function initFaq() {
    document.querySelectorAll('[data-faq]').forEach((item) => {
      const btn = item.querySelector('.faq-btn');
      if (!btn) return;

      btn.addEventListener('click', () => {
        const open = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  // ─── Toast helper ────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, isError) {
    const toast = document.getElementById('toast');
    if (!toast) {
      console[isError ? 'error' : 'log'](msg);
      return;
    }
    toast.textContent = msg;
    toast.classList.toggle('is-error', !!isError);
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toastTimer = null;
    }, 5000);
  }

  // ─── Form submission ─────────────────────────────────────────────
  function initForm() {
    const form = document.getElementById('order-form');
    if (!form) return;

    const REQUIRED = ['name', 'contact', 'business'];

    function fieldOf(id) {
      const input = document.getElementById(id);
      return { input: input, wrap: input ? input.closest('.field') : null };
    }

    function clearError(id) {
      const f = fieldOf(id);
      if (f.wrap) f.wrap.classList.remove('has-error');
      if (f.input) f.input.removeAttribute('aria-invalid');
    }

    function markError(id) {
      const f = fieldOf(id);
      if (f.wrap) f.wrap.classList.add('has-error');
      if (f.input) f.input.setAttribute('aria-invalid', 'true');
      return f.input;
    }

    REQUIRED.forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('input', () => clearError(id));
    });

    // Ловушка для ботов: человеку поле не видно и остаётся пустым, боты
    // заполняют всё подряд. Приёмник молча отбрасывает такие заявки.
    const honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = '_hp';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
    form.appendChild(honeypot);

    // В письмо должен уходить текст тарифа, а не служебный код вроде "optimal"
    function tariffLabel() {
      const select = document.getElementById('tariff');
      if (!select || !select.value) return 'не выбран';
      const option = select.options[select.selectedIndex];
      return option ? option.text.trim() : select.value;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const read = (id) => ((document.getElementById(id) || {}).value || '').trim();
      const trimmed = {
        name: read('name'),
        contact: read('contact'),
        business: read('business'),
        tariff: (document.getElementById('tariff') || {}).value || '',
        message: read('message'),
      };

      let firstBad = null;
      REQUIRED.forEach((id) => {
        clearError(id);
        if (!trimmed[id]) {
          const input = markError(id);
          if (!firstBad) firstBad = input;
        }
      });
      if (firstBad) {
        showToast('Заполните имя, контакт и тип бизнеса — без них мы не сможем ответить.', true);
        firstBad.focus();
        return;
      }

      const submitBtn = document.getElementById('submit-btn');
      const btnText = document.getElementById('btn-text');
      const spinner = document.getElementById('btn-spinner');

      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Отправляем…';
      if (spinner) spinner.style.display = '';

      // Время приёмник проставляет сам, поэтому здесь его нет
      const payload = {
        'Имя': trimmed.name,
        'Контакт': trimmed.contact,
        'Тип бизнеса': trimmed.business,
        'Тариф': tariffLabel(),
        'Страница': window.location.pathname,
        '_hp': honeypot.value,
      };
      if (trimmed.message) payload['Комментарий'] = trimmed.message;
      if (document.referrer) payload['Источник перехода'] = document.referrer;

      try {
        const res = await fetch(RELAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'http_' + res.status);

        showToast('Заявка принята. Ответим в течение 15 минут.');
        form.reset();
        goal('form_submit_success', {
          tariff: trimmed.tariff || 'unspecified',
          page: window.location.pathname,
        });
      } catch (err) {
        // Приёмник ограничивает 20 заявками с адреса за 10 минут — про это
        // человеку стоит сказать прямо, иначе он будет жать кнопку впустую.
        const tooMany = String(err && err.message) === 'too_many_requests';
        showToast(
          tooMany
            ? 'Слишком много заявок с вашего адреса. Попробуйте через 10 минут или напишите на aiinformatorbot@gmail.com.'
            : 'Не удалось отправить заявку. Напишите на aiinformatorbot@gmail.com — ответим так же быстро.',
          true
        );
        goal('form_submit_error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = 'Отправить заявку';
        if (spinner) spinner.style.display = 'none';
      }
    });
  }

  // ─── Metrika goals ───────────────────────────────────────────────
  function initMetrikaGoals() {
    document.querySelectorAll('a[href*="#cta"], a[href*="#zakaz"], a[data-goal="cta"]').forEach((el) => {
      el.addEventListener('click', () => goal('cta_click'));
    });

    document.querySelectorAll('a[href^="mailto:"]').forEach((el) => {
      el.addEventListener('click', () => goal('email_click'));
    });

    if (document.body.classList.contains('article-page')) {
      let fired = false;
      window.addEventListener('scroll', () => {
        if (fired) return;
        const percent =
          (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
        if (percent > 0.5) {
          fired = true;
          goal('blog_read', { slug: window.location.pathname });
        }
      }, { passive: true });
    }
  }

  // ─── Выбор тарифа: из ссылки на карточке и из ?tariff= ───────────
  function initTariffPrefill() {
    const select = document.getElementById('tariff');
    if (!select) return;

    function apply(value) {
      if (!value) return;
      const opt = Array.from(select.options).find((o) => o.value === value);
      if (opt) select.value = value;
    }

    apply(new URLSearchParams(window.location.search).get('tariff'));

    document.querySelectorAll('[data-tariff]').forEach((el) => {
      el.addEventListener('click', () => apply(el.getAttribute('data-tariff')));
    });
  }

  // ─── Init on DOM ready ───────────────────────────────────────────
  function init() {
    initMobileMenu();
    initNavScroll();
    initReveal();
    initFaq();
    initForm();
    initTariffPrefill();
    initMetrikaGoals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
