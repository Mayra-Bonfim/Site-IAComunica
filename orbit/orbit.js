/* ============================================================
   ORBIT — Interface da página /orbit/
   Simulador (usa OrbitCalc de orbit-calc.js) + demonstração de escala.
   Sem dependências, sem envio de dados, sem localStorage.
   ============================================================ */
(function () {
  'use strict';

  var C = window.OrbitCalc;
  if (!C) return;

  var WHATSAPP = '5561998747075'; // WhatsApp de contato da página Orbit (o número não é exibido na página)
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
      ['r-quadro', 'r-acres-mensal', 'r-acres-anual', 'r-primeiro-ano', 'r-mensal', 'r-pct'].forEach(function (id) { $(id).textContent = '—'; $(id).classList.add('is-na'); });
      $('r-novas').textContent = '—'; $('r-novas').removeAttribute('data-v'); $('r-jornada').textContent = '';
      $('viz').innerHTML = ''; $('viz-legenda').innerHTML = ''; prevNovas = 0;
      $('r-compare').querySelector('tbody').innerHTML = ''; $('r-bars').innerHTML = ''; $('r-memoria').innerHTML = '';
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
    $('r-primeiro-ano-label').textContent = 'Primeiro ano (' + periodo(r.mesInicio) + ' · ' + r.mesesPrimeiroAno + (r.mesesPrimeiroAno === 1 ? ' mês)' : ' meses)');
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
          '<span class="o-bar__track"><span class="o-bar__add" style="transform:scaleX(0)"></span><span class="o-bar__base" style="transform:scaleX(0)"></span></span>' +
          '<span class="o-bar__val">' + brl0(c.mensal) + '</span>';
        bars.appendChild(b);
        var add = b.querySelector('.o-bar__add'), bs = b.querySelector('.o-bar__base');
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          add.style.transform = 'scaleX(' + total.toFixed(4) + ')';
          bs.style.transform = 'scaleX(' + base.toFixed(4) + ')';
        }); });
      }
    });
  }

  function periodo(m) { return m === 12 ? 'só dezembro' : 'de ' + MESES[m - 1] + ' a dezembro'; }

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
        r.quadroDemandaJornadaAtual > r.pessoas ? 'A demanda informada já pede mais gente do que a equipe de hoje: vale revisar os dados ou a cobertura atual.' : r.quadroDemandaJornadaAtual < r.pessoas ? 'A demanda informada pede menos gente do que a equipe de hoje: confira se ela inclui todas as funções, faixas de horário, abertura e fechamento.' : null));
    }
    out.push(li('Novas contratações',
      'máximo(0; ' + num(r.alvo.referencia) + ' − ' + num(r.disponivel) + ' disponíveis) = ' + num(r.contratacoes),
      'Quadro futuro total = ' + num(r.disponivel) + ' disponíveis + ' + num(r.contratacoes) + ' contratações = ' + num(r.quadroFuturo) + '. Nenhum desligamento é presumido.' +
      (r.futuraNaoMenor && r.base === 'horas' ? ' A jornada futura não é menor que a atual: por esta regra, não há horas a repor.' : '')));

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
        brl(r.acrescimoMensal) + ' × ' + r.mesesPrimeiroAno + (r.mesesPrimeiroAno === 1 ? ' mês' : ' meses') + ' (' + periodo(r.mesInicio) + ') = ' + brl(r.primeiroAno),
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
      linhas.push('• Primeiro ano (' + periodo(r.mesInicio) + '): ' + brl(r.primeiroAno));
      if (r.percentual !== null) linhas.push('• Impacto no custo de pessoal: +' + num(r.percentual, 1) + '%');
    }
    linhas.push((r.base === 'demanda' ? 'Estimativa por demanda em horas' : 'Estimativa por horas') + ', ainda sem validação da distribuição de turnos. Parâmetros a validar com contador/DP.');
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
      ? 'Olá! Fiz uma simulação na página do Orbit e quero conversar sobre ela.\n\n' + resumo
      : 'Olá! Quero conhecer o Orbit e o simulador de quadro e custo de pessoal.';
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
     ORBIT EM AÇÃO — galeria de telas reais + ampliação
     ============================================================ */
  (function galeria() {
    var lista = document.querySelector('.o-gal__tabs');
    if (!lista) return;
    var tabs = qsa('[role="tab"]', lista);

    function ativar(tab, focar) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var painel = $(t.getAttribute('aria-controls'));
        painel.hidden = !on;
        if (on && !reduceMotion) { painel.classList.remove('is-in'); void painel.offsetWidth; painel.classList.add('is-in'); }
      });
      if (focar) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { ativar(t, false); });
      t.addEventListener('keydown', function (ev) {
        var k = ev.key, alvo = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') alvo = tabs[(i + 1) % tabs.length];
        else if (k === 'ArrowUp' || k === 'ArrowLeft') alvo = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (k === 'Home') alvo = tabs[0];
        else if (k === 'End') alvo = tabs[tabs.length - 1];
        if (alvo) { ev.preventDefault(); ativar(alvo, true); }
      });
    });

    // ---- ampliação (dialog nativo: Esc fecha, foco fica dentro)
    var dlg = $('lightbox'), img = $('lb-img'), scroll = $('lb-scroll'), btnZoom = $('lb-zoom'), origem = null;
    if (!dlg || typeof dlg.showModal !== 'function') {
      // sem suporte a <dialog>: abre a imagem em nova aba
      qsa('[data-ampliar]').forEach(function (b) {
        b.addEventListener('click', function () { window.open(b.querySelector('img').currentSrc || b.querySelector('img').src, '_blank', 'noopener'); });
      });
      return;
    }
    function setZoom(on) {
      dlg.classList.toggle('is-zoom', on);
      btnZoom.setAttribute('aria-pressed', on ? 'true' : 'false');
      btnZoom.textContent = on ? 'Ajustar à tela' : 'Ver em tamanho real';
    }
    qsa('[data-ampliar]').forEach(function (b) {
      b.addEventListener('click', function () {
        var fonte = b.querySelector('img');
        origem = b;
        img.src = fonte.currentSrc || fonte.src;
        img.alt = fonte.alt;
        img.width = fonte.width; img.height = fonte.height;
        img.setAttribute('width', fonte.getAttribute('width')); img.setAttribute('height', fonte.getAttribute('height'));
        var painel = b.closest('figure');
        $('lb-titulo').textContent = b.getAttribute('data-titulo') || (painel ? painel.querySelector('figcaption strong').textContent : 'Tela do Orbit');
        // no celular, abre direto em tamanho real para dar leitura
        setZoom(window.innerWidth < 768);
        dlg.showModal();
        document.dispatchEvent(new CustomEvent('orbit:lightbox', { detail: true }));
        scroll.scrollTop = 0; scroll.scrollLeft = 0;
        $('lb-fechar').focus();
      });
    });
    btnZoom.addEventListener('click', function () { setZoom(!dlg.classList.contains('is-zoom')); });
    img.addEventListener('click', function () { setZoom(!dlg.classList.contains('is-zoom')); });
    $('lb-fechar').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { img.removeAttribute('src'); if (origem) origem.focus(); document.dispatchEvent(new CustomEvent('orbit:lightbox', { detail: false })); });
    // prende o foco nos controles do diálogo
    dlg.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Tab') return;
      var f = qsa('button, [tabindex="0"]', dlg).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  })();

  /* ============================================================
     HERO — carrossel de telas reais (avanço automático com pausa)
     ============================================================ */
  (function carrossel() {
    var car = $('hero-carrossel');
    if (!car) return;
    var slides = qsa('.o-car__slide', car);
    var dots = qsa('.o-car__dot', car);
    var cap = $('car-cap'), btnPause = $('car-pause'), txtPause = $('car-pause-txt');
    var INTERVALO = 4500;
    var atual = 0, timer = null;
    var pausadoUsuario = reduceMotion; // reduced-motion: sem avanço automático
    var hover = false, foco = false, lightbox = false;

    function mostrar(i, porUsuario) {
      atual = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) {
        var on = k === atual;
        s.classList.toggle('is-on', on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
        var b = s.querySelector('.o-car__shot');
        b.tabIndex = on ? 0 : -1;
        var im = s.querySelector('img');
        if (on && im.loading === 'lazy') im.loading = 'eager';
      });
      dots.forEach(function (d, k) { if (k === atual) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      cap.textContent = slides[atual].getAttribute('data-cap');
      cap.setAttribute('aria-live', porUsuario ? 'polite' : 'off');
      // pré-carrega a próxima para a transição não piscar
      var prox = slides[(atual + 1) % slides.length].querySelector('img');
      if (prox.loading === 'lazy') prox.loading = 'eager';
      reiniciar();
    }
    function rodando() { return !pausadoUsuario && !hover && !foco && !lightbox && !document.hidden; }
    function reiniciar() {
      clearTimeout(timer);
      car.classList.toggle('is-running', rodando());
      // reinicia a barra de progresso do indicador ativo
      dots.forEach(function (d) { d.classList.remove('is-prog'); });
      if (rodando()) {
        var d = dots[atual]; void d.offsetWidth; d.classList.add('is-prog');
        timer = setTimeout(function () { mostrar(atual + 1, false); }, INTERVALO);
      }
    }
    function setPausa(p) {
      pausadoUsuario = p;
      btnPause.setAttribute('aria-pressed', p ? 'true' : 'false');
      txtPause.textContent = p ? 'Retomar' : 'Pausar';
      btnPause.setAttribute('aria-label', p ? 'Retomar a troca automática de telas' : 'Pausar a troca automática de telas');
      car.classList.toggle('is-paused', p);
      reiniciar();
    }

    $('car-prev').addEventListener('click', function () { mostrar(atual - 1, true); });
    $('car-next').addEventListener('click', function () { mostrar(atual + 1, true); });
    btnPause.addEventListener('click', function () { setPausa(!pausadoUsuario); });
    dots.forEach(function (d) { d.addEventListener('click', function () { mostrar(Number(d.getAttribute('data-ir')), true); }); });
    car.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(atual + 1, true); if (ev.target.classList.contains('o-car__dot')) dots[atual].focus(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(atual - 1, true); if (ev.target.classList.contains('o-car__dot')) dots[atual].focus(); }
    });
    car.addEventListener('mouseenter', function () { hover = true; reiniciar(); });
    car.addEventListener('mouseleave', function () { hover = false; reiniciar(); });
    car.addEventListener('focusin', function () { foco = true; reiniciar(); });
    car.addEventListener('focusout', function (ev) { if (!car.contains(ev.relatedTarget)) { foco = false; reiniciar(); } });
    document.addEventListener('visibilitychange', reiniciar);
    document.addEventListener('orbit:lightbox', function (ev) { lightbox = !!ev.detail; reiniciar(); });

    setPausa(pausadoUsuario);
    mostrar(0, false);
  })();

  /* ============================================================
     Revelação suave ao rolar
     ============================================================ */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var alvos = qsa('.o-pillar, .o-how__step, .o-clear__col, .o-faq__item, .o-about .o-sec-head, .o-clear .o-sec-head, .o-faq .o-sec-head, .o-who');
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
