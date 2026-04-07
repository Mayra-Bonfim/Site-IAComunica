/* =============================================================
   IA COMUNICA — SITE INSTITUCIONAL
   scripts.js — interações, animações, hero canvas
   ============================================================= */

'use strict';

/* ── HERO CANVAS: GRID GEOMÉTRICO ANIMADO ─────────────────── */
(function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const COLOR_LINE = 'rgba(0, 196, 179, 0.12)';
  const COLOR_LINE_BRIGHT = 'rgba(0, 196, 179, 0.25)';
  const COLOR_NODE = 'rgba(0, 196, 179, 0.6)';

  let W, H, animFrame;
  let t = 0;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width  = rect.width;
    H = canvas.height = rect.height;
  }

  // Grid lines + diagonal connections
  function drawGrid(time) {
    ctx.clearRect(0, 0, W, H);

    const COLS = 8;
    const ROWS = 6;
    const cellW = W / COLS;
    const cellH = H / ROWS;

    // Vertical lines
    for (let c = 0; c <= COLS; c++) {
      const x = c * cellW;
      const phase = Math.sin(time * 0.4 + c * 0.5) * 0.5 + 0.5;
      ctx.strokeStyle = c % 2 === 0 ? COLOR_LINE_BRIGHT : COLOR_LINE;
      ctx.globalAlpha = 0.3 + phase * 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Horizontal lines
    for (let r = 0; r <= ROWS; r++) {
      const y = r * cellH;
      const phase = Math.sin(time * 0.3 + r * 0.7) * 0.5 + 0.5;
      ctx.strokeStyle = r % 2 === 0 ? COLOR_LINE_BRIGHT : COLOR_LINE;
      ctx.globalAlpha = 0.3 + phase * 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Diagonal accent lines
    const diags = [
      { x1: 0, y1: 0, x2: W * 0.4, y2: H },
      { x1: W * 0.6, y1: 0, x2: W, y2: H * 0.6 },
      { x1: W * 0.2, y1: 0, x2: W * 0.8, y2: H },
    ];

    diags.forEach(({ x1, y1, x2, y2 }, i) => {
      const phase = Math.sin(time * 0.25 + i * 1.2) * 0.5 + 0.5;
      ctx.strokeStyle = COLOR_LINE_BRIGHT;
      ctx.globalAlpha = 0.04 + phase * 0.08;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    ctx.globalAlpha = 1;

    // Intersection nodes with pulse
    for (let c = 1; c < COLS; c += 2) {
      for (let r = 1; r < ROWS; r += 2) {
        const x = c * cellW;
        const y = r * cellH;
        const phase = Math.sin(time * 0.8 + c * 0.9 + r * 0.7) * 0.5 + 0.5;
        const radius = 1 + phase * 2;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = COLOR_NODE;
        ctx.globalAlpha = 0.3 + phase * 0.7;
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    // Scanning line — subtle horizontal sweep
    const scanY = ((time * 40) % (H + 40)) - 20;
    const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
    grad.addColorStop(0, 'rgba(0,196,179,0)');
    grad.addColorStop(0.5, 'rgba(0,196,179,0.07)');
    grad.addColorStop(1, 'rgba(0,196,179,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 30, W, 60);
  }

  function loop(timestamp) {
    t = timestamp / 1000;
    drawGrid(t);
    animFrame = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Pause animation when tab is not visible (performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animFrame);
    } else {
      animFrame = requestAnimationFrame(loop);
    }
  });

  animFrame = requestAnimationFrame(loop);
})();


/* ── NAV: HAMBURGER MENU ──────────────────────────────────── */
(function initMobileMenu() {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;

  function toggleMenu(open) {
    hamburger.classList.toggle('is-open', open);
    mobileMenu.classList.toggle('is-open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.contains('is-open');
    toggleMenu(!isOpen);
  });

  // Close on link click
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hamburger.classList.contains('is-open')) {
      toggleMenu(false);
      hamburger.focus();
    }
  });
})();


/* ── FAQ ACCORDION ────────────────────────────────────────── */
(function initFaq() {
  const items = document.querySelectorAll('.faq-item');

  items.forEach(item => {
    const btn    = item.querySelector('.faq-item__question');
    const answer = item.querySelector('.faq-item__answer');
    if (!btn || !answer) return;

    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close all others
      items.forEach(other => {
        const otherBtn    = other.querySelector('.faq-item__question');
        const otherAnswer = other.querySelector('.faq-item__answer');
        if (otherBtn && otherAnswer && other !== item) {
          otherBtn.setAttribute('aria-expanded', 'false');
          otherAnswer.classList.remove('is-open');
          otherAnswer.setAttribute('aria-hidden', 'true');
        }
      });

      // Toggle current
      btn.setAttribute('aria-expanded', String(!isOpen));
      answer.classList.toggle('is-open', !isOpen);
      answer.setAttribute('aria-hidden', String(isOpen));
    });
  });
})();


/* ── SCROLL ANIMATIONS (Intersection Observer) ────────────── */
(function initScrollAnimations() {
  if (!('IntersectionObserver' in window)) return;

  const targets = document.querySelectorAll(
    '.valor-card, .produto-card, .diferencial-card, .passo, .faq-item'
  );

  // Set initial state
  targets.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.5s ease ${i % 4 * 80}ms, transform 0.5s ease ${i % 4 * 80}ms`;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  targets.forEach(el => observer.observe(el));
})();


/* ── NAV: BACKGROUND OPACITY ON SCROLL ───────────────────── */
(function initNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrolled = window.scrollY > 20;
        nav.style.background = scrolled
          ? 'rgba(15, 22, 41, 0.98)'
          : 'rgba(15, 22, 41, 1)';
        nav.style.backdropFilter = scrolled ? 'blur(12px)' : 'none';
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();


/* ── SMOOTH SCROLL FOR ANCHOR LINKS ──────────────────────── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '72');
      const top  = target.getBoundingClientRect().top + window.scrollY - navH - 16;

      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
