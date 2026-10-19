/* ============================================================
   NEXUS MED — Interface da página /nexusmed/
   Sem dependências, sem envio de dados, sem localStorage.
   ============================================================ */
(function () {
  'use strict';

  /* ------------------------------------------------------------
     TELAS REAIS — preencha quando houver capturas reais aprovadas.
     Enquanto as listas estiverem vazias, nada é renderizado
     (nem o carrossel do hero, nem a seção "Nexus Med por dentro").

     Coloque os arquivos em /nexusmed/assets/real/ (PNG + WebP com o
     mesmo nome) e descreva cada tela assim:
       { arquivo: 'consulta-soap', largura: 1440, altura: 900,
         titulo: 'Prontuário SOAP', grupo: 'Consulta',
         alt: 'Tela real do Nexus Med: ...',
         legenda: 'O que a tela mostra, em linguagem simples.' }
     ------------------------------------------------------------ */
  var NX_TELAS_HERO = [];   // carrossel do hero (3 a 6 telas)
  var NX_TELAS = [];        // galeria "Nexus Med por dentro" (não repetir as do hero)

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ZOOM_IC = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function picture(t, eager) {
    var base = '/nexusmed/assets/real/' + t.arquivo;
    return '<picture><source srcset="' + base + '.webp" type="image/webp" />' +
      '<img src="' + base + '.png" width="' + t.largura + '" height="' + t.altura + '" ' +
      (eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async" alt="' + esc(t.alt) + '" /></picture>';
  }

  /* ---------- Galeria (só se houver telas) ---------- */
  (function galeria() {
    if (!NX_TELAS.length) return;
    var tpl = $('nx-galeria-tpl');
    var frag = tpl.content.cloneNode(true);
    var tabs = frag.querySelector('.nx-gal__tabs'), panels = frag.querySelector('.nx-gal__panels');
    NX_TELAS.forEach(function (t, i) {
      var id = 'nx-tela-' + i;
      tabs.insertAdjacentHTML('beforeend', '<button type="button" role="tab" class="nx-gal__tab" id="tab-' + id + '" aria-controls="painel-' + id + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' + (t.grupo ? '<span class="nx-sr">' + esc(t.grupo) + ': </span>' : '') + esc(t.titulo) + '</button>');
      panels.insertAdjacentHTML('beforeend', '<figure class="nx-gal__panel" id="painel-' + id + '" role="tabpanel" aria-labelledby="tab-' + id + '" tabindex="0"' + (i ? ' hidden' : '') + '>' +
        '<button type="button" class="nx-shot" data-ampliar data-titulo="' + esc(t.titulo) + '" aria-label="Ampliar a tela ' + esc(t.titulo) + '">' + picture(t, false) +
        '<span class="nx-shot__zoom" aria-hidden="true">' + ZOOM_IC + 'Ampliar</span></button>' +
        '<figcaption class="nx-gal__cap"><strong>' + esc(t.titulo) + '</strong><p>' + esc(t.legenda) + '</p></figcaption></figure>');
    });
    tpl.parentNode.insertBefore(frag, tpl);
    var lista = qsa('[role="tab"]', document.querySelector('.nx-gal__tabs'));
    function ativar(tab, focar) {
      lista.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
        $(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focar) tab.focus();
    }
    lista.forEach(function (t, i) {
      t.addEventListener('click', function () { ativar(t, false); });
      t.addEventListener('keydown', function (ev) {
        var k = ev.key, alvo = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') alvo = lista[(i + 1) % lista.length];
        else if (k === 'ArrowUp' || k === 'ArrowLeft') alvo = lista[(i - 1 + lista.length) % lista.length];
        else if (k === 'Home') alvo = lista[0];
        else if (k === 'End') alvo = lista[lista.length - 1];
        if (alvo) { ev.preventDefault(); ativar(alvo, true); }
      });
    });
  })();

  /* ---------- Carrossel do hero (só se houver telas) ---------- */
  (function carrossel() {
    var car = $('nx-hero-telas');
    if (!car || !NX_TELAS_HERO.length) return;
    var html = '<div class="nx-frame"><div class="nx-frame__bar" aria-hidden="true"><span></span><span></span><span></span><i></i></div><div class="nx-car__viewport">';
    NX_TELAS_HERO.forEach(function (t, i) {
      html += '<div class="nx-car__slide' + (i ? '' : ' is-on') + '" role="group" aria-roledescription="tela" aria-label="' + (i + 1) + ' de ' + NX_TELAS_HERO.length + ': ' + esc(t.titulo) + '" data-cap="' + esc(t.titulo) + '"' + (i ? ' aria-hidden="true"' : '') + '>' +
        '<button type="button" class="nx-car__shot" data-ampliar data-titulo="' + esc(t.titulo) + '" aria-label="Ampliar a tela ' + esc(t.titulo) + '"' + (i ? ' tabindex="-1"' : '') + '>' + picture(t, i === 0) + '</button></div>';
    });
    html += '</div><div class="nx-car__bar"><p class="nx-car__cap" id="nx-car-cap" aria-live="off"></p>' +
      '<button type="button" class="nx-car__btn" id="nx-car-prev" aria-label="Tela anterior">‹</button>' +
      '<button type="button" class="nx-car__btn" id="nx-car-pause" aria-pressed="false"><span id="nx-car-pause-txt">Pausar</span></button>' +
      '<button type="button" class="nx-car__btn" id="nx-car-next" aria-label="Próxima tela">›</button></div><div class="nx-car__dots" role="group" aria-label="Escolher tela">';
    NX_TELAS_HERO.forEach(function (t, i) { html += '<button type="button" class="nx-car__dot" data-ir="' + i + '" aria-label="Mostrar tela ' + (i + 1) + ': ' + esc(t.titulo) + '"><span></span></button>'; });
    html += '</div></div><p class="nx-car__label">Telas reais do Nexus Med · dados fictícios de teste</p>';
    car.innerHTML = html;
    car.hidden = false;
    $('nx-brandart').hidden = true;

    var slides = qsa('.nx-car__slide', car), dots = qsa('.nx-car__dot', car);
    var cap = $('nx-car-cap'), btnPause = $('nx-car-pause'), txt = $('nx-car-pause-txt');
    var atual = 0, timer = null, pausado = reduceMotion, hover = false, foco = false, lb = false;
    function rodando() { return !pausado && !hover && !foco && !lb && !document.hidden; }
    function reiniciar() {
      clearTimeout(timer);
      car.classList.toggle('is-running', rodando());
      dots.forEach(function (d) { d.classList.remove('is-prog'); });
      if (rodando()) { var d = dots[atual]; void d.offsetWidth; d.classList.add('is-prog'); timer = setTimeout(function () { mostrar(atual + 1, false); }, 4500); }
    }
    function mostrar(i, usuario) {
      atual = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) {
        var on = k === atual;
        s.classList.toggle('is-on', on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
        s.querySelector('.nx-car__shot').tabIndex = on ? 0 : -1;
        var im = s.querySelector('img'); if (on && im.loading === 'lazy') im.loading = 'eager';
      });
      dots.forEach(function (d, k) { if (k === atual) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      cap.textContent = slides[atual].getAttribute('data-cap');
      cap.setAttribute('aria-live', usuario ? 'polite' : 'off');
      reiniciar();
    }
    function setPausa(p) { pausado = p; btnPause.setAttribute('aria-pressed', String(p)); txt.textContent = p ? 'Retomar' : 'Pausar'; reiniciar(); }
    $('nx-car-prev').addEventListener('click', function () { mostrar(atual - 1, true); });
    $('nx-car-next').addEventListener('click', function () { mostrar(atual + 1, true); });
    btnPause.addEventListener('click', function () { setPausa(!pausado); });
    dots.forEach(function (d) { d.addEventListener('click', function () { mostrar(Number(d.getAttribute('data-ir')), true); }); });
    car.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(atual + 1, true); } else if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(atual - 1, true); } });
    car.addEventListener('mouseenter', function () { hover = true; reiniciar(); });
    car.addEventListener('mouseleave', function () { hover = false; reiniciar(); });
    car.addEventListener('focusin', function () { foco = true; reiniciar(); });
    car.addEventListener('focusout', function (ev) { if (!car.contains(ev.relatedTarget)) { foco = false; reiniciar(); } });
    document.addEventListener('visibilitychange', reiniciar);
    document.addEventListener('nx:lightbox', function (ev) { lb = !!ev.detail; reiniciar(); });
    setPausa(pausado); mostrar(0, false);
  })();

  /* ---------- Ampliação (dialog nativo) ---------- */
  (function lightbox() {
    var gatilhos = qsa('[data-ampliar]');
    var dlg = $('nx-lightbox');
    if (!gatilhos.length || !dlg || typeof dlg.showModal !== 'function') return;
    var img = $('nx-lb-img'), scroll = $('nx-lb-scroll'), btnZoom = $('nx-lb-zoom'), origem = null;
    function setZoom(on) { dlg.classList.toggle('is-zoom', on); btnZoom.setAttribute('aria-pressed', String(on)); btnZoom.textContent = on ? 'Ajustar à tela' : 'Ver em tamanho real'; }
    gatilhos.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.querySelector('img'); origem = b;
        img.src = f.currentSrc || f.src; img.alt = f.alt;
        img.setAttribute('width', f.getAttribute('width')); img.setAttribute('height', f.getAttribute('height'));
        $('nx-lb-titulo').textContent = b.getAttribute('data-titulo') || 'Tela do Nexus Med';
        setZoom(window.innerWidth < 768);
        dlg.showModal(); scroll.scrollTop = 0; scroll.scrollLeft = 0;
        $('nx-lb-fechar').focus();
        document.dispatchEvent(new CustomEvent('nx:lightbox', { detail: true }));
      });
    });
    btnZoom.addEventListener('click', function () { setZoom(!dlg.classList.contains('is-zoom')); });
    img.addEventListener('click', function () { setZoom(!dlg.classList.contains('is-zoom')); });
    $('nx-lb-fechar').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { img.removeAttribute('src'); if (origem) origem.focus(); document.dispatchEvent(new CustomEvent('nx:lightbox', { detail: false })); });
    dlg.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Tab') return;
      var f = qsa('button, [tabindex="0"]', dlg).filter(function (n) { return n.offsetParent !== null; });
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  })();

  /* ---------- Revelação suave ao rolar ---------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var alvos = qsa('.nx-flow, .nx-card, .nx-gcard, .nx-faq__item, .nx-docs, .nx-quote');
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    alvos.forEach(function (n, i) { n.classList.add('nx-reveal'); n.style.transitionDelay = ((i % 5) * 50) + 'ms'; io.observe(n); });
  }

  /* ---------- Âncoras internas: rolar e mover o foco ---------- */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[data-scroll]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1), alvo = document.getElementById(id);
    if (!alvo) return;
    ev.preventDefault();
    alvo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
    alvo.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });
})();
