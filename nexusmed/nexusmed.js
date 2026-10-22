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
  var NX_TELAS = [          // galeria "Nexus Med por dentro" (todas as telas num lugar só)
    { arquivo: 'consulta-prontuario', largura: 1920, altura: 1200, titulo: 'Sala de consulta', grupo: 'Consulta',
      alt: 'Tela real do Nexus Med: sala de consulta com os dados da paciente, a área de gravação e transcrição e o prontuário no formato SOAP.',
      legenda: 'A sala de consulta reúne a paciente, a gravação e o prontuário SOAP em uma só tela.' },
    { arquivo: 'laudo-revisao-ia', largura: 1920, altura: 1200, titulo: 'Revisão do laudo', grupo: 'Laudo',
      alt: 'Tela real do Nexus Med: revisão do texto de laudo estruturado pela IA, com o campo de impressão diagnóstica reservado ao médico.',
      legenda: 'A IA organiza o texto do laudo. A impressão diagnóstica é escrita só pelo médico.' },
    { arquivo: 'laudo-assinatura', largura: 1920, altura: 1200, titulo: 'Conferência antes de assinar', grupo: 'Laudo',
      alt: 'Tela real do Nexus Med: conferência do laudo com duas confirmações do médico antes da assinatura.',
      legenda: 'O médico confirma que revisou o texto e que a impressão diagnóstica é dele. A assinatura digital certificada está em implementação.' },
    { arquivo: 'consulta-documentos', largura: 1920, altura: 1200, titulo: 'Documentos da consulta', grupo: 'Consulta',
      alt: 'Tela real do Nexus Med: aba de documentos da consulta, com opções para gerar laudo, receita, atestado e encaminhamento.',
      legenda: 'Da mesma consulta, o médico gera laudo, receita, atestado e encaminhamento.' },
    { arquivo: 'laudo-achados', largura: 1920, altura: 1200, titulo: 'Achados do exame', grupo: 'Laudo',
      alt: 'Tela real do Nexus Med: passo de achados do exame, com área para ditar ou escrever e o botão para estruturar com IA.',
      legenda: 'O médico dita ou escreve os achados e pede para a IA estruturar o texto.' },
    { arquivo: 'login', largura: 1920, altura: 1200, titulo: 'Acesso', grupo: 'Acesso',
      alt: 'Tela real do Nexus Med: acesso com e-mail e senha.',
      legenda: 'Acesso individual de cada médico, com e-mail e senha.' }
  ];

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

  /* ============================================================
     SIMULADORES (usa NxCalc de nexusmed-calc.js)
     ============================================================ */
  (function simuladores() {
    var C = window.NxCalc;
    var sec = $('simulador');
    if (!C || !sec) return;

    function parseBR(raw) {
      var s = String(raw == null ? '' : raw).replace(/R\$|\s|%/gi, '');
      if (s === '') return null;
      if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
      else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
      if (!/^-?\d*\.?\d*$/.test(s) || s === '-' || s === '.') return NaN;
      return Number(s);
    }
    function fmtCampo(input) {
      var v = parseBR(input.value);
      if (v == null || isNaN(v)) return;
      input.value = input.hasAttribute('data-brl')
        ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }
    var brl = function (c) { return C.brl(c); };
    var brl2 = function (c) { return C.brl(c, 2); };
    var n1 = function (v) { return C.num(v, 1); };
    var pct = function (v) { return C.pct(v, 1); };
    var dur = C.duracao;

    /* ---------- abas ---------- */
    var tabs = qsa('.nx-simtab', sec);
    function ativarTab(t, focar) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
        $(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focar) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { ativarTab(t, false); });
      t.addEventListener('keydown', function (ev) {
        var alvo = null;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') alvo = tabs[(i + 1) % tabs.length];
        else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') alvo = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (ev.key === 'Home') alvo = tabs[0];
        else if (ev.key === 'End') alvo = tabs[tabs.length - 1];
        if (alvo) { ev.preventDefault(); ativarTab(alvo, true); }
      });
    });

    /* ---------- modalidades ---------- */
    var sel = $('l-mod');
    C.MODALIDADES.forEach(function (m) { sel.insertAdjacentHTML('beforeend', '<option value="' + m.id + '">' + esc(m.nome) + '</option>'); });

    var estado = { consulta: { cen: 'moderado', touched: {} }, laudo: { cen: 'moderado', touched: {} } };
    var ultimo = { consulta: null, laudo: null };

    function radio(form, name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
    function ler(form) {
      var e = {};
      qsa('[data-k]', form).forEach(function (inp) {
        var k = inp.getAttribute('data-k');
        if (inp.tagName === 'SELECT') { e[k] = inp.value; return; }
        var v = parseBR(inp.value);
        e[k] = v == null ? (k === 'valorHora' || k === 'tOut' ? undefined : NaN) : v;
      });
      if (e.valorHora === undefined) delete e.valorHora;
      if (e.tOut === undefined) e.tOut = 0;
      return e;
    }

    function mostrarErros(form, tipo, erros) {
      var mapa = {};
      erros.forEach(function (x) { if (!mapa[x.campo]) mapa[x.campo] = x.mensagem; });
      qsa('[data-k]', form).forEach(function (inp) {
        var k = inp.getAttribute('data-k');
        var box = $('e-' + inp.id);
        if (!box) return;
        var msg = mapa[k], show = msg && estado[tipo].touched[inp.id];
        var wrap = inp.closest('.nx-in');
        box.hidden = !show; box.textContent = show ? msg : '';
        if (show) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
        if (wrap) wrap.classList.toggle('is-invalid', !!show);
      });
    }

    function cartoes(res, tipo, modo, el, cenSel) {
      el.classList.toggle('is-single', res.cenarios.length === 1);
      el.innerHTML = res.cenarios.map(function (c) {
        var on = c.id === cenSel;
        var top, sub;
        if (tipo === 'laudo' && res.entradas.pagamento === 'plantao') { top = dur(c.horasLiberadasPorPlantao); sub = 'liberadas por plantão'; }
        else if (modo === 'mais' && (tipo === 'consulta' || res.entradas.pagamento === 'producao')) { top = '+' + pct(c.pctFaturamento); sub = '+' + brl(c.ganhoFaturamento) + ' por mês'; }
        else { top = dur(c.horasDevolvidas); sub = 'devolvidas por mês'; }
        return '<button type="button" role="radio" class="nx-card-c' + (on ? ' is-on' : '') + '" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-cen="' + c.id + '">' +
          '<span class="nx-card-c__n">' + esc(c.nome) + (c.padrao ? ' <em>padrão</em>' : '') + '</span>' +
          '<span class="nx-card-c__r">−' + C.num(c.r * 100) + '% no tempo ' + (tipo === 'consulta' ? 'de prontuário' : 'por laudo') + '</span>' +
          '<span class="nx-card-c__big">' + top + '</span><span class="nx-card-c__sub">' + sub + '</span>' +
          (c.acimaDoMedido ? '<span class="nx-card-c__flag">Acima do que estudos independentes mediram</span>' : '') +
          '</button>';
      }).join('');
    }

    function nq(v) { return C.num(v, Math.round(v) === v ? 0 : 2); }
    function li(t, f, nota) { return '<li><strong>' + t + '</strong><br><code>' + f + '</code>' + (nota ? '<span>' + nota + '</span>' : '') + '</li>'; }

    function renderConsulta() {
      var form = sec.querySelector('[data-form="consulta"]'), box = sec.querySelector('[data-res="consulta"]');
      var modo = radio(form, 'uso-consulta');
      qsa('[data-so="mais"]', form).forEach(function (n) { n.hidden = modo !== 'mais'; });
      var e = ler(form);
      e.phi = modo === 'mais' ? C.DEMANDA[radio(form, 'phi-consulta')] : 0;
      var r = C.simularConsulta(e);
      mostrarErros(form, 'consulta', r.ok ? [] : r.erros);
      var main = box.querySelector('[data-main]'), alt = box.querySelector('[data-alt]'), warn = box.querySelector('[data-warn]'), cards = box.querySelector('[data-cards]');
      if (!r.ok) { ultimo.consulta = null; box.classList.add('is-invalid'); cards.innerHTML = ''; alt.innerHTML = ''; warn.hidden = true; box.querySelector('[data-memo]').innerHTML = '';
        main.innerHTML = '<div class="nx-errbox"><strong>Para calcular, falta ajustar:</strong><ul>' + r.erros.map(function (x) { return '<li>' + esc(x.mensagem) + '</li>'; }).join('') + '</ul></div>'; return; }
      box.classList.remove('is-invalid');
      ultimo.consulta = { r: r, modo: modo };
      cartoes(r, 'consulta', modo, cards, estado.consulta.cen);
      var c = r.cenarios.filter(function (x) { return x.id === estado.consulta.cen; })[0];
      var vh = '(' + brl(Math.round(c.valorHora * 100)) + '/h, ' + (c.valorHoraDerivado ? 'estimativa com os seus números' : 'valor que você informou') + ')';
      if (modo === 'mais') {
        main.innerHTML = '<p class="nx-main__k">Cenário ' + esc(c.nome.toLowerCase()) + ', com os seus números</p>' +
          '<p class="nx-main__big">+' + brl(c.ganhoFaturamento) + ' <small>por mês</small></p>' +
          '<p class="nx-main__sub">+' + pct(c.pctFaturamento) + ' do faturamento mensal de ' + brl(c.faturamentoAtual) + ' · cerca de ' + n1(c.consultasPagas) + ' consultas pagas a mais por mês</p>' +
          (e.phi === 0 ? '<p class="nx-main__note">Com horários vagos na agenda, o tempo devolvido não vira faturamento. Veja em “Mais qualidade de vida”.</p>' : '');
        alt.innerHTML = '<p><strong>Alternativa, não some com o faturamento:</strong> se você usar o tempo para outra coisa, as ' + dur(c.horasDevolvidas) + ' devolvidas por mês valem cerca de ' + brl(c.valorTempo) + ' pelo valor da sua hora ' + vh + '.</p>';
        warn.hidden = !c.foraObservado;
        warn.textContent = c.foraObservado ? 'Fora do que estudos mediram (+1,7% a +2,8% de consultas por semana).' : '';
      } else {
        main.innerHTML = '<p class="nx-main__k">Cenário ' + esc(c.nome.toLowerCase()) + ', com os seus números</p>' +
          '<p class="nx-main__big">' + dur(c.horasDevolvidas) + ' <small>devolvidas por mês</small></p>' +
          '<p class="nx-main__sub">' + dur(c.horasDentro) + ' no horário de atendimento' + (c.horasFora > 0 ? ' + ' + dur(c.horasFora) + ' fora do expediente' : '') + '</p>' +
          '<p class="nx-main__note">Ilustração: equivale a cerca de ' + n1(c.periodos4h) + ' períodos de 4 h livres por mês.</p>';
        alt.innerHTML = '<p><strong>Valor do tempo:</strong> cerca de ' + brl(c.valorTempo) + ' por mês pelo valor da sua hora ' + vh + '. Não é faturamento.</p>';
        warn.hidden = true;
      }
      var tOut = e.tOut || 0;
      box.querySelector('[data-memo]').innerHTML = [
        li('Minutos economizados por consulta, dentro do horário', 'Δ = ' + nq(e.tIn) + ' min × ' + C.num(c.r * 100) + '% = ' + C.num(c.delta, 2) + ' min'),
        li('Consultas por mês', nq(e.N) + ' × ' + nq(e.D) + ' dias = ' + C.num(c.consultasMes, 1)),
        li('Horas devolvidas por mês', '(' + C.num(c.consultasMes, 1) + ' × ' + C.num(c.delta, 2) + ' + ' + C.num(c.consultasMes, 1) + ' × ' + C.num(tOut, 2) + ' × ' + C.num(c.rFora * 100) + '%) ÷ 60 = ' + C.num(c.horasDevolvidas, 2) + ' h', 'O tempo fora do expediente usa redução própria e entra só em qualidade de vida.'),
        li('Capacidade teórica de consultas a mais', 'ΔN = ' + C.num(c.consultasMes, 1) + ' × ' + C.num(c.delta, 2) + ' ÷ (' + nq(e.T) + ' − ' + C.num(c.delta, 2) + ') = ' + n1(c.deltaNTeorico), 'Quantas consultas a mais cabem no mesmo expediente se cada consulta encolhe Δ minutos.'),
        li('Consultas pagas a mais', n1(c.deltaNTeorico) + ' × ' + C.num(e.phi * 100) + '% (sua resposta sobre a agenda) = ' + n1(c.consultasPagas)),
        li('Faturamento atual', C.num(c.consultasMes, 1) + ' × ' + brl2(C.toCents(e.V)) + ' = ' + brl2(c.faturamentoAtual)),
        li('Ganho no faturamento', n1(c.consultasPagas) + ' × ' + brl2(C.toCents(e.V)) + ' = ' + brl2(c.ganhoFaturamento) + ' · Δ% = ' + C.num(e.phi * 100) + '% × ' + C.num(c.delta, 2) + ' ÷ ' + C.num(e.T - c.delta, 2) + ' = ' + pct(c.pctFaturamento), 'Consultas, dias e valor se cancelam no percentual.'),
        li('Valor do tempo (alternativa)', C.num(c.horasDevolvidas, 2) + ' h × ' + brl2(Math.round(c.valorHora * 100)) + ' = ' + brl2(c.valorTempo), 'Mostrado como alternativa. Nunca somamos valor do tempo com faturamento.')
      ].join('');
      anunciar(modo === 'mais' ? 'Simulador de consulta: mais ' + brl(c.ganhoFaturamento) + ' por mês, ' + pct(c.pctFaturamento) + ' do faturamento, no cenário ' + c.nome + '.' : 'Simulador de consulta: ' + dur(c.horasDevolvidas) + ' devolvidas por mês no cenário ' + c.nome + '.');
    }

    function renderLaudo() {
      var form = sec.querySelector('[data-form="laudo"]'), box = sec.querySelector('[data-res="laudo"]');
      var modo = radio(form, 'uso-laudo'), pag = radio(form, 'pag-laudo');
      qsa('[data-pag]', form).forEach(function (n) { n.hidden = n.getAttribute('data-pag') !== pag; });
      qsa('[data-so="mais"]', form).forEach(function (n) { if (!n.hidden) n.hidden = modo !== 'mais'; });
      var e = ler(form);
      e.pagamento = pag;
      e.phi = modo === 'mais' && pag === 'producao' ? C.DEMANDA[radio(form, 'phi-laudo')] : 0;
      if (pag !== 'producao') delete e.v;
      if (pag !== 'plantao') { delete e.horasPlantao; delete e.valorPlantao; }
      var r = C.simularLaudo(e);
      mostrarErros(form, 'laudo', r.ok ? [] : r.erros);
      var main = box.querySelector('[data-main]'), alt = box.querySelector('[data-alt]'), cards = box.querySelector('[data-cards]'), safety = box.querySelector('[data-safety]'), nost = box.querySelector('[data-nostudy]');
      if (!r.ok) { ultimo.laudo = null; box.classList.add('is-invalid'); cards.innerHTML = ''; alt.innerHTML = ''; nost.hidden = true; safety.classList.remove('is-alert'); box.querySelector('[data-memo]').innerHTML = '';
        main.innerHTML = '<div class="nx-errbox"><strong>Para calcular, falta ajustar:</strong><ul>' + r.erros.map(function (x) { return '<li>' + esc(x.mensagem) + '</li>'; }).join('') + '</ul></div>'; return; }
      box.classList.remove('is-invalid');
      nost.hidden = !r.semEstudo;
      var cenSel = r.semEstudo ? 'conservador' : estado.laudo.cen;
      ultimo.laudo = { r: r, modo: modo, cen: cenSel };
      cartoes(r, 'laudo', modo, cards, cenSel);
      var c = r.cenarios.filter(function (x) { return x.id === cenSel; })[0];
      var vh = c.valorHora == null ? null : '(' + brl(Math.round(c.valorHora * 100)) + '/h, ' + (c.valorHoraDerivado ? 'estimativa com os seus números' : 'valor que você informou') + ')';
      var altTxt = c.valorTempo == null ? 'Informe o valor da sua hora em “Valor do seu tempo” para ver quanto valem essas horas.' : 'cerca de ' + brl(c.valorTempo) + ' por mês pelo valor da sua hora ' + vh + '.';
      var k = '<p class="nx-main__k">Cenário ' + esc(c.nome.toLowerCase()) + ', com os seus números</p>';
      if (pag === 'plantao') {
        main.innerHTML = k + '<p class="nx-main__big">' + dur(c.horasLiberadasPorPlantao) + ' <small>liberadas por plantão</small></p>' +
          '<p class="nx-main__sub">R$/hora equivalente: ' + brl2(c.valorHoraEquivalente) + ' (hoje ' + brl2(Math.round(c.valorHoraPlantaoHoje)) + ') · ' + dur(c.horasDevolvidas) + ' por mês</p>' +
          '<p class="nx-main__note">A renda do plantão não muda.</p>';
        alt.innerHTML = '<p><strong>Valor do tempo:</strong> ' + altTxt + ' Não é faturamento.</p>';
      } else if (pag === 'misto') {
        main.innerHTML = k + '<p class="nx-main__big">' + dur(c.horasDevolvidas) + ' <small>liberadas por mês</small></p>' +
          '<p class="nx-main__note">O ganho depende do limiar do seu fixo; por isso mostramos só as horas.</p>';
        alt.innerHTML = '<p><strong>Valor do tempo:</strong> ' + altTxt + ' Não é faturamento.</p>';
      } else if (modo === 'mais') {
        main.innerHTML = k + '<p class="nx-main__big">+' + brl(c.ganhoFaturamento) + ' <small>por mês</small></p>' +
          '<p class="nx-main__sub">+' + pct(c.pctFaturamento) + ' do faturamento mensal de ' + brl(c.faturamentoAtual) + ' · cerca de ' + C.num(c.laudosPagos, 0) + ' laudos pagos a mais por mês</p>' +
          (e.phi === 0 ? '<p class="nx-main__note">Sem exames na fila, o tempo devolvido não vira faturamento. Veja em “Mais qualidade de vida”.</p>' : '');
        alt.innerHTML = '<p><strong>Alternativa, não some com o faturamento:</strong> se você usar o tempo para outra coisa, as ' + dur(c.horasDevolvidas) + ' devolvidas por mês valem ' + altTxt + '</p>';
      } else {
        main.innerHTML = k + '<p class="nx-main__big">' + dur(c.horasDevolvidas) + ' <small>devolvidas por mês</small></p>' +
          '<p class="nx-main__note">Ilustração: equivale a cerca de ' + n1(c.periodos4h) + ' períodos de 4 h livres por mês.</p>';
        alt.innerHTML = '<p><strong>Valor do tempo:</strong> ' + altTxt + ' Não é faturamento.</p>';
      }
      var alerta = modo === 'mais' && (!!c.acimaReferenciaSeguranca || !!c.ritmoAtualAcimaReferencia);
      var nomeMod = r.modalidade.nome.charAt(0).toLowerCase() + r.modalidade.nome.slice(1);
      safety.classList.toggle('is-alert', alerta);
      safety.innerHTML = (c.acimaReferenciaSeguranca && modo === 'mais' ? '<strong>Atenção: com este cenário, você laudaria cerca de ' + n1(c.laudosDiaComCenario) + ' exames por dia, acima do teto de ' + c.refTurno6h + ' por turno de 6 h relatado para ' + esc(nomeMod) + ' (considerando um turno por dia).</strong> ' :
        (c.ritmoAtualAcimaReferencia && modo === 'mais' ? '<strong>Seu ritmo atual já está acima da referência de segurança (' + c.refTurno6h + ' exames de ' + esc(nomeMod) + ' por turno de 6 h, considerando um turno por dia).</strong> ' : '<strong>Referência de segurança.</strong> ')) +
        'Em pesquisa com radiologistas brasileiros, a mediana relatada foi de 20 exames por turno de 6 h, considerada razoável entre 16 e 28; varia por modalidade (radiografia 40 a 50; ultrassom 18 a 30; tomografia e ressonância 15 a 30) (Bretas et al., Radiologia Brasileira). Ritmo mais rápido está associado a mais erros: um estudo citado pelos autores viu erros relevantes subirem de 10% para 26,6% ao dobrar a velocidade de laudo. E leitores tendem a seguir a sugestão da IA mesmo quando ela está errada, o chamado viés de automação (Dratsch et al., Radiology, 2023).';
      var memo = [
        li('Laudos por mês', nq(e.L) + ' × ' + nq(e.D) + ' dias = ' + C.num(c.laudosMes, 1)),
        li('Horas devolvidas por mês', C.num(c.laudosMes, 1) + ' × ' + nq(e.t) + ' min × ' + C.num(c.r * 100) + '% ÷ 60 = ' + C.num(c.horasDevolvidas, 2) + ' h')
      ];
      if (pag === 'producao') {
        memo.push(li('Capacidade teórica de laudos a mais', 'ΔL = ' + C.num(c.laudosMes, 1) + ' × ' + C.num(c.r * 100) + '% ÷ (1 − ' + C.num(c.r * 100) + '%) = ' + n1(c.deltaLTeorico)));
        memo.push(li('Laudos pagos a mais', n1(c.deltaLTeorico) + ' × ' + C.num(e.phi * 100) + '% (sua resposta sobre a fila) = ' + n1(c.laudosPagos)));
        memo.push(li('Faturamento atual e ganho', C.num(c.laudosMes, 1) + ' × ' + brl2(C.toCents(e.v)) + ' = ' + brl2(c.faturamentoAtual) + ' · ganho ' + n1(c.laudosPagos) + ' × ' + brl2(C.toCents(e.v)) + ' = ' + brl2(c.ganhoFaturamento), 'Δ% = ' + C.num(e.phi * 100) + '% × ' + C.num(c.r * 100) + '% ÷ (1 − ' + C.num(c.r * 100) + '%) = ' + pct(c.pctFaturamento) + '.'));
        memo.push(li('Ritmo com o cenário', nq(e.L) + ' + ' + n1(c.laudosPagos) + ' ÷ ' + nq(e.D) + ' dias = ' + n1(c.laudosDiaComCenario) + ' laudos por dia', c.refTurno6h != null ? 'Comparado com o teto de ' + c.refTurno6h + ' exames por turno de 6 h relatado para esta modalidade, considerando um turno por dia (Bretas et al.).' : 'O estudo não traz faixa para esta modalidade; sem comparação numérica.'));
      }
      if (pag === 'plantao') {
        memo.push(li('Horas liberadas por plantão', nq(e.horasPlantao) + ' h × ' + C.num(c.r * 100) + '% = ' + C.num(c.horasLiberadasPorPlantao, 2) + ' h'));
        memo.push(li('R$/hora equivalente', brl2(C.toCents(e.valorPlantao)) + ' ÷ (' + nq(e.horasPlantao) + ' h × (1 − ' + C.num(c.r * 100) + '%)) = ' + brl2(c.valorHoraEquivalente), 'A renda do plantão não muda.'));
      }
      if (c.valorTempo != null) memo.push(li('Valor do tempo (alternativa)', C.num(c.horasDevolvidas, 2) + ' h × ' + brl2(Math.round(c.valorHora * 100)) + ' = ' + brl2(c.valorTempo), 'Mostrado como alternativa. Nunca somamos valor do tempo com faturamento.'));
      box.querySelector('[data-memo]').innerHTML = memo.join('');
      anunciar(pag === 'plantao' ? 'Simulador de laudo: ' + dur(c.horasLiberadasPorPlantao) + ' liberadas por plantão.' : (modo === 'mais' && pag === 'producao' ? 'Simulador de laudo: mais ' + brl(c.ganhoFaturamento) + ' por mês, ' + pct(c.pctFaturamento) + ' do faturamento.' : 'Simulador de laudo: ' + dur(c.horasDevolvidas) + ' devolvidas por mês.'));
    }

    var liveT = null;
    var live = document.createElement('p'); live.className = 'nx-sr'; live.setAttribute('aria-live', 'polite'); sec.appendChild(live);
    function anunciar(t) { clearTimeout(liveT); liveT = setTimeout(function () { live.textContent = t; }, 900); }

    function render(tipo) { if (tipo === 'consulta') renderConsulta(); else renderLaudo(); }

    ['consulta', 'laudo'].forEach(function (tipo) {
      var form = sec.querySelector('[data-form="' + tipo + '"]'), box = sec.querySelector('[data-res="' + tipo + '"]');
      form.addEventListener('input', function () { render(tipo); });
      form.addEventListener('change', function () { render(tipo); });
      form.addEventListener('focusout', function (ev) {
        var t = ev.target;
        if (t.matches && t.matches('input[data-k]')) { estado[tipo].touched[t.id] = true; fmtCampo(t); render(tipo); }
      });
      form.addEventListener('submit', function (ev) { ev.preventDefault(); });
      var cards = box.querySelector('[data-cards]');
      cards.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-cen]'); if (!b) return;
        if (!(tipo === 'laudo' && ultimo.laudo && ultimo.laudo.r.semEstudo)) estado[tipo].cen = b.getAttribute('data-cen');
        render(tipo);
        var n = cards.querySelector('[data-cen="' + b.getAttribute('data-cen') + '"]'); if (n) n.focus();
      });
      cards.addEventListener('keydown', function (ev) {
        var lista = qsa('[data-cen]', cards); if (lista.length < 2) return;
        var i = lista.indexOf(document.activeElement); if (i < 0) return;
        var j = null;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') j = (i + 1) % lista.length;
        else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') j = (i - 1 + lista.length) % lista.length;
        if (j === null) return;
        ev.preventDefault();
        estado[tipo].cen = lista[j].getAttribute('data-cen'); render(tipo);
        cards.querySelector('[data-cen="' + estado[tipo].cen + '"]').focus();
      });
      box.querySelector('[data-act="copiar"]').addEventListener('click', function () { copiar(tipo); });
      box.querySelector('[data-act="pdf"]').addEventListener('click', function () {
        if (!ultimo[tipo]) { toast('Complete os campos antes de salvar.'); return; }
        window.print();
      });
      render(tipo);
    });

    function resumo(tipo) {
      var u = ultimo[tipo]; if (!u) return null;
      var r = u.r, e = r.entradas;
      var cid = tipo === 'consulta' ? estado.consulta.cen : u.cen;
      var c = r.cenarios.filter(function (x) { return x.id === cid; })[0];
      var L = ['Simulação Nexus Med — ' + (tipo === 'consulta' ? 'médico de consulta' : 'médico laudista') + ' (cenário ' + c.nome.toLowerCase() + ')'];
      if (tipo === 'consulta') {
        L.push('• Entradas: ' + nq(e.N) + ' consultas/dia, ' + nq(e.D) + ' dias/mês, ' + nq(e.T) + ' min por consulta, ' + nq(e.tIn) + ' min de prontuário no horário, ' + nq(e.tOut || 0) + ' min fora, ' + brl2(C.toCents(e.V)) + ' por consulta');
        L.push('• Redução de ' + C.num(c.r * 100) + '% no tempo de prontuário');
        if (u.modo === 'mais') L.push('• Faturamento: +' + brl(c.ganhoFaturamento) + ' por mês (+' + pct(c.pctFaturamento) + ')' + (c.foraObservado ? ' — fora do que estudos mediram' : ''));
        L.push('• Tempo devolvido: ' + dur(c.horasDevolvidas) + ' por mês');
      } else {
        L.push('• Entradas: ' + r.modalidade.nome + ', ' + nq(e.L) + ' laudos/dia, ' + nq(e.D) + ' dias/mês, ' + nq(e.t) + ' min por laudo, pagamento ' + ({ producao: 'por produção', misto: 'misto', plantao: 'plantão fixo' })[e.pagamento]);
        L.push('• Redução de ' + C.num(c.r * 100) + '% no tempo por laudo' + (r.semEstudo ? ' (sem estudo de referência para esta modalidade)' : ''));
        if (e.pagamento === 'producao' && u.modo === 'mais') L.push('• Faturamento: +' + brl(c.ganhoFaturamento) + ' por mês (+' + pct(c.pctFaturamento) + ')');
        if (e.pagamento === 'plantao') L.push('• ' + dur(c.horasLiberadasPorPlantao) + ' liberadas por plantão; a renda do plantão não muda');
        L.push('• Tempo devolvido: ' + dur(c.horasDevolvidas) + ' por mês');
      }
      L.push('O Nexus gera rascunho; revisão, edição e decisão final são sempre do médico.');
      L.push('Simulação com as premissas informadas, com percentuais de estudos de outros produtos. Não é resultado medido do Nexus Med nem promessa de ganho. ' + C.VERSAO + '.');
      return L.join('\n');
    }
    function toast(m) { var t = $('nx-toast'); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3200); }
    function copiar(tipo) {
      var txt = resumo(tipo);
      if (!txt) { toast('Complete os campos para gerar o resumo.'); return; }
      txt += '\n\nSimule também: https://www.iacomunica.com.br/nexusmed/';
      function ok() { toast('Resumo copiado.'); }
      function fb() { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (er) { toast('Não foi possível copiar.'); } document.body.removeChild(ta); }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fb); else fb();
    }
    /* ---------- Impressão / PDF: cabeçalho e blocos abertos ---------- */
    function assinatura(form) {
      return qsa('input, select', form).map(function (i) { return (i.type === 'radio' || i.type === 'checkbox') ? (i.checked ? '1' : '0') : i.value; }).join('|');
    }
    var inicial = {};
    ['consulta', 'laudo'].forEach(function (tipo) { inicial[tipo] = assinatura(sec.querySelector('[data-form="' + tipo + '"]')); });
    var abertos = [], imprimindo = false;
    window.addEventListener('beforeprint', function () {
      var d = new Date();
      ['consulta', 'laudo'].forEach(function (tipo) {
        var box = sec.querySelector('[data-res="' + tipo + '"]'), alvo = box && box.querySelector('[data-print-data]');
        if (!alvo) return;
        var u = ultimo[tipo], partes = ['Gerado em ' + d.toLocaleDateString('pt-BR')];
        partes.push(tipo === 'consulta' ? 'médico de consulta' : 'médico laudista');
        if (u) {
          var cid = tipo === 'consulta' ? estado.consulta.cen : u.cen;
          var c = u.r.cenarios.filter(function (x) { return x.id === cid; })[0];
          if (c) partes.push('cenário ' + c.nome.toLowerCase());
        }
        partes.push(assinatura(sec.querySelector('[data-form="' + tipo + '"]')) === inicial[tipo] ? 'exemplo ilustrativo' : 'números informados');
        partes.push('iacomunica.com.br/nexusmed');
        alvo.textContent = partes.join(' · ');
      });
      if (!imprimindo) abertos = qsa('.nx-memo, .nx-src', sec).map(function (d) { return d.open; });
      imprimindo = true;
      qsa('.nx-memo, .nx-src', sec).forEach(function (d) { d.open = true; });
    });
    window.addEventListener('afterprint', function () {
      if (!imprimindo) return;
      imprimindo = false;
      qsa('.nx-memo, .nx-src', sec).forEach(function (d, i) { d.open = abertos[i]; });
    });
  })();

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

  /* ---------- Agendar: o Cal abre o modal na mesma aba; href="#" não pode rolar ao topo ---------- */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[data-cal-link][href="#"]');
    if (a) ev.preventDefault();
  });

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
