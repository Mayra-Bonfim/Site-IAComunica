/* ============================================================
   ORBIT — Interface da página /orbit/
   Simulador (usa OrbitCalc de orbit-calc.js) + demonstração de escala.
   Sem dependências, sem envio de dados, sem localStorage.
   ============================================================ */
(function () {
  'use strict';

  var C = window.OrbitCalc;
  if (!C) return;

  var WHATSAPP = '5561998747075'; // Emanuel — (61) 99874-7075 (contato exclusivo da página Orbit)
  var PAGE_URL = 'https://www.iacomunica.com.br/orbit/';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function $(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function brl(c) { return C.formatBRL(c); }
  function brl0(c) { return C.formatBRL(c, true); }
  function num(v, casas) { return C.formatNum(v, casas); }
  function casas(v) { return Math.round(v) === v ? 0 : Math.round(v * 10) === v * 10 ? 1 : 2; }
  function horas(h) { return num(h, casas(h)) + 'h'; }
  function pessoas(n) { return num(n) + (n === 1 ? ' pessoa' : ' pessoas'); }
  function pct(bp) { return num(bp / 100, (bp % 100) ? 2 : 0) + '%'; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Parsing pt-BR ---------- */
  function parseBR(raw) {
    var s = String(raw == null ? '' : raw).replace(/R\$|\s|%|h/gi, '');
    if (s === '') return null;
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^-?\d*\.?\d*$/.test(s) || s === '-' || s === '.') return NaN;
    return Number(s);
  }
  function formatField(input) {
    var v = parseBR(input.value);
    if (v == null || isNaN(v)) return;
    var t = input.getAttribute('data-tipo');
    if (t === 'brl') input.value = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    else if (t === 'inteiro') input.value = Math.round(v) === v ? v.toLocaleString('pt-BR') : input.value;
    else input.value = v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  /* ============================================================
     SIMULADOR
     ============================================================ */
  var form = $('sim-form');
  if (!form) return;

  var EXEMPLO = {
    'f-pessoas': '100', 'f-jatual': '44', 'f-jfutura': '36', 'f-disponivel': '',
    'f-dias': '7', 'f-horas': '12', 'f-simult': '3', 'f-disp': '100',
    'f-salario': '2.000,00', 'f-encargos': '45', 'f-ben': '500,00',
    'f-vr': '0,00', 'f-vt': '0,00', 'f-saude': '0,00', 'f-mes': '7'
  };
  var CAMPO_INPUT = {
    pessoas: 'f-pessoas', jornadaAtual: 'f-jatual', jornadaFutura: 'f-jfutura', disponivel: 'f-disponivel',
    dias: 'f-dias', horasDia: 'f-horas', simultaneas: 'f-simult', disponibilidade: 'f-disp',
    salario: 'f-salario', encargosPct: 'f-encargos', beneficios: 'f-ben', vr: 'f-vr', vt: 'f-vt', saude: 'f-saude', mesInicio: 'f-mes'
  };
  var CAMPO_ERRO = {
    'f-pessoas': 'e-pessoas', 'f-jatual': 'e-jatual', 'f-jfutura': 'e-jfutura', 'f-disponivel': 'e-disponivel',
    'f-dias': 'e-dias', 'f-horas': 'e-horas', 'f-simult': 'e-simult', 'f-disp': 'e-disp',
    'f-salario': 'e-salario', 'f-encargos': 'e-encargos', 'f-ben': 'e-ben', 'f-vr': 'e-vr', 'f-vt': 'e-vt', 'f-saude': 'e-saude'
  };
  var touched = {};
  var modoExemplo = true;
  var ultimo = null;
  var prevNewDots = 0;

  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function val(id) { return parseBR($(id).value); }

  function lerEntradas() {
    var jfut = radio('jfut');
    var base = radio('base');
    var benmodo = radio('benmodo');
    var e = {
      pessoas: val('f-pessoas'),
      jornadaAtual: val('f-jatual'),
      jornadaFutura: jfut === 'outra' ? val('f-jfutura') : Number(jfut),
      disponivel: val('f-disponivel'),
      base: base,
      salario: val('f-salario'),
      encargosPct: val('f-encargos'),
      beneficiosModo: benmodo,
      mesInicio: Number($('f-mes').value)
    };
    if (e.disponivel === null) delete e.disponivel;
    if (base === 'demanda') {
      e.dias = val('f-dias'); e.horasDia = val('f-horas'); e.simultaneas = val('f-simult'); e.disponibilidade = val('f-disp');
    }
    if (benmodo === 'detalhe') {
      e.vr = val('f-vr'); e.vt = val('f-vt'); e.saude = val('f-saude');
      ['vr', 'vt', 'saude'].forEach(function (k) { if (e[k] === null) e[k] = 0; });
    } else {
      e.beneficios = val('f-ben'); if (e.beneficios === null) e.beneficios = 0;
    }
    if (e.salario === null) e.salario = 0;
    if (e.encargosPct === null) e.encargosPct = 0;
    // null em campos obrigatórios vira NaN para a validação acusar
    ['pessoas', 'jornadaAtual', 'jornadaFutura', 'dias', 'horasDia', 'simultaneas', 'disponibilidade'].forEach(function (k) {
      if (k in e && e[k] === null) e[k] = NaN;
    });
    return e;
  }

  function mostrarErros(erros) {
    var porInput = {};
    erros.forEach(function (x) { var id = CAMPO_INPUT[x.campo]; if (id && !porInput[id]) porInput[id] = x.mensagem; });
    Object.keys(CAMPO_ERRO).forEach(function (id) {
      var input = $(id), box = $(CAMPO_ERRO[id]);
      var msg = porInput[id];
      var show = msg && touched[id];
      var wrap = input.closest('.o-input-wrap');
      if (show) {
        box.textContent = msg; box.hidden = false;
        input.setAttribute('aria-invalid', 'true'); if (wrap) wrap.classList.add('is-invalid');
      } else {
        box.hidden = true; box.textContent = '';
        input.removeAttribute('aria-invalid'); if (wrap) wrap.classList.remove('is-invalid');
      }
    });
  }

  /* ---------- Quadro em crachás (equipe atual × novas contratações) ---------- */
  var prevNovas = 0;
  function desenharViz(total, novas) {
    var box = $('viz');
    var k = Math.max(1, Math.ceil(total / 120));
    var unidades = Math.ceil(total / k);
    var novasU = novas > 0 ? Math.min(unidades, Math.max(1, Math.round(novas / k))) : 0;
    var atuaisU = unidades - novasU;
    var html = '';
    for (var i = 0; i < unidades; i++) {
      var nova = i >= atuaisU;
      var rank = i - atuaisU;
      var cls = 'o-badge-p' + (nova ? ' is-new' : '');
      var style = '';
      if (nova && !reduceMotion && rank >= prevNovas) { cls += ' is-enter'; style = ' style="animation-delay:' + ((rank - prevNovas) * 35) + 'ms"'; }
      html += '<span class="' + cls + '"' + style + '></span>';
    }
    box.innerHTML = html;
    prevNovas = novasU;
    box.setAttribute('aria-label', 'Quadro futuro de ' + pessoas(total) + ': ' + pessoas(total - novas) + ' da equipe disponível e ' + num(novas) + ' novas contratações.');
    $('viz-legenda').innerHTML = '<span><i></i>equipe disponível (' + num(total - novas) + ')</span><span><i class="is-new"></i>novas contratações (' + num(novas) + ')</span>' +
      (k > 1 ? '<span>cada crachá ≈ ' + num(k) + ' pessoas</span>' : '');
  }

  /* ---------- Contagem animada ---------- */
  var tweens = {};
  function contar(id, alvo, fmt) {
    var node = $(id);
    var de = Number(node.getAttribute('data-v') || alvo);
    node.setAttribute('data-v', alvo);
    if (reduceMotion || de === alvo) { node.textContent = fmt(alvo); return; }
    if (tweens[id]) cancelAnimationFrame(tweens[id]);
    var t0 = null, dur = 520;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(Math.round(de + (alvo - de) * e));
      if (p < 1) tweens[id] = requestAnimationFrame(step);
    }
    tweens[id] = requestAnimationFrame(step);
  }

  /* ---------- Render ---------- */
  var liveTimer = null;

  function render() {
    var e = lerEntradas();
    var r = C.simular(e);
    var result = $('resultado');
    mostrarErros(r.ok ? [] : r.erros);

    // painel do modo demanda / VT (explicações ao vivo)
    explicarDemanda(e);
    explicarVT(e);

    var errBox = result.querySelector('.o-result__err');
    if (!r.ok) {
      ultimo = null;
      result.classList.add('is-invalid');
      setSelo('crit', 'Dados insuficientes — confira os campos indicados');
      if (!errBox) { errBox = el('div', 'o-result__err'); result.querySelector('.o-result__head').after(errBox); }
      errBox.innerHTML = '<strong>Para calcular, falta ajustar:</strong><ul>' + r.erros.map(function (x) {
        return '<li><button type="button" class="o-linkbtn" data-foco="' + (CAMPO_INPUT[x.campo] || '') + '">' + esc(x.mensagem) + '</button></li>';
      }).join('') + '</ul>';
      $('r-mini').classList.remove('has-data');
      $('mini-novas').textContent = '—'; $('mini-custo').textContent = '—';
      anunciar('Faltam dados para calcular. ' + r.erros.map(function (x) { return x.mensagem; }).join(' '));
      return;
    }
    if (errBox) errBox.remove();
    result.classList.remove('is-invalid');
    ultimo = { e: e, r: r };

    setSelo('warn', r.base === 'demanda'
      ? 'Estimativa por demanda em horas — ainda não valida a distribuição de turnos'
      : 'Estimativa por horas — ainda não valida a distribuição de turnos');

    // custo unitário (bloco 2)
    var u = r.unitario;
    $('r-unit').textContent = brl(u.total);
    $('r-unit-parts').textContent = 'salário ' + brl(u.salario) + ' + encargos ' + brl(u.encargos) + ' + benefícios ' + brl(u.beneficios);
    $('encargos-reais').textContent = 'Equivale a ' + brl(u.encargos) + ' por pessoa.';

    // destaque
    contar('r-novas', r.contratacoes, function (v) { return num(v); });
    $('r-jornada').textContent = horas(r.jornadaAtual) + ' → ' + horas(r.jornadaFutura);
    desenharViz(r.quadroFuturo, r.contratacoes);

    $('r-quadro').textContent = pessoas(r.quadroFuturo);
    var semCusto = !r.temCusto;
    setKpi('r-acres-mensal', semCusto ? null : brl(r.acrescimoMensal));
    setKpi('r-acres-anual', semCusto ? null : brl(r.acrescimoAnual));
    $('r-primeiro-ano-label').textContent = 'Primeiro ano (de ' + MESES[r.mesInicio - 1] + ' a dezembro · ' + r.mesesPrimeiroAno + (r.mesesPrimeiroAno === 1 ? ' mês)' : ' meses)');
    setKpi('r-primeiro-ano', semCusto ? null : brl(r.primeiroAno));
    setKpi('r-mensal', semCusto ? null : brl(r.custoAtual) + ' → ' + brl(r.custoFuturo));
    setKpi('r-pct', semCusto || r.percentual === null ? null : '+' + num(r.percentual, 1) + '%', semCusto ? null : 'Não se aplica (custo atual zero)');

    renderComparativo(r);
    renderMemoria(e, r);

    // mini barra
    $('mini-novas').textContent = '+' + num(r.contratacoes);
    $('mini-custo').textContent = semCusto ? '—' : '+' + brl0(r.acrescimoMensal);

    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      anunciar('Resultado atualizado: ' + num(r.contratacoes) + ' novas contratações, quadro futuro de ' + pessoas(r.quadroFuturo) +
        (semCusto ? '. Informe o salário para ver o custo.' : ', acréscimo mensal de ' + brl(r.acrescimoMensal) + '.'));
    }, 900);
  }

  function setKpi(id, texto, naTexto) {
    var dd = $(id);
    if (texto == null) { dd.textContent = naTexto || 'Informe o salário'; dd.classList.add('is-na'); }
    else { dd.textContent = texto; dd.classList.remove('is-na'); }
  }

  function setSelo(tipo, texto) {
    var s = $('r-selo');
    s.className = 'o-state o-state--' + tipo;
    $('r-selo-texto').textContent = texto;
  }

  function anunciar(t) { $('r-live').textContent = t; }

  function renderComparativo(r) {
    var tbody = $('r-compare').querySelector('tbody');
    tbody.innerHTML = '';
    var max = 0;
    r.cenarios.forEach(function (c) { if (c.mensal > max) max = c.mensal; });
    var bars = $('r-bars'); bars.innerHTML = '';
    r.cenarios.forEach(function (c) {
      var alvo = !c.atual && c.jornada === r.jornadaFutura;
      var tr = el('tr', alvo ? 'is-target' : '');
      tr.innerHTML =
        '<td>' + horas(c.jornada) + (c.atual ? ' <span class="o-tag">hoje</span>' : alvo ? ' <span class="o-tag">seu cenário</span>' : '') + '</td>' +
        '<td>' + num(c.quadro) + '</td>' +
        '<td>' + (c.atual ? '—' : num(c.contratacoes)) + '</td>' +
        '<td>' + (r.temCusto ? brl0(c.mensal) : '—') + '</td>' +
        '<td>' + (c.atual || !r.temCusto ? '—' : '+' + brl0(c.acrescimoMensal)) + '</td>';
      tbody.appendChild(tr);

      if (r.temCusto && max > 0) {
        var b = el('div', 'o-bar');
        var base = r.custoAtual / max, total = c.mensal / max;
        b.innerHTML = '<span class="o-bar__label">' + horas(c.jornada) + '</span>' +
          '<span class="o-bar__track"><span class="o-bar__add" style="transform:scaleX(0)"></span><span class="o-bar__base" style="transform:scaleX(0)"></span>' +
          '<span class="o-bar__val">' + brl0(c.mensal) + '</span></span>';
        bars.appendChild(b);
        var add = b.querySelector('.o-bar__add'), bs = b.querySelector('.o-bar__base');
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          add.style.transform = 'scaleX(' + total.toFixed(4) + ')';
          bs.style.transform = 'scaleX(' + base.toFixed(4) + ')';
        }); });
      }
    });
  }

  function li(titulo, formula, nota) {
    return '<li><strong>' + titulo + '</strong><br><code>' + formula + '</code>' + (nota ? '<span class="o-memo-note">' + nota + '</span>' : '') + '</li>';
  }

  function renderMemoria(e, r) {
    var out = [];
    var ha = horas(r.jornadaAtual), hf = horas(r.jornadaFutura);
    if (r.base === 'horas') {
      var horasHoje = r.pessoas * e.jornadaAtual;
      out.push(li('Horas semanais da equipe hoje', num(r.pessoas) + ' pessoas × ' + ha + ' = ' + num(horasHoje, horasHoje % 1 ? 2 : 0) + 'h por semana'));
      out.push(li('Quadro de referência na nova jornada',
        'teto(' + num(horasHoje, horasHoje % 1 ? 2 : 0) + 'h ÷ ' + hf + ') = teto(' + num(horasHoje / e.jornadaFutura, 2) + ') = ' + num(r.alvo.referencia),
        'Hipóteses: a necessidade de horas continua igual; produtividade, ausências e distribuição não mudam. É uma referência, não prova de que a escala fecha.'));
    } else {
      out.push(li('Pessoas-hora exigidas por semana',
        num(e.dias) + ' dias × ' + horas(e.horasDia) + ' × ' + num(e.simultaneas) + ' pessoas ao mesmo tempo = ' + num(r.pessoasHora, r.pessoasHora % 1 ? 2 : 0) + ' pessoas-hora'));
      var cap = e.jornadaFutura * e.disponibilidade / 100;
      out.push(li('Quadro de referência pela demanda',
        'teto(' + num(r.pessoasHora, r.pessoasHora % 1 ? 2 : 0) + ' ÷ (' + hf + ' × ' + num(e.disponibilidade, e.disponibilidade % 1 ? 2 : 0) + '%)) = teto(' + num(r.pessoasHora / cap, 2) + ') = ' + num(r.alvo.referencia),
        'Contar só as horas de portas abertas (' + num(e.dias * e.horasDia, 2).replace(/,00$/, '') + 'h ÷ ' + hf + ') dimensionaria um posto, ' + num(r.postoUnicoQuadro) + ' pessoas, e não os ' + num(e.simultaneas) + ' postos simultâneos.'));
      out.push(li('Para comparar: a mesma demanda na jornada atual', 'teto(' + num(r.pessoasHora, r.pessoasHora % 1 ? 2 : 0) + ' ÷ (' + ha + ' × ' + num(e.disponibilidade, e.disponibilidade % 1 ? 2 : 0) + '%)) = ' + num(r.quadroDemandaJornadaAtual),
        r.quadroDemandaJornadaAtual > r.pessoas ? 'A demanda informada já pede mais gente do que a equipe de hoje: vale revisar os dados ou a cobertura atual.' : null));
    }
    out.push(li('Novas contratações',
      'máximo(0; ' + num(r.alvo.referencia) + ' − ' + num(r.disponivel) + ' disponíveis) = ' + num(r.contratacoes),
      'Quadro futuro total = ' + num(r.disponivel) + ' disponíveis + ' + num(r.contratacoes) + ' contratações = ' + num(r.quadroFuturo) + '. Nenhum desligamento é presumido.' +
      (r.futuraNaoMenor ? ' A jornada futura não é menor que a atual: por esta regra, não há horas a repor.' : '')));

    var u = r.unitario;
    var benTxt;
    if (r.vt) {
      benTxt = 'Benefícios líquidos = VR/VA ' + brl(C.toCents(e.vr)) + ' + VT da empresa ' + brl(r.vt.patronal) + ' + saúde ' + brl(C.toCents(e.saude)) + ' = ' + brl(u.beneficios) +
        '. VT: participação do empregado = menor entre ' + brl(C.toCents(e.vt)) + ' e 6% do salário (' + brl(Math.round(u.salario * 6 / 100)) + ') = ' + brl(r.vt.participacao) + '.';
    }
    out.push(li('Custo mensal por pessoa',
      brl(u.salario) + ' × (1 + ' + pct(C.toBasisPoints(e.encargosPct)) + ') + ' + brl(u.beneficios) + ' = ' + brl(u.total),
      (benTxt ? benTxt + ' ' : '') + 'O percentual de encargos e provisões é o que você informou; o simulador não aplica alíquota automática.'));
    if (r.temCusto) {
      out.push(li('Custo mensal equivalente hoje', num(r.pessoas) + ' pessoas × ' + brl(u.total) + ' = ' + brl(r.custoAtual)));
      out.push(li('Acréscimo mensal e anual',
        num(r.contratacoes) + ' × ' + brl(u.total) + ' = ' + brl(r.acrescimoMensal) + ' por mês · × 12 = ' + brl(r.acrescimoAnual) + ' por ano',
        'Custo dos novos contratados. Considera que o custo da equipe atual não muda (sem horas extras, adicionais ou benefícios por dia alterados).'));
      out.push(li('Primeiro ano, proporcional à admissão',
        brl(r.acrescimoMensal) + ' × ' + r.mesesPrimeiroAno + (r.mesesPrimeiroAno === 1 ? ' mês' : ' meses') + ' (' + MESES[r.mesInicio - 1] + ' a dezembro) = ' + brl(r.primeiroAno),
        'Antes de custos pontuais de admissão (exames, uniforme, treinamento). O desembolso de caixa pode ter outra distribuição.'));
      if (r.percentual !== null) {
        out.push(li('Impacto percentual', brl(r.acrescimoMensal) + ' ÷ ' + brl(r.custoAtual) + ' × 100 = ' + num(r.percentual, 1) + '%',
          'Os dois lados usam o mesmo custo por pessoa, então a base é comparável.'));
      }
    }
    $('r-memoria').innerHTML = out.join('');
  }

  function explicarDemanda(e) {
    var box = $('demanda-explica');
    if (e.base !== 'demanda') { box.innerHTML = ''; return; }
    if (![e.dias, e.horasDia, e.simultaneas].every(function (v) { return typeof v === 'number' && isFinite(v) && v > 0; })) { box.innerHTML = ''; return; }
    var ph = e.dias * e.horasDia * e.simultaneas;
    var abertas = e.dias * e.horasDia;
    box.innerHTML = '<span><strong>' + num(ph, ph % 1 ? 2 : 0) + ' pessoas-hora por semana</strong> (' + num(e.dias) + ' × ' + horas(e.horasDia) + ' × ' + num(e.simultaneas) + ').</span>' +
      '<span>A conta usa pessoas-hora, não só as ' + num(abertas, abertas % 1 ? 2 : 0) + 'h de portas abertas: horas de funcionamento não equivalem às horas de toda a equipe.</span>';
  }

  function explicarVT(e) {
    var box = $('vt-explica');
    if (e.beneficiosModo !== 'detalhe' || !(e.vt > 0) || !(e.salario >= 0)) { box.innerHTML = ''; return; }
    var v = C.valeTransporte(C.toCents(e.salario), C.toCents(e.vt));
    box.innerHTML = '<span><strong>Vale-transporte:</strong> o empregado participa com ' + brl(v.participacao) + ' (o menor valor entre o VT e 6% do salário básico). Custo da empresa: <strong>' + brl(v.patronal) + '</strong>.</span>';
  }

  /* ---------- Modo exemplo × números do usuário ---------- */
  function setModo(exemplo) {
    modoExemplo = exemplo;
    var box = $('sim-exemplo');
    box.classList.toggle('is-user', !exemplo);
    $('sim-modo-badge').textContent = exemplo ? 'Exemplo didático' : 'Seus números';
    $('sim-modo-badge').className = 'o-badge ' + (exemplo ? 'o-badge--neutral' : 'o-badge--teal');
    $('sim-modo-texto').textContent = exemplo
      ? 'Os campos vêm preenchidos com o exemplo do material do Orbit (100 pessoas, 44h, salário de R$ 2.000). Troque pelos seus números.'
      : 'Simulação com os números que você informou. O cálculo fica no seu navegador.';
    $('sim-limpar').hidden = !exemplo;
    $('sim-recarregar').hidden = exemplo;
  }

  function carregarExemplo() {
    Object.keys(EXEMPLO).forEach(function (id) { $(id).value = EXEMPLO[id]; });
    form.querySelector('input[name="jfut"][value="40"]').checked = true;
    form.querySelector('input[name="base"][value="horas"]').checked = true;
    form.querySelector('input[name="benmodo"][value="total"]').checked = true;
    touched = {};
    syncVisibilidade();
    setModo(true);
    render();
  }

  function limparParaUsuario() {
    ['f-pessoas', 'f-salario', 'f-encargos', 'f-ben'].forEach(function (id) { $(id).value = ''; });
    $('f-disponivel').value = '';
    setModo(false);
    touched = {};
    render();
    $('f-pessoas').focus();
  }

  function syncVisibilidade() {
    $('jfut-outra-wrap').hidden = radio('jfut') !== 'outra';
    $('demanda-wrap').hidden = radio('base') !== 'demanda';
    var det = radio('benmodo') === 'detalhe';
    $('ben-detalhe-wrap').hidden = !det;
    $('ben-total-wrap').hidden = det;
  }

  form.addEventListener('input', function (ev) {
    if (ev.isTrusted && modoExemplo) setModo(false);
    if (ev.target.name === 'jfut' || ev.target.name === 'base' || ev.target.name === 'benmodo') syncVisibilidade();
    render();
  });
  form.addEventListener('change', function (ev) {
    if (ev.target.type === 'radio' || ev.target.tagName === 'SELECT') {
      if (ev.isTrusted && modoExemplo) setModo(false);
      syncVisibilidade();
      if (ev.target.value === 'outra') $('f-jfutura').focus();
      render();
    }
  });
  form.addEventListener('focusout', function (ev) {
    var t = ev.target;
    if (t.classList && t.classList.contains('o-input') && t.tagName === 'INPUT') {
      touched[t.id] = true;
      formatField(t);
      render();
    }
  });
  form.addEventListener('submit', function (ev) { ev.preventDefault(); });

  $('sim-limpar').addEventListener('click', limparParaUsuario);
  $('sim-recarregar').addEventListener('click', carregarExemplo);

  $('resultado').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-foco]');
    if (b && b.getAttribute('data-foco')) {
      var input = $(b.getAttribute('data-foco'));
      var det = input.closest('details'); if (det) det.open = true;
      if (input.closest('[hidden]')) return;
      input.focus(); input.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });

  /* ---------- Resumo / WhatsApp / PDF ---------- */
  function resumoTexto() {
    if (!ultimo) return null;
    var e = ultimo.e, r = ultimo.r;
    var linhas = [];
    linhas.push('Simulação Orbit — quadro e custo de pessoal' + (modoExemplo ? ' (exemplo didático)' : ''));
    linhas.push('• Equipe hoje: ' + pessoas(r.pessoas) + ', ' + horas(r.jornadaAtual) + ' por semana');
    linhas.push('• Jornada futura: ' + horas(r.jornadaFutura) + ' · base: ' + (r.base === 'demanda'
      ? 'demanda (' + num(r.pessoasHora, r.pessoasHora % 1 ? 2 : 0) + ' pessoas-hora/semana, disponibilidade ' + num(e.disponibilidade, e.disponibilidade % 1 ? 2 : 0) + '%)'
      : 'preservar as horas de hoje'));
    linhas.push('• Quadro futuro total: ' + num(r.quadroFuturo) + ' · Novas contratações: ' + num(r.contratacoes));
    if (r.temCusto) {
      linhas.push('• Custo mensal por pessoa: ' + brl(r.unitario.total) + ' (encargos e provisões informados: ' + pct(C.toBasisPoints(e.encargosPct)) + ')');
      linhas.push('• Acréscimo mensal: ' + brl(r.acrescimoMensal) + ' · anual completo: ' + brl(r.acrescimoAnual));
      linhas.push('• Primeiro ano (de ' + MESES[r.mesInicio - 1] + ' a dezembro): ' + brl(r.primeiroAno));
      if (r.percentual !== null) linhas.push('• Impacto no custo de pessoal: +' + num(r.percentual, 1) + '%');
    }
    linhas.push('Estimativa por horas, ainda sem validação da distribuição de turnos.');
    return linhas.join('\n');
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 3200);
  }

  $('act-whatsapp').addEventListener('click', function () {
    var resumo = resumoTexto();
    var texto = resumo
      ? 'Olá, Emanuel! Fiz uma simulação na página do Orbit e quero conversar sobre ela.\n\n' + resumo
      : 'Olá, Emanuel! Quero conversar sobre o Orbit e o simulador de quadro e custo de pessoal.';
    var url = 'https://api.whatsapp.com/send/?phone=' + WHATSAPP + '&text=' + encodeURIComponent(texto) + '&type=phone_number&app_absent=0';
    window.open(url, '_blank', 'noopener');
  });

  $('act-copiar').addEventListener('click', function () {
    var resumo = resumoTexto();
    if (!resumo) { toast('Complete os campos para gerar o resumo.'); return; }
    var texto = resumo + '\n\nSimule também: ' + PAGE_URL;
    function ok() { toast('Resumo copiado.'); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (err) { toast('Não foi possível copiar. Selecione o texto manualmente.'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(ok, fallback);
    else fallback();
  });

  var memoriaEstavaAberta = false;
  window.addEventListener('beforeprint', function () {
    var d = new Date();
    $('print-data').textContent = 'Gerado em ' + d.toLocaleDateString('pt-BR') + ' · ' + (modoExemplo ? 'exemplo didático' : 'números informados') + ' · iacomunica.com.br/orbit';
    memoriaEstavaAberta = $('memoria').open;
    $('memoria').open = true;
  });
  window.addEventListener('afterprint', function () { $('memoria').open = memoriaEstavaAberta; });
  $('act-pdf').addEventListener('click', function () {
    if (!ultimo) { toast('Complete os campos antes de salvar.'); return; }
    window.print();
  });

  /* ---------- Barra fixa mobile ---------- */
  (function miniBar() {
    var mini = $('r-mini');
    if (!('IntersectionObserver' in window)) return;
    var simVis = false, resVis = false;
    function upd() { mini.classList.toggle('is-on', simVis && !resVis); }
    new IntersectionObserver(function (en) { simVis = en[0].isIntersecting; upd(); }, { rootMargin: '-30% 0px -30% 0px' }).observe($('sim-form'));
    new IntersectionObserver(function (en) { resVis = en[0].isIntersecting; upd(); }, { threshold: 0.05 }).observe($('resultado'));
  })();

  syncVisibilidade();
  render();

  /* ============================================================
     DEMONSTRAÇÃO — Do número à escala (dados demonstrativos)
     ============================================================ */
  (function demo() {
    var grid = $('demo-grid');
    if (!grid) return;
    var DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    var DIAS_LONGO = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
    var PESSOAS = ['Atendimento 1', 'Atendimento 2', 'Atendimento 3', 'Atendimento 4'];
    var NECESSARIAS = [2, 3, 3, 3, 3, 4, 2];
    var FOLGAS_INICIAIS = [[5, 6], [0, 6], [1, 2], [3, 4]];
    var TURNO = '11h–15h<br>18h–22h';
    var HORAS_DIA = 8;
    var state = { fase: 'vazio', folgas: null, viuSugestao: false, revisado: false };
    var tbody = grid.querySelector('tbody'), tfoot = grid.querySelector('tfoot');
    var panel = $('demo-panel'), status = $('demo-status'), btnGerar = $('demo-gerar');

    function setStatus(tipo, texto, icon) {
      status.className = 'o-state o-state--' + tipo;
      status.innerHTML = icon + '<span>' + texto + '</span>';
    }
    var IC_DRAFT = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    var IC_WARN = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.8 15 14H1L8 1.8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.2v3.6M8 11.6v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    var IC_OK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8.5 3.2 3L13 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function cobertura(folgas) {
      return DIAS.map(function (_, d) { return PESSOAS.length - folgas.filter(function (f) { return f.indexOf(d) !== -1; }).length; });
    }

    function desenharGrade(modo, destaque, mudou) {
      tbody.innerHTML = ''; tfoot.innerHTML = '';
      PESSOAS.forEach(function (p, i) {
        var tr = el('tr');
        tr.innerHTML = '<th scope="row">' + p + '</th>';
        DIAS.forEach(function (_, d) {
          var td = el('td');
          var cell = el('div', 'o-cell');
          if (modo === 'vazio') { cell.innerHTML = '—'; }
          else if (modo === 'sk') { cell.className += ' o-cell--sk'; cell.innerHTML = '&nbsp;<br>&nbsp;'; }
          else {
            var folga = state.folgas[i].indexOf(d) !== -1;
            cell.className += folga ? ' o-cell--off' : ' o-cell--shift';
            cell.innerHTML = folga ? 'Folga' : TURNO;
            if (destaque && destaque.some(function (x) { return x[0] === i && x[1] === d; })) cell.className += ' o-cell--hl';
            if (mudou && mudou.some(function (x) { return x[0] === i && x[1] === d; })) cell.className += ' o-cell--changed';
          }
          td.appendChild(cell); tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      if (modo === 'cheio') {
        var cob = cobertura(state.folgas);
        var tr = el('tr');
        tr.innerHTML = '<th scope="row">Cobertura do salão</th>';
        DIAS.forEach(function (_, d) {
          var td = el('td'), n = cob[d], need = NECESSARIAS[d];
          var cls = n < need ? 'o-cov--low' : n > need ? 'o-cov--high' : 'o-cov--ok';
          var txt = n < need ? 'faltam ' + (need - n) : n > need ? 'sobra ' + (n - need) : 'atendida';
          td.innerHTML = '<div class="o-cov ' + cls + '"><span>' + n + ' de ' + need + '</span><small>' + txt + '</small></div>';
          tr.appendChild(td);
        });
        tfoot.appendChild(tr);
      }
    }

    function deficits() {
      var cob = cobertura(state.folgas);
      return DIAS.map(function (_, d) { return { d: d, n: cob[d], need: NECESSARIAS[d] }; }).filter(function (x) { return x.n < x.need; });
    }

    function renderPainel() {
      var cob = cobertura(state.folgas);
      var horasPlanejadas = cob.reduce(function (a, b) { return a + b; }, 0) * HORAS_DIA;
      var horasNecessarias = NECESSARIAS.reduce(function (a, b) { return a + b; }, 0) * HORAS_DIA;
      var def = deficits();
      var h = '';
      h += '<div class="o-demo-rules"><span class="o-rule">Jornada semanal: até 40h <em>· origem: rede</em></span><span class="o-rule">Intervalo entre jornadas: mínimo 11h <em>· origem: rede</em></span><span class="o-rule">Descanso: 2 dias por semana <em>· origem: loja</em></span></div>';
      h += '<p class="o-hours">Horas planejadas: <strong>' + horasPlanejadas + 'h</strong> · Horas necessárias: <strong>' + horasNecessarias + 'h</strong> · <span>' + (horasPlanejadas === horasNecessarias ? 'As horas fecham.' : 'As horas não fecham.') + (def.length ? ' A cobertura, não.' : ' E a cobertura também.') + '</span></p>';
      h += '<ul class="o-checks">' +
        check(true, 'Jornada semanal dentro do limite', '40h por pessoa (5 dias × 8h)') +
        check(true, 'Intervalo entre jornadas respeitado', '13h entre o fim às 22h e o início às 11h') +
        check(true, 'Dois dias de descanso para cada pessoa', 'Escala 5x2') +
        (def.length
          ? check(false, 'Cobertura insuficiente em ' + def.map(function (x) { return DIAS_LONGO[x.d]; }).join(', '), def.map(function (x) { return DIAS[x.d] + ': ' + x.n + ' escaladas para ' + x.need + ' necessárias'; }).join(' · '))
          : check(true, 'Cobertura atendida em todos os dias', 'Pessoas escaladas iguais às necessárias')) +
        '</ul>';

      if (def.length && state.fase !== 'sugestao') {
        h += '<div class="o-alert" role="alert"><p class="o-alert__t">' + IC_WARN + 'Há um déficit de cobertura no sábado.</p><p>Revise a alocação antes de concluir a aprovação.</p>' +
          '<div class="o-alert__actions"><button type="button" class="o-btn o-btn--dark o-btn--sm" data-demo="sugerir">Ver sugestão de ajuste</button></div></div>';
      } else if (state.fase === 'sugestao') {
        h += '<div class="o-alert"><p class="o-alert__t">' + IC_WARN + 'Sugestão de ajuste</p><p>Trocar a folga de Atendimento 1 de sábado para segunda. Segunda fica com 2 pessoas (necessárias: 2) e sábado com 4 (necessárias: 4). Jornada, intervalo e descanso continuam atendidos.</p>' +
          '<div class="o-alert__actions"><button type="button" class="o-btn o-btn--teal o-btn--sm" data-demo="aplicar">Aplicar ajuste</button><button type="button" class="o-btn o-btn--quiet o-btn--sm" data-demo="manter">Manter como está</button></div></div>';
      } else if (state.fase !== 'publicada') {
        h += '<div class="o-alert o-alert--ok"><p class="o-alert__t">' + IC_OK + 'Pontos de atenção resolvidos.</p><p>Confira a escala e confirme a revisão para publicar.</p></div>';
      }

      if (state.fase === 'publicada') {
        h += '<div class="o-alert o-alert--ok" role="status"><p class="o-alert__t">' + IC_OK + 'Escala publicada.</p><p>A equipe já pode consultar seus horários. Uma nova alteração gera nova versão.</p>' +
          '<div class="o-alert__actions"><button type="button" class="o-btn o-btn--quiet o-btn--sm" data-demo="reiniciar">Reiniciar demonstração</button></div></div>';
      } else {
        var podeRevisar = state.viuSugestao && !def.length;
        var podeAprovar = podeRevisar && state.revisado;
        h += '<div class="o-approve"><label><input type="checkbox" data-demo="revisar"' + (podeRevisar ? '' : ' disabled') + (state.revisado ? ' checked' : '') + ' /> Revisei os pontos de atenção e a cobertura</label>' +
          '<button type="button" class="o-btn o-btn--teal" data-demo="aprovar"' + (podeAprovar ? '' : ' disabled aria-describedby="demo-why"') + '>Aprovar e publicar</button>' +
          (podeAprovar ? '' : '<p class="o-help" id="demo-why" style="flex-basis:100%">' + (def.length ? 'A publicação fica disponível depois de resolver o déficit de cobertura.' : 'Confirme a revisão para habilitar a publicação.') + '</p>') + '</div>';
      }
      panel.innerHTML = h;
    }

    function check(ok, t, s) {
      return '<li class="o-check ' + (ok ? 'o-check--ok' : 'o-check--warn') + '"><span class="o-check__ic">' + (ok ? IC_OK : IC_WARN) + '</span><span><span class="o-sr">' + (ok ? 'Conferido: ' : 'Ponto de atenção: ') + '</span>' + t + '<small>' + s + '</small></span></li>';
    }

    function gerar() {
      btnGerar.disabled = true;
      state = { fase: 'gerando', folgas: FOLGAS_INICIAIS.map(function (f) { return f.slice(); }), viuSugestao: false, revisado: false };
      desenharGrade('sk');
      panel.innerHTML = '<p class="o-app__empty">Gerando a escala e conferindo as regras configuradas…</p>';
      setTimeout(function () {
        state.fase = 'revisao';
        desenharGrade('cheio');
        setStatus('warn', 'Em revisão', IC_WARN);
        renderPainel();
        btnGerar.disabled = false;
        btnGerar.lastChild.textContent = ' Gerar de novo';
      }, reduceMotion ? 50 : 1400);
    }

    panel.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-demo]');
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-demo');
      if (a === 'sugerir') {
        state.fase = 'sugestao'; state.viuSugestao = true;
        desenharGrade('cheio', [[0, 5], [0, 0]]);
        renderPainel();
        focar('aplicar');
      } else if (a === 'aplicar') {
        state.folgas[0] = [0, 6];
        state.fase = 'revisao';
        desenharGrade('cheio', null, [[0, 5], [0, 0]]);
        renderPainel();
        focar('revisar');
      } else if (a === 'manter') {
        state.fase = 'revisao';
        desenharGrade('cheio');
        renderPainel();
      } else if (a === 'aprovar') {
        state.fase = 'publicada';
        setStatus('ok', 'Publicada', IC_OK);
        renderPainel();
        focar('reiniciar');
      } else if (a === 'reiniciar') {
        state = { fase: 'vazio', folgas: null, viuSugestao: false, revisado: false };
        desenharGrade('vazio');
        setStatus('neutral', 'Rascunho', IC_DRAFT);
        panel.innerHTML = '<p class="o-app__empty">Toque em <strong>Gerar escala</strong> para ver a primeira proposta.</p>';
        btnGerar.lastChild.textContent = ' Gerar escala';
        btnGerar.focus();
      }
    });
    panel.addEventListener('change', function (ev) {
      if (ev.target.getAttribute('data-demo') === 'revisar') {
        state.revisado = ev.target.checked;
        renderPainel();
        focar(state.revisado ? 'aprovar' : 'revisar');
      }
    });
    function focar(acao) { var n = panel.querySelector('[data-demo="' + acao + '"]'); if (n && !n.disabled) n.focus({ preventScroll: true }); }

    btnGerar.addEventListener('click', gerar);
    desenharGrade('vazio');
  })();

  /* ============================================================
     HERO — escala que se monta sozinha (dados demonstrativos)
     Déficit de cobertura no sábado aparece, é revisado e se resolve.
     ============================================================ */
  (function heroEscala() {
    var card = $('hero-escala');
    if (!card) return;
    var grid = card.querySelector('[data-h="grid"]');
    var msg = card.querySelector('[data-h="msg"]');
    var estado = card.querySelector('[data-h="estado"]');
    var estadoTxt = card.querySelector('[data-h="estado-txt"]');
    var DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    var EQUIPE = [['AN', 'Salão'], ['BR', 'Salão'], ['CA', 'Caixa'], ['DI', 'Salão'], ['EL', 'Recepção']];
    var NEC = [3, 4, 3, 3, 4, 5, 3];
    var FOLGAS = [[5, 6], [2, 3], [0, 6], [2, 3], [1, 4]];
    var cells = [], covs = [];
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, reduceMotion ? 0 : ms)); }

    var h = '<span></span>' + DIAS.map(function (d) { return '<span class="o-hcard__dh">' + d + '</span>'; }).join('');
    EQUIPE.forEach(function (p) {
      h += '<span class="o-hcard__p"><span class="o-av">' + p[0] + '</span><span>' + p[1] + '</span></span>';
      for (var d = 0; d < 7; d++) h += '<span class="o-hc"></span>';
    });
    h += '<span class="o-hcard__covl">Cobertura</span>';
    for (var d2 = 0; d2 < 7; d2++) h += '<span class="o-hcov"><span class="o-hcov__fill"></span><span class="o-hcov__t"></span></span>';
    grid.innerHTML = h;
    var allCells = grid.querySelectorAll('.o-hc');
    for (var i = 0; i < EQUIPE.length; i++) { cells.push([]); for (var j = 0; j < 7; j++) cells[i].push(allCells[i * 7 + j]); }
    covs = Array.prototype.slice.call(grid.querySelectorAll('.o-hcov'));

    function setEstado(tipo, txt) { estado.className = 'o-state o-state--' + tipo + ' o-hcard__state'; estadoTxt.textContent = txt; }
    function pintar(i, d, animar) {
      var c = cells[i][d], off = FOLGAS[i].indexOf(d) !== -1;
      c.className = 'o-hc ' + (off ? 'is-off' : 'is-shift') + (animar && !reduceMotion ? ' is-in' : '');
      c.textContent = off ? 'Folga' : '8h';
    }
    function cobertura() {
      for (var d = 0; d < 7; d++) {
        var n = EQUIPE.length - FOLGAS.filter(function (f) { return f.indexOf(d) !== -1; }).length;
        var el2 = covs[d], need = NEC[d];
        el2.className = 'o-hcov ' + (n < need ? 'is-low' : n > need ? 'is-high' : 'is-ok');
        el2.firstChild.style.transform = 'scaleY(' + Math.min(1, n / 5).toFixed(3) + ')';
        el2.lastChild.innerHTML = n + '/' + need + '<br>' + (n < need ? 'falta ' + (need - n) : n > need ? 'sobra' : 'ok');
      }
    }
    function alerta(tipo, titulo, texto) {
      var ic = tipo === 'ok'
        ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8.5 3.2 3L13 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.8 15 14H1L8 1.8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.2v3.6M8 11.6v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
      msg.innerHTML = '<div class="o-alert' + (tipo === 'ok' ? ' o-alert--ok' : '') + '"><p class="o-alert__t">' + ic + titulo + '</p><p>' + texto + '</p></div>';
    }

    function rodar() {
      timers.forEach(clearTimeout); timers = [];
      FOLGAS[0] = [5, 6];
      msg.innerHTML = '';
      setEstado('neutral', 'Gerando escala');
      cells.forEach(function (row) { row.forEach(function (c) { c.className = 'o-hc'; c.textContent = ''; }); });
      covs.forEach(function (c) { c.className = 'o-hcov'; c.firstChild.style.transform = 'scaleY(0)'; c.lastChild.textContent = ''; });
      var t = 300;
      for (var d = 0; d < 7; d++) for (var i = 0; i < EQUIPE.length; i++) (function (i, d, t) { later(function () { pintar(i, d, true); }, t); })(i, d, t + (d * EQUIPE.length + i) * 45);
      t += 7 * EQUIPE.length * 45 + 250;
      later(function () {
        cobertura();
        setEstado('warn', 'Em revisão');
        cells[0][5].classList.add('is-hl');
        alerta('warn', 'Há um déficit de cobertura no sábado.', 'Revise a alocação antes de concluir a aprovação.');
      }, t);
      t += 2600;
      later(function () {
        cells[0][0].classList.add('is-hl');
        alerta('warn', 'Sugestão de ajuste', 'Trocar a folga de AN de sábado para segunda.');
      }, t);
      t += 2200;
      later(function () {
        FOLGAS[0] = [0, 6];
        pintar(0, 5, true); pintar(0, 0, true);
        cells[0][5].classList.add('is-fixed'); cells[0][0].classList.add('is-fixed');
        cobertura();
        alerta('ok', 'Cobertura atendida em todos os dias.', 'O gestor revisou o ajuste e pode aprovar a publicação.');
      }, t);
      t += 2400;
      later(function () {
        setEstado('ok', 'Publicada');
        alerta('ok', 'Escala aprovada e publicada.', 'A equipe já pode consultar seus horários.');
      }, t);
    }

    if (reduceMotion) {
      // estado final estático, sem animação
      FOLGAS[0] = [0, 6];
      for (var a = 0; a < EQUIPE.length; a++) for (var b = 0; b < 7; b++) pintar(a, b, false);
      cobertura();
      setEstado('ok', 'Publicada');
      alerta('ok', 'Cobertura atendida em todos os dias.', 'O ajuste do sábado foi revisado antes da aprovação.');
      return;
    }
    rodar();
    // repete quando o hero volta a aparecer, depois de concluído
    if ('IntersectionObserver' in window) {
      var visto = true, concluiu = false;
      later(function () { concluiu = true; }, 300 + 35 * 45 + 250 + 2600 + 2200 + 2400 + 100);
      new IntersectionObserver(function (en) {
        var v = en[0].isIntersecting;
        if (v && !visto && concluiu) { concluiu = false; rodar(); later(function () { concluiu = true; }, 10000); }
        visto = v;
      }, { threshold: 0.35 }).observe(card);
    }
  })();

  /* ============================================================
     Revelação suave ao rolar
     ============================================================ */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var alvos = qsa('.o-pillar, .o-how__step, .o-clear__col, .o-faq__item, .o-about .o-sec-head, .o-clear .o-sec-head, .o-faq .o-sec-head, .o-app, .o-who');
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    alvos.forEach(function (n, i) { n.classList.add('o-reveal'); n.style.transitionDelay = ((i % 5) * 50) + 'ms'; io.observe(n); });
  }

  /* Âncoras internas: mover o foco para o destino (acessibilidade) */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[data-scroll]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var alvo = document.getElementById(id);
    if (!alvo) return;
    ev.preventDefault();
    alvo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
    alvo.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });
})();
