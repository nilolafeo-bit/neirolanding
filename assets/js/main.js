/* ─────────────────────────────────────────────────────────────────
   NeiroLanding — общий клиентский JS
   ───────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // Webhook URL (НЕ менять — оставлен по требованию владельца)
  const WEBHOOK_URL = 'https://ai-konfu-u70272.vm.elestio.app/webhook/neirolanding';
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

      const payload = Object.assign({}, trimmed, {
        source: window.location.href,
        page: window.location.pathname,
        referer: document.referrer || '',
        timestamp: new Date().toISOString(),
      });

      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        showToast('Заявка принята. Ответим в течение 15 минут.');
        form.reset();
        goal('form_submit_success', {
          tariff: trimmed.tariff || 'unspecified',
          page: window.location.pathname,
        });
      } catch (err) {
        showToast('Не удалось отправить заявку. Напишите на aiinformatorbot@gmail.com — ответим так же быстро.', true);
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
