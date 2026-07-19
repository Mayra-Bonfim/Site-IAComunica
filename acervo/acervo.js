/* ============================================================
   ACERVO — JS compartilhado (vanilla, sem build, sem framework)
   Estado 100% local (localStorage), sem backend, sem login.
   Todas as leituras/escritas em localStorage usam try/catch para
   não quebrar em modo privado (Safari) ou com quota cheia.
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     Storage helpers
     ---------------------------------------------------------- */
  var KEYS = {
    quiz: 'acervo:quiz',
    progresso: 'acervo:progresso',
    checkPrefix: 'acervo:check:',
    resolveuPrefix: 'acervo:resolveu:',
    calc: 'acervo:calc',
    theme: 'acervo:theme'
  };

  function safeGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* modo privado ou quota cheia: falha silenciosa, não quebra a página */
    }
  }

  function getProgresso() {
    return safeGet(KEYS.progresso, { concluidos: [], ultimoVisitado: null });
  }

  function setProgresso(p) {
    safeSet(KEYS.progresso, p);
  }

  function marcarUltimoVisitado(slug) {
    var p = getProgresso();
    p.ultimoVisitado = slug;
    setProgresso(p);
  }

  function marcarConcluido(slug) {
    var p = getProgresso();
    if (p.concluidos.indexOf(slug) === -1) {
      p.concluidos.push(slug);
    }
    p.ultimoVisitado = slug;
    setProgresso(p);
  }

  /* ----------------------------------------------------------
     Tema (claro/escuro) — persistido em localStorage.
     O <head> de cada página já aplica o tema salvo (ou a
     preferência do sistema) via script inline síncrono, antes do
     CSS pintar, para evitar flash do tema errado (FOUC). Aqui só
     cuidamos do botão de alternância e de manter o estado salvo
     em sincronia com o que já foi aplicado no <html>.
     ---------------------------------------------------------- */
  function getPreferredTheme() {
    var saved = safeGet(KEYS.theme, null);
    if (saved === 'light' || saved === 'dark') return saved;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.querySelector('[data-theme-toggle]');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro');
    }
  }

  function setTheme(theme) {
    applyTheme(theme);
    safeSet(KEYS.theme, theme);
  }

  function initTheme() {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    applyTheme(document.documentElement.getAttribute('data-theme') || getPreferredTheme());
    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      setTheme(current === 'light' ? 'dark' : 'light');
    });
  }

  /* ----------------------------------------------------------
     Utilidades
     ---------------------------------------------------------- */
  function normalize(str) {
    return (str || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  var toastTimer = null;
  function showToast(msg) {
    var el = document.querySelector('[data-acervo-toast]');
    if (!el) {
      el = document.createElement('div');
      el.className = 'acervo-toast';
      el.setAttribute('data-acervo-toast', '');
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-visible');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.remove('is-visible');
    }, 3200);
  }

  function announce(msg) {
    var region = document.querySelector('[data-acervo-live]');
    if (region) {
      region.textContent = '';
      window.setTimeout(function () {
        region.textContent = msg;
      }, 30);
    }
  }

  /* ----------------------------------------------------------
     Dados (acervo.json) — carregado uma vez, cacheado em memória
     ---------------------------------------------------------- */
  var dataPromise = null;
  function getData() {
    if (!dataPromise) {
      dataPromise = fetch('/acervo/acervo.json')
        .then(function (res) { return res.json(); })
        .catch(function (err) {
          console.error('Acervo: falha ao carregar acervo.json', err);
          return { playbooks: [], trilha: { niveis: [] }, comercial: {} };
        });
    }
    return dataPromise;
  }

  function findPlaybook(data, slug) {
    for (var i = 0; i < data.playbooks.length; i++) {
      if (data.playbooks[i].slug === slug) return data.playbooks[i];
    }
    return null;
  }

  function findNivel(data, numero) {
    for (var i = 0; i < data.trilha.niveis.length; i++) {
      if (data.trilha.niveis[i].nivel === numero) return data.trilha.niveis[i];
    }
    return null;
  }

  function nivelConcluido(nivelObj, concluidos) {
    var alvos = nivelObj.playbooks || [];
    if (!alvos.length) return false;
    if (nivelObj.regraConclusao === 'qualquer') {
      return alvos.some(function (s) { return concluidos.indexOf(s) !== -1; });
    }
    return alvos.every(function (s) { return concluidos.indexOf(s) !== -1; });
  }

  function nivelAtual(data, concluidos) {
    var niveis = data.trilha.niveis;
    for (var i = 0; i < niveis.length; i++) {
      if (!nivelConcluido(niveis[i], concluidos)) return niveis[i].nivel;
    }
    return niveis.length ? niveis[niveis.length - 1].nivel : 0;
  }

  function urlDoNivel(nivelObj) {
    var slug = nivelObj.paginaAbertura || (nivelObj.playbooks && nivelObj.playbooks[0]);
    return slug ? '/acervo/' + slug + '/' : '/acervo/';
  }

  /* ----------------------------------------------------------
     Links comerciais (WhatsApp) — origem única no manifesto
     ---------------------------------------------------------- */
  function initComercial(data) {
    var links = document.querySelectorAll('[data-comercial-link]');
    if (!links.length) return;
    var url = (data.comercial && data.comercial.whatsapp) || 'https://wa.me/556198747075';
    links.forEach(function (a) {
      a.setAttribute('href', url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }

  /* ----------------------------------------------------------
     Busca interna (topbar, presente em todas as páginas)
     ---------------------------------------------------------- */
  function initBusca(data) {
    var input = document.querySelector('.acervo-search__input');
    var resultsBox = document.querySelector('.acervo-search__results');
    if (!input || !resultsBox) return;

    var activeIndex = -1;
    var currentMatches = [];

    function nivelLabel(nivel) {
      var n = findNivel(data, nivel);
      return n ? 'Nível ' + nivel + ' · ' + n.nome : 'Nível ' + nivel;
    }

    function render(matches) {
      resultsBox.innerHTML = '';
      if (!matches.length) {
        var empty = document.createElement('div');
        empty.className = 'acervo-search__empty';
        empty.textContent = 'Nenhum guia encontrado.';
        resultsBox.appendChild(empty);
        resultsBox.classList.add('is-open');
        return;
      }
      matches.forEach(function (pb, i) {
        var a = document.createElement('a');
        a.href = '/acervo/' + pb.slug + '/';
        a.className = 'acervo-search__result';
        a.setAttribute('data-index', String(i));
        a.innerHTML =
          '<span class="acervo-search__result-tag">Playbook</span>' +
          '<div class="acervo-search__result-title">' + pb.titulo + '</div>' +
          '<div class="acervo-search__result-context">' + nivelLabel(pb.nivel) + '</div>';
        resultsBox.appendChild(a);
      });
      resultsBox.classList.add('is-open');
    }

    function close() {
      resultsBox.classList.remove('is-open');
      activeIndex = -1;
    }

    function search(term) {
      var q = normalize(term.trim());
      if (!q) {
        currentMatches = [];
        close();
        return;
      }
      currentMatches = data.playbooks.filter(function (pb) {
        var haystack = normalize(
          [pb.titulo, pb.resumo].concat(pb.ferramentas || [], pb.problemas || [], pb.keywords || []).join(' ')
        );
        return haystack.indexOf(q) !== -1;
      });
      render(currentMatches);
    }

    input.addEventListener('input', function () {
      search(input.value);
    });

    input.addEventListener('focus', function () {
      if (input.value.trim()) search(input.value);
    });

    input.addEventListener('keydown', function (e) {
      var links = resultsBox.querySelectorAll('.acervo-search__result');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!links.length) return;
        activeIndex = Math.min(activeIndex + 1, links.length - 1);
        links.forEach(function (l, i) { l.classList.toggle('is-active', i === activeIndex); });
        links[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!links.length) return;
        activeIndex = Math.max(activeIndex - 1, 0);
        links.forEach(function (l, i) { l.classList.toggle('is-active', i === activeIndex); });
        links[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && links[activeIndex]) {
          e.preventDefault();
          window.location.href = links[activeIndex].getAttribute('href');
        }
      } else if (e.key === 'Escape') {
        close();
        input.blur();
      }
    });

    document.addEventListener('click', function (e) {
      if (!resultsBox.contains(e.target) && e.target !== input) {
        close();
      }
    });
  }

  /* ----------------------------------------------------------
     HUB — navegação dinâmica por Ferramenta / Problema
     ---------------------------------------------------------- */
  function uniaoDeTags(playbooks, campo) {
    var mapa = {};
    playbooks.forEach(function (pb) {
      (pb[campo] || []).forEach(function (tag) {
        mapa[tag] = (mapa[tag] || 0) + 1;
      });
    });
    return Object.keys(mapa).sort().map(function (tag) {
      return { tag: tag, count: mapa[tag] };
    });
  }

  function initHubNavegacao(data) {
    var gridFerramentas = document.getElementById('grid-ferramentas');
    var gridProblemas = document.getElementById('grid-problemas');
    if (!gridFerramentas && !gridProblemas) return;

    function montarSecao(grid, painel, campo) {
      if (!grid) return;
      var tags = uniaoDeTags(data.playbooks, campo);
      grid.innerHTML = '';
      tags.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nav-card';
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML =
          '<div class="nav-card-title">' + item.tag + '</div>' +
          '<div class="nav-card-count">' + item.count + (item.count === 1 ? ' guia' : ' guias') + '</div>';
        btn.addEventListener('click', function () {
          var jaAtivo = btn.getAttribute('aria-pressed') === 'true';
          grid.querySelectorAll('.nav-card').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
          if (jaAtivo) {
            painel.classList.remove('is-open');
            painel.innerHTML = '';
            return;
          }
          btn.setAttribute('aria-pressed', 'true');
          var matches = data.playbooks.filter(function (pb) { return (pb[campo] || []).indexOf(item.tag) !== -1; });
          renderResultados(painel, matches, item.tag);
        });
        grid.appendChild(btn);
      });
    }

    function renderResultados(painel, matches, tag) {
      var listaHtml = matches.map(function (pb) {
        return (
          '<a class="resultado-item" href="/acervo/' + pb.slug + '/">' +
          '<div class="resultado-item__nivel">Nível ' + pb.nivel + '</div>' +
          '<div class="resultado-item__title">' + pb.titulo + '</div>' +
          '</a>'
        );
      }).join('');
      painel.innerHTML =
        '<div class="resultados-panel__title"><span>' + tag + ' — ' + matches.length + (matches.length === 1 ? ' guia' : ' guias') + '</span>' +
        '<button type="button" class="resultados-panel__clear" data-limpar>Limpar filtro</button></div>' +
        '<div class="resultados-list">' + listaHtml + '</div>';
      painel.classList.add('is-open');
      var limpar = painel.querySelector('[data-limpar]');
      var grid = painel.previousElementSibling;
      limpar.addEventListener('click', function () {
        painel.classList.remove('is-open');
        painel.innerHTML = '';
        if (grid) grid.querySelectorAll('.nav-card').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      });
    }

    var painelFerramentas = document.getElementById('resultados-ferramenta');
    var painelProblemas = document.getElementById('resultados-problema');
    montarSecao(gridFerramentas, painelFerramentas, 'ferramentas');
    montarSecao(gridProblemas, painelProblemas, 'problemas');
  }

  /* ----------------------------------------------------------
     HUB — trilha de níveis (soft lock) + barra segmentada
     ---------------------------------------------------------- */
  function initHubTrilha(data) {
    var grid = document.getElementById('grid-niveis');
    var barra = document.getElementById('trilha-progresso-barra');
    if (!grid) return;

    var progresso = getProgresso();
    var atual = nivelAtual(data, progresso.concluidos);

    if (barra) {
      barra.innerHTML = '';
      data.trilha.niveis.forEach(function (n) {
        var seg = document.createElement('div');
        seg.className = 'trilha-progresso__seg' + (nivelConcluido(n, progresso.concluidos) ? ' is-concluido' : '');
        barra.appendChild(seg);
      });
    }

    grid.innerHTML = '';
    data.trilha.niveis.forEach(function (n) {
      var concluido = nivelConcluido(n, progresso.concluidos);
      var isAtual = n.nivel === atual && !concluido;
      var bloqueado = n.nivel > atual;

      var a = document.createElement('a');
      a.href = urlDoNivel(n);
      a.className = 'nivel-card' + (concluido ? ' is-concluido' : '') + (isAtual ? ' is-atual' : '') + (bloqueado ? ' is-bloqueado' : '');
      var status = concluido ? 'Concluído' : isAtual ? 'Você está aqui' : bloqueado ? 'Desbloqueia depois do Nível ' + (n.nivel - 1) : '';
      a.innerHTML =
        '<div class="nivel-number">' + n.nivel + '</div>' +
        '<div class="nivel-name">' + n.nome + '</div>' +
        (status ? '<div class="nivel-status">' + status + '</div>' : '');

      if (bloqueado) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          showToast('O Nível ' + n.nivel + ' desbloqueia depois do Nível ' + (n.nivel - 1) + ' — mas fica à vontade pra dar uma olhada mesmo assim.');
          window.setTimeout(function () { window.location.href = a.href; }, 900);
        });
      }

      grid.appendChild(a);
    });
  }

  /* ----------------------------------------------------------
     Playbook — indicador compacto de trilha (breadcrumb row)
     ---------------------------------------------------------- */
  function initIndicadorTrilha(data) {
    var el = document.querySelector('[data-trilha-indicador]');
    if (!el) return;
    var body = document.body;
    var nivelNum = parseInt(body.getAttribute('data-nivel'), 10);
    var slug = body.getAttribute('data-slug');
    var nivelObj = findNivel(data, nivelNum);
    if (!nivelObj) return;

    var totalNiveis = data.trilha.niveis.length - 1; // 0 a 5
    var textoDots = '';
    for (var i = 0; i <= totalNiveis; i++) {
      var cls = 'trilha-indicador__dot';
      var progresso = getProgresso();
      var n = findNivel(data, i);
      if (n && nivelConcluido(n, progresso.concluidos)) cls += ' is-concluido';
      if (i === nivelNum) cls += ' is-atual';
      textoDots += '<span class="' + cls + '"></span>';
    }

    var textoPosicao;
    if (body.hasAttribute('data-abertura')) {
      textoPosicao = 'Nível ' + nivelNum + ' de ' + totalNiveis + ' · Escolha seu caminho';
    } else {
      var idx = nivelObj.playbooks.indexOf(slug);
      textoPosicao = 'Nível ' + nivelNum + ' de ' + totalNiveis + ' · Playbook ' + (idx + 1) + ' de ' + nivelObj.playbooks.length;
    }

    el.innerHTML = '<span>' + textoPosicao + '</span><span class="trilha-indicador__dots">' + textoDots + '</span>';
  }

  /* ----------------------------------------------------------
     Playbook — checklist
     ---------------------------------------------------------- */
  function initChecklist(data) {
    var container = document.querySelector('[data-checklist]');
    if (!container) return;
    var slug = document.body.getAttribute('data-slug');
    var items = container.querySelectorAll('.checklist-item');
    var key = KEYS.checkPrefix + slug;
    var marcados = safeGet(key, []);

    function pintar() {
      items.forEach(function (item, i) {
        item.classList.toggle('is-marcado', marcados.indexOf(i) !== -1);
      });
    }
    pintar();

    items.forEach(function (item, i) {
      item.addEventListener('click', function () {
        var idx = marcados.indexOf(i);
        if (idx === -1) {
          marcados.push(i);
        } else {
          marcados.splice(idx, 1);
        }
        safeSet(key, marcados);
        pintar();
        if (marcados.length === items.length) {
          aoConcluirPlaybook(data, slug);
        }
      });
    });
  }

  function aoConcluirPlaybook(data, slug) {
    var progressoAntes = getProgresso();
    var nivelAntes = nivelAtual(data, progressoAntes.concluidos);
    marcarConcluido(slug);
    var progressoDepois = getProgresso();
    var nivelDepois = nivelAtual(data, progressoDepois.concluidos);
    if (nivelDepois !== nivelAntes) {
      showToast('Nível ' + nivelAntes + ' concluído! Continue quando quiser.');
    }
  }

  /* ----------------------------------------------------------
     Playbook — botão copiar

     Listener delegado em document (não anexado direto em cada
     botão): initComparador() pode reatribuir o innerHTML da seção
     de passos depois que este init roda, o que recriaria o
     <button data-copiar> do zero e destruiria um listener anexado
     diretamente nele. Delegação sobrevive a qualquer reescrita de
     DOM, atual ou futura.
     ---------------------------------------------------------- */
  function initCopiar() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-copiar]') : null;
      if (!btn) return;
      var wrap = btn.closest('.passo-prompt');
      var texto = wrap ? wrap.getAttribute('data-copy-text') : '';
      if (!texto) return;
      var copiado = function () {
        btn.classList.add('is-copiado');
        announce('Prompt copiado');
        window.setTimeout(function () { btn.classList.remove('is-copiado'); }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(copiado).catch(function () {
          fallbackCopy(texto, copiado);
        });
      } else {
        fallbackCopy(texto, copiado);
      }
    });
  }

  function fallbackCopy(texto, onDone) {
    try {
      var ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onDone();
    } catch (e) {
      /* sem clipboard disponível: falha silenciosa */
    }
  }

  /* ----------------------------------------------------------
     Playbook — comparador de ferramentas (até 3)

     Cada card tem duas funções que coexistem sem conflito:
     1) Seleção múltipla para a tabela de comparação lado a lado
        (aria-checked, até 3 ao mesmo tempo — comportamento original).
     2) Escolha de qual ferramenta define o "Passo a Passo" exibido
        logo abaixo (aria-current) — só ativo em páginas que marcam
        a seção de passos com [data-passos-dinamico].

     Duas variações de exibição do passo a passo, conforme o que a
     página tem disponível:
     a) Modo inline — a seção de passos contém vários blocos
        [data-passo-bloco="<chave>"], um por ferramenta, cada um
        com o passo a passo completo já escrito na página. O card
        aponta para o bloco dele via [data-passo-inline="<chave>"].
        Trocar de ferramenta apenas alterna qual bloco fica visível
        (mostra/esconde com o atributo "hidden"), sem reescrever o
        DOM. Usado quando todas as ferramentas do comparador já têm
        conteúdo real publicado na própria página (ex.: as 4 páginas
        de e-mail/agenda/reunião).
     b) Modo externo — igual ao inline, mas quando a ferramenta tem
        passo a passo publicado em OUTRO playbook do Acervo. O card
        aponta para lá via [data-passo-slug="<slug-da-pagina>"] e o
        bloco exibido é um resumo com link, montado a partir do
        acervo.json (evita duplicar conteúdo). Usado na página do
        Gamma para ChatGPT Work / Claude Cowork.

     Regra da escolha: o card que acabou de ser marcado (selecionado
     pela primeira vez) vira o ativo. Se o card ativo for desmarcado,
     a exibição cai para o último card ainda selecionado ou, se
     nenhum restar, para o card "local" (o dono da própria página,
     sem data-passo-slug nem data-passo-inline — ex.: Gamma na
     página do Gamma). Em páginas 100% inline não existe card
     "local": o padrão é o primeiro bloco presente no HTML.
     ---------------------------------------------------------- */
  function initComparador(data) {
    var secoes = document.querySelectorAll('.ferramentas-section[data-comparador]');
    secoes.forEach(function (secao) {
      var cards = secao.querySelectorAll('.ferramenta-card[data-comparavel]');
      var wrap = secao.querySelector('.comparador-wrap');
      if (!cards.length || !wrap) return;
      var tabela = wrap.querySelector('.comparador-tabela');
      var selecionados = [];

      var passosSection = document.querySelector('.passos-section[data-passos-dinamico]');
      var blocosInline = passosSection ? passosSection.querySelectorAll('[data-passo-bloco]') : [];
      var modoInline = blocosInline.length > 0;
      var passosOriginalHTML = (passosSection && !modoInline) ? passosSection.innerHTML : null;
      var cardLocal = null;
      var cardAtivo = null;
      cards.forEach(function (c) {
        if (!c.hasAttribute('data-passo-slug') && !c.hasAttribute('data-passo-inline')) cardLocal = c;
      });

      /* Card padrão: para onde a exibição cai quando nenhum card
         segue selecionado. No modo externo é o cardLocal (dono da
         própria página). No modo inline, como toda ferramenta tem
         data-passo-inline (não existe "dono" único), o padrão é o
         card que corresponde ao primeiro bloco escrito no HTML. */
      var cardPadrao = cardLocal;
      if (modoInline && !cardPadrao) {
        var chavePadrao = blocosInline[0].getAttribute('data-passo-bloco');
        cards.forEach(function (c) {
          if (!cardPadrao && c.getAttribute('data-passo-inline') === chavePadrao) cardPadrao = c;
        });
      }

      cards.forEach(function (card) {
        card.setAttribute('role', 'checkbox');
        card.setAttribute('aria-checked', 'false');
        card.setAttribute('tabindex', '0');
        if (passosSection) card.setAttribute('aria-current', 'false');

        function toggle() {
          var idx = selecionados.indexOf(card);
          var novoSelecionado = idx === -1;
          if (idx !== -1) {
            selecionados.splice(idx, 1);
            card.setAttribute('aria-checked', 'false');
          } else {
            if (selecionados.length >= 3) {
              var removido = selecionados.shift();
              removido.setAttribute('aria-checked', 'false');
            }
            selecionados.push(card);
            card.setAttribute('aria-checked', 'true');
          }
          render();

          if (passosSection) {
            if (novoSelecionado) {
              marcarAtivo(card);
            } else if (cardAtivo === card) {
              marcarAtivo(selecionados.length ? selecionados[selecionados.length - 1] : cardPadrao);
            }
          }
        }

        card.addEventListener('click', toggle);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        });
      });

      function marcarAtivo(card) {
        cardAtivo = card;
        cards.forEach(function (c) {
          c.setAttribute('aria-current', c === card ? 'true' : 'false');
        });
        renderPassos();
      }

      function renderPassos() {
        if (!passosSection) return;
        if (modoInline) {
          renderPassosInline();
          return;
        }
        if (!cardAtivo || !cardAtivo.hasAttribute('data-passo-slug')) {
          passosSection.innerHTML = passosOriginalHTML;
          return;
        }
        var slug = cardAtivo.getAttribute('data-passo-slug');
        var nome = cardAtivo.getAttribute('data-nome');
        var pb = data ? findPlaybook(data, slug) : null;
        var resumo = pb ? pb.resumo : '';
        passosSection.innerHTML =
          '<h2 class="passos-title">Passo a Passo com ' + nome + '</h2>' +
          '<div class="passo-externo">' +
          '<p class="passo-externo__aviso">O passo a passo completo do ' + nome + ' já existe no Acervo.</p>' +
          (resumo ? '<p class="passo-externo__resumo">' + resumo + '</p>' : '') +
          '<a class="quiz-resultado__cta passo-externo__link" href="/acervo/' + slug + '/">Ver playbook completo do ' + nome + '</a>' +
          '</div>';
      }

      function renderPassosInline() {
        var chave = cardAtivo ? cardAtivo.getAttribute('data-passo-inline') : null;
        blocosInline.forEach(function (bloco) {
          bloco.hidden = bloco.getAttribute('data-passo-bloco') !== chave;
        });
      }

      if (passosSection && modoInline) {
        marcarAtivo(cardPadrao || cards[0]);
      } else if (passosSection && cardLocal) {
        marcarAtivo(cardLocal);
      }

      function render() {
        if (selecionados.length < 2) {
          wrap.classList.remove('is-open');
          tabela.innerHTML = '';
          return;
        }
        var linhas = [
          { campo: 'preco', label: 'Preço' },
          { campo: 'gratis', label: 'Plano gratuito' },
          { campo: 'obs', label: 'Observação' }
        ];
        var thead = '<thead><tr><th>Ferramenta</th>' + selecionados.map(function (c) {
          return '<th>' + c.getAttribute('data-nome') + '</th>';
        }).join('') + '</tr></thead>';
        var tbody = '<tbody>' + linhas.map(function (linha) {
          return '<tr><th scope="row">' + linha.label + '</th>' + selecionados.map(function (c) {
            return '<td>' + (c.getAttribute('data-' + linha.campo) || '—') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody>';
        tabela.innerHTML = thead + tbody;
        wrap.classList.add('is-open');
      }
    });
  }

  /* ----------------------------------------------------------
     Playbook — calculadora de tempo economizado
     Percentuais de redução por categoria de tarefa (pesquisa real,
     não estimativa livre — ver hubs/marketing/copy/acervo brief):
       - Redação/comunicação: 35% (ponto central da faixa 30-40%)
         Fonte: Noy & Zhang, Science 2023 (RCT, n=453) — -40% de tempo
         em tarefas de escrita profissional.
       - Atendimento ao cliente: 20% (ponto central da faixa 15-25%)
         Fonte: Brynjolfsson, Li & Raymond, NBER/QJE (RCT, n=5.179
         atendentes) — +14% produtividade média, até +34% em novatos.
       - Demais tarefas administrativas (agendamento, organização de
         arquivo etc.): 22%, estimativa conservadora por analogia —
         não há medição direta dessas tarefas na literatura encontrada.
     Números acima de 40-50% foram descartados deliberadamente: são
     autoavaliação do próprio modelo sobre "quanto tempo levaria sem
     IA", não medição com humanos.
     ---------------------------------------------------------- */
  var REDUCAO_POR_CATEGORIA = {
    redacao: { pct: 0.35, label: 'Redação e comunicação (e-mail, conteúdo, resumo de reunião)' },
    atendimento: { pct: 0.20, label: 'Atendimento ao cliente' },
    geral: { pct: 0.22, label: 'Agendamento, organização de arquivos e demais tarefas administrativas' }
  };

  function initCalculadora() {
    var secao = document.querySelector('[data-calculadora]');
    if (!secao) return;

    var input = secao.querySelector('[data-calc-horas]');
    var menos = secao.querySelector('[data-calc-menos]');
    var mais = secao.querySelector('[data-calc-mais]');
    var select = secao.querySelector('[data-calc-categoria]');
    var resultado = secao.querySelector('[data-calc-resultado]');
    var nota = secao.querySelector('[data-calc-nota]');
    if (!input || !select || !resultado) return;

    // Só sobrescreve os valores padrão do HTML (que variam por página) se o
    // usuário já tiver mexido na calculadora antes, em qualquer página.
    var salvo = safeGet(KEYS.calc, null);
    if (salvo) {
      input.value = salvo.horas;
      if (REDUCAO_POR_CATEGORIA[salvo.categoria]) select.value = salvo.categoria;
    }

    function calcular() {
      var horas = Math.max(0, Math.min(80, parseInt(input.value, 10) || 0));
      input.value = horas;
      var categoria = REDUCAO_POR_CATEGORIA[select.value] ? select.value : 'geral';
      var cfg = REDUCAO_POR_CATEGORIA[categoria];
      var horasMes = horas * 4.33 * cfg.pct;
      resultado.textContent = horasMes.toFixed(1).replace('.', ',') + ' horas por mês';
      if (nota) {
        nota.textContent = 'Estimativa com redução de ' + Math.round(cfg.pct * 100) + '% para "' + cfg.label + '", com base em pesquisa de mercado (não é promessa individual de resultado).';
      }
      safeSet(KEYS.calc, { horas: horas, categoria: categoria });
    }

    input.addEventListener('input', calcular);
    select.addEventListener('change', calcular);
    if (menos) menos.addEventListener('click', function () { input.value = Math.max(0, (parseInt(input.value, 10) || 0) - 1); calcular(); });
    if (mais) mais.addEventListener('click', function () { input.value = Math.min(80, (parseInt(input.value, 10) || 0) + 1); calcular(); });

    calcular();
  }

  /* ----------------------------------------------------------
     Playbook — loop "Você resolveu esse problema?"
     ---------------------------------------------------------- */
  function initResolveu(data) {
    var secao = document.querySelector('[data-resolveu]');
    if (!secao) return;
    var slug = document.body.getAttribute('data-slug');
    var nivelNum = parseInt(document.body.getAttribute('data-nivel'), 10);
    var botoes = secao.querySelectorAll('.resolveu-btn');
    var blocoSim = secao.querySelector('[data-resolveu-resultado="sim"]');
    var blocoNao = secao.querySelector('[data-resolveu-resultado="nao"]');
    var key = KEYS.resolveuPrefix + slug;

    function preencherProximoLink() {
      var linkSim = blocoSim ? blocoSim.querySelector('[data-resolveu-proximo-link]') : null;
      if (!linkSim) return;
      var nivelObj = findNivel(data, nivelNum);
      var proximoSlug = nivelObj ? nivelObj.proximo : null;
      if (proximoSlug) {
        linkSim.setAttribute('href', '/acervo/' + proximoSlug + '/');
      } else {
        linkSim.setAttribute('href', (data.comercial && data.comercial.whatsapp) || 'https://wa.me/556198747075');
        linkSim.setAttribute('target', '_blank');
        linkSim.setAttribute('rel', 'noopener noreferrer');
      }
    }

    function preencherRelacionados() {
      var alvo = blocoNao ? blocoNao.querySelector('[data-resolveu-relacionados]') : null;
      if (!alvo) return;
      var atual = findPlaybook(data, slug);
      if (!atual) return;
      var relacionados = data.playbooks.filter(function (pb) {
        if (pb.slug === slug) return false;
        return (pb.problemas || []).some(function (p) { return (atual.problemas || []).indexOf(p) !== -1; });
      }).slice(0, 3);
      alvo.innerHTML = relacionados.map(function (pb) {
        return '<a href="/acervo/' + pb.slug + '/">' + pb.titulo + '</a>';
      }).join('');
    }

    function marcarEstado(resposta) {
      botoes.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-resolveu-resposta') === resposta ? 'true' : 'false');
      });
      if (blocoSim) blocoSim.classList.toggle('is-open', resposta === 'sim');
      if (blocoNao) blocoNao.classList.toggle('is-open', resposta === 'nao');
    }

    botoes.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var resposta = btn.getAttribute('data-resolveu-resposta');
        safeSet(key, resposta);
        marcarEstado(resposta);
        if (resposta === 'sim') {
          aoConcluirPlaybook(data, slug);
        }
      });
    });

    preencherProximoLink();
    preencherRelacionados();

    var respostaSalva = safeGet(key, null);
    if (respostaSalva) marcarEstado(respostaSalva);
  }

  /* ----------------------------------------------------------
     Quiz "Descubra seu nível"
     ---------------------------------------------------------- */
  var QUIZ_PERGUNTAS = [
    {
      id: 'p1',
      pergunta: 'Você já pediu pra alguma IA (ChatGPT, Claude, Gemini ou parecido) fazer algo por você — escrever um texto, responder uma dúvida, o que for — mesmo que só uma vez?',
      respostas: [
        { texto: 'Nunca usei nenhuma IA pra nada', resultado: 0 },
        { texto: 'Já usei, pelo menos uma vez', proximo: 'p2' }
      ]
    },
    {
      id: 'p2',
      pergunta: 'Hoje, você só usa IA abrindo o chat (ChatGPT, Claude, Gemini) numa aba separada? Ou ela já age sozinha dentro de outro app que você usa — tipo marcando compromisso direto na sua agenda ou rascunhando resposta de e-mail sem você copiar e colar?',
      respostas: [
        { texto: 'Só uso no chat, separado de tudo', resultado: 1 },
        { texto: 'Já uso IA que faz isso integrada a outro app', proximo: 'p3' }
      ]
    },
    {
      id: 'p3',
      pergunta: 'Você já usa a IA pra tocar uma tarefa inteira sozinha do início ao fim — tipo organizar uma pasta de arquivo, montar uma planilha, gerar um PDF, criar um post ou montar uma apresentação completa?',
      respostas: [
        { texto: 'Ainda não, uso mais pra coisas pontuais e curtas', resultado: 2 },
        { texto: 'Sim, já faço tarefa administrativa inteira assim', proximo: 'p4' }
      ]
    },
    {
      id: 'p4',
      pergunta: 'Sua empresa já tem um atendente de IA que responde os clientes sozinho no WhatsApp, sem uma pessoa do time digitando cada resposta?',
      respostas: [
        { texto: 'Não, quem responde no WhatsApp ainda é alguém do time', resultado: 3 },
        { texto: 'Sim, já temos um atendente automático', proximo: 'p5' }
      ]
    },
    {
      id: 'p5',
      pergunta: 'Além do atendimento no WhatsApp, sua empresa já tem outro agente de IA trabalhando em alguma área específica — financeiro, RH, marketing, vendas — cada um com sua função própria?',
      respostas: [
        { texto: 'Não, o único agente de IA que temos é o do WhatsApp', resultado: 4 },
        { texto: 'Sim, já temos agentes de IA em mais de uma área, cada um com sua tarefa', resultado: 5 }
      ]
    }
  ];

  function initQuiz(data) {
    var abrirBtns = document.querySelectorAll('[data-quiz-abrir]');
    var overlay = document.querySelector('[data-quiz-overlay]');
    if (!abrirBtns.length || !overlay) return;

    var stepsWrap = overlay.querySelector('[data-quiz-steps]');
    var progressWrap = overlay.querySelector('[data-quiz-progress]');
    var fecharBtn = overlay.querySelector('[data-quiz-fechar]');
    var passoAtualId = 'p1';
    var respondidas = 0;

    function montarPerguntas() {
      stepsWrap.innerHTML = '';
      QUIZ_PERGUNTAS.forEach(function (p, i) {
        var div = document.createElement('div');
        div.className = 'quiz-step' + (i === 0 ? ' is-ativo' : '');
        div.setAttribute('data-quiz-step', p.id);
        var respostasHtml = p.respostas.map(function (r, ri) {
          return '<button type="button" class="quiz-resposta" data-resposta-index="' + ri + '">' + r.texto + '</button>';
        }).join('');
        div.innerHTML = '<div class="quiz-step__pergunta">' + p.pergunta + '</div>' + respostasHtml;
        stepsWrap.appendChild(div);
      });

      var resultDiv = document.createElement('div');
      resultDiv.className = 'quiz-step quiz-resultado';
      resultDiv.setAttribute('data-quiz-step', 'resultado');
      resultDiv.innerHTML =
        '<div class="quiz-resultado__label">Seu nível é</div>' +
        '<div class="quiz-resultado__nivel" data-quiz-resultado-nivel></div>' +
        '<div class="quiz-resultado__nome" data-quiz-resultado-nome></div>' +
        '<div class="quiz-resultado__acoes">' +
        '<a class="quiz-resultado__cta" data-quiz-resultado-cta href="/acervo/">Comece por aqui</a>' +
        '<a class="quiz-resultado__link" href="/acervo/">Ver todos os níveis</a>' +
        '</div>';
      stepsWrap.appendChild(resultDiv);

      montarProgresso();
      ligarRespostas();
    }

    function montarProgresso() {
      progressWrap.innerHTML = '';
      QUIZ_PERGUNTAS.forEach(function (p) {
        var seg = document.createElement('div');
        seg.className = 'quiz-progress__seg';
        seg.setAttribute('data-progress-seg', p.id);
        progressWrap.appendChild(seg);
      });
    }

    function irPara(stepId) {
      overlay.querySelectorAll('.quiz-step').forEach(function (el) {
        el.classList.toggle('is-ativo', el.getAttribute('data-quiz-step') === stepId);
      });
      passoAtualId = stepId;
      var segs = progressWrap.querySelectorAll('[data-progress-seg]');
      var passouAtual = false;
      segs.forEach(function (seg) {
        var id = seg.getAttribute('data-progress-seg');
        seg.classList.remove('is-atual', 'is-feito');
        if (id === stepId) {
          seg.classList.add('is-atual');
          passouAtual = true;
        } else if (!passouAtual) {
          seg.classList.add('is-feito');
        }
      });
    }

    function ligarRespostas() {
      QUIZ_PERGUNTAS.forEach(function (p) {
        var stepEl = stepsWrap.querySelector('[data-quiz-step="' + p.id + '"]');
        var botoes = stepEl.querySelectorAll('.quiz-resposta');
        botoes.forEach(function (btn, ri) {
          btn.addEventListener('click', function () {
            botoes.forEach(function (b) { b.classList.remove('is-selecionada'); });
            btn.classList.add('is-selecionada');
            var resposta = p.respostas[ri];
            respondidas++;
            window.setTimeout(function () {
              if (typeof resposta.resultado === 'number') {
                mostrarResultado(resposta.resultado);
              } else {
                irPara(resposta.proximo);
              }
            }, 200);
          });
        });
      });
    }

    function mostrarResultado(nivelNumero) {
      var nivelObj = findNivel(data, nivelNumero);
      safeSet(KEYS.quiz, { nivel: nivelNumero, respondidoEm: new Date().toISOString() });
      overlay.querySelectorAll('.quiz-step').forEach(function (el) {
        el.classList.toggle('is-ativo', el.getAttribute('data-quiz-step') === 'resultado');
      });
      var segs = progressWrap.querySelectorAll('[data-progress-seg]');
      segs.forEach(function (seg) { seg.classList.add('is-feito'); seg.classList.remove('is-atual'); });

      overlay.querySelector('[data-quiz-resultado-nivel]').textContent = 'Nível ' + nivelNumero;
      overlay.querySelector('[data-quiz-resultado-nome]').textContent = nivelObj ? nivelObj.nome : '';
      var cta = overlay.querySelector('[data-quiz-resultado-cta]');
      var alvo = nivelObj ? urlDoNivel(nivelObj) : '/acervo/';
      cta.setAttribute('href', alvo);
    }

    function abrir() {
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      irPara('p1');
    }

    function fechar() {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    montarPerguntas();
    abrirBtns.forEach(function (btn) { btn.addEventListener('click', abrir); });
    if (fecharBtn) fecharBtn.addEventListener('click', fechar);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) fechar();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) fechar();
    });
  }

  /* ----------------------------------------------------------
     Init geral
     ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();

    var slug = document.body.getAttribute('data-slug');
    if (slug && !document.body.hasAttribute('data-abertura') && document.body.getAttribute('data-page') === 'playbook') {
      marcarUltimoVisitado(slug);
    }

    getData().then(function (data) {
      initComercial(data);
      initBusca(data);
      initHubNavegacao(data);
      initHubTrilha(data);
      initIndicadorTrilha(data);
      initChecklist(data);
      initCopiar();
      initComparador(data);
      initCalculadora();
      initResolveu(data);
      initQuiz(data);
    });
  });
})();
