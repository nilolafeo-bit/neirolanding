/* ─────────────────────────────────────────────────────────────────
   NeiroLanding — общий клиентский JS
   ───────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // Webhook URL (НЕ менять — оставлен по требованию владельца)
  const WEBHOOK_URL = 'https://ai-konfu-u70272.vm.elestio.app/webhook/neirolanding';
  const METRIKA_ID = 108781023;

  // ─── Mobile menu toggle ──────────────────────────────────────────
  function initMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('mobile-menu');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => menu.classList.toggle('open'));
    menu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => menu.classList.remove('open'));
    });
  }

  // ─── Sticky nav shadow ───────────────────────────────────────────
  function initNavScroll() {
    const nav = document.querySelector('.nl-nav');
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 40) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ─── Reveal on scroll ────────────────────────────────────────────
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    els.forEach((el) => io.observe(el));
  }

  // ─── FAQ accordion ───────────────────────────────────────────────
  function initFaq() {
    document.querySelectorAll('[data-faq]').forEach((item) => {
      const btn = item.querySelector('.faq-btn');
      const content = item.querySelector('.faq-content');
      const icon = item.querySelector('.faq-icon');
      if (!btn || !content) return;
      btn.addEventListener('click', () => {
        const open = item.classList.toggle('open');
        if (open) {
          content.style.maxHeight = content.scrollHeight + 'px';
          if (icon) icon.style.transform = 'rotate(45deg)';
        } else {
          content.style.maxHeight = '0px';
          if (icon) icon.style.transform = 'rotate(0deg)';
        }
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
    toast.style.background = isError ? '#EF4444' : '#22C55E';
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toastTimer = null;
    }, 4000);
  }

  // ─── Form submission ─────────────────────────────────────────────
  function initForm() {
    const form = document.getElementById('order-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const name = (document.getElementById('name') || {}).value || '';
      const contact = (document.getElementById('contact') || {}).value || '';
      const business = (document.getElementById('business') || {}).value || '';
      const tariff = (document.getElementById('tariff') || {}).value || '';
      const message = (document.getElementById('message') || {}).value || '';

      const trimmed = {
        name: name.trim(),
        contact: contact.trim(),
        business: business.trim(),
        tariff: tariff,
        message: message.trim(),
      };

      if (!trimmed.name || !trimmed.contact || !trimmed.business) {
        showToast('Пожалуйста, заполните имя, контакт и тип бизнеса.', true);
        return;
      }

      const submitBtn = document.getElementById('submit-btn');
      const btnText = document.getElementById('btn-text');
      const spinner = document.getElementById('btn-spinner');

      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Отправляем...';
      if (spinner) spinner.classList.remove('hidden');

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

        showToast('Заявка принята! Свяжемся с вами в течение 15 минут.');
        form.reset();
        if (typeof window.ym === 'function') {
          window.ym(METRIKA_ID, 'reachGoal', 'form_submit_success', {
            tariff: trimmed.tariff || 'unspecified',
            page: window.location.pathname,
          });
        }
      } catch (err) {
        showToast('Не удалось отправить. Напишите на aiinformatorbot@gmail.com', true);
        if (typeof window.ym === 'function') {
          window.ym(METRIKA_ID, 'reachGoal', 'form_submit_error');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = 'Отправить заявку';
        if (spinner) spinner.classList.add('hidden');
      }
    });
  }

  // ─── Metrika goals ───────────────────────────────────────────────
  function initMetrikaGoals() {
    document.querySelectorAll('a[href*="#cta"], a[data-goal="cta"]').forEach((el) => {
      el.addEventListener('click', () => {
        if (typeof window.ym === 'function') {
          window.ym(METRIKA_ID, 'reachGoal', 'cta_click');
        }
      });
    });

    document.querySelectorAll('a[href^="mailto:"]').forEach((el) => {
      el.addEventListener('click', () => {
        if (typeof window.ym === 'function') {
          window.ym(METRIKA_ID, 'reachGoal', 'email_click');
        }
      });
    });

    // Track blog reads (when reaching 50% of an article)
    if (document.body.classList.contains('article-page')) {
      let fired = false;
      window.addEventListener('scroll', () => {
        if (fired) return;
        const percent =
          (window.scrollY + window.innerHeight) /
          document.documentElement.scrollHeight;
        if (percent > 0.5) {
          fired = true;
          if (typeof window.ym === 'function') {
            window.ym(METRIKA_ID, 'reachGoal', 'blog_read', {
              slug: window.location.pathname,
            });
          }
        }
      }, { passive: true });
    }
  }

  // ─── Pre-select tariff from URL (?tariff=basic|optimal|premium|premium-plus)
  function initTariffPrefill() {
    const select = document.getElementById('tariff');
    if (!select) return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tariff');
    if (!t) return;
    const opt = Array.from(select.options).find((o) => o.value === t);
    if (opt) select.value = t;
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
