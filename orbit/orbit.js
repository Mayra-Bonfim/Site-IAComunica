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

  var MAX_FAIXAS = 8;
  var MAX_FUNCOES = 40;
  var REGIME_NOME = { '6x1': '6x1', '5x2': '5x2', '4x3': '4x3', '12x36': '12x36' };
  var DIAS_ABREV = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

  var VAZIO = {
    jornada: '44', ratual: '6x1', etapa: '40', rfut: '5x2', dias: ['100', '100', '100', '100', '100', '100', '100'],
    funcoes: [{ nome: '', hoje: '', salario: '', faixas: [['', '', '']] }]
  };

  var CAMPO_ERRO = {
    'f-jatual': 'e-jatual', 'f-intervalo': 'e-intervalo',
    'f-encargos': 'e-encargos', 'f-ben': 'e-ben', 'f-vr': 'e-vr', 'f-vt': 'e-vt', 'f-saude': 'e-saude'
  };
  var CAMPO_INPUT = {
    jornadaAtual: 'f-jatual', intervalo: 'f-intervalo',
    encargosPct: 'f-encargos', beneficios: 'f-ben', vr: 'f-vr', vt: 'f-vt', saude: 'f-saude', mesInicio: 'f-mes'
  };
  var touched = {};
  var modoExemplo = true;
  var ultimo = null;
  var prevNewDots = 0;
  var importado = false;

  /** Funções na tela. `semana` só existe quando veio da escala importada. */
  var FUN = [];

  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function marcar(name, value) { var r = form.querySelector('input[name="' + name + '"][value="' + value + '"]'); if (r) r.checked = true; }
  function val(id) { return parseBR($(id).value); }

  /** "08:30" -> 8.5 ; vazio ou inválido -> NaN */
  function parseHora(s) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
    if (!m) return NaN;
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return NaN;
    return h + mi / 60;
  }
  function fmtHora(h) { var t = Math.round(h * 60), hh = Math.floor(t / 60) % 24, mm = t % 60; return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }

  /* ---------- Funções (cartões) e faixas de horário ---------- */
  function linhaFaixa(n, k, f) {
    var p = 'f-func-' + n + '-faixa-' + k + '-';
    return '<div class="o-faixa o-faixa--func" role="group" aria-label="Faixa ' + k + ' da função ' + n + '">' +
      '<div class="o-field"><label class="o-label o-label--sm" for="' + p + 'ini">Início</label>' +
        '<div class="o-input-wrap"><input id="' + p + 'ini" class="o-input" type="time" step="600" value="' + esc(f[0]) + '" /></div></div>' +
      '<div class="o-field"><label class="o-label o-label--sm" for="' + p + 'fim">Fim</label>' +
        '<div class="o-input-wrap"><input id="' + p + 'fim" class="o-input" type="time" step="600" value="' + esc(f[1]) + '" /></div></div>' +
      '<div class="o-field"><label class="o-label o-label--sm" for="' + p + 'pessoas">Pessoas</label>' +
        '<div class="o-input-wrap"><input id="' + p + 'pessoas" class="o-input" type="text" inputmode="numeric" data-tipo="inteiro" value="' + esc(f[2]) + '" /></div></div>' +
      '<button type="button" class="o-faixa__rm" data-rmfaixa="' + (n - 1) + ',' + (k - 1) + '" aria-label="Remover a faixa ' + k + ' da função ' + n + '"><span aria-hidden="true">×</span></button>' +
    '</div>';
  }

  function resumoSemana(semana) {
    return semana.map(function (faixas, d) {
      if (!faixas || !faixas.length) return DIAS_ABREV[d].slice(0, 3) + ' fechado';
      var pico = faixas.reduce(function (m, x) { return Math.max(m, x.pessoas); }, 0);
      return DIAS_ABREV[d].slice(0, 3) + ' ' + fmtHora(faixas[0].ini) + '–' + fmtHora(faixas[faixas.length - 1].fim) + ' (até ' + pico + ')';
    }).join(' · ');
  }

  function resumoEscala(esc) {
    return esc.dias.map(function (d, i) {
      var nome = DIAS_ABREV[i].slice(0, 3);
      return d.pessoas > 0 ? nome + ' ' + num(d.pessoas) + (d.pessoas === 1 ? ' pessoa' : ' pessoas') + ', ' + horas(d.horas) : nome + ' fechado';
    }).join(' · ');
  }

  function cartaoFuncao(n, f) {
    var p = 'f-func-' + n + '-';
    var corpo;
    if (f.escala) {
      corpo = '<p class="o-funcao__imp"><strong>Da sua escala (pessoas e horas trabalhadas por dia):</strong> ' + esc(resumoEscala(f.escala)) + '</p>';
    } else if (f.semana) {
      corpo = '<p class="o-funcao__imp"><strong>Demanda da escala importada:</strong> ' + esc(resumoSemana(f.semana)) + '</p>';
    } else {
      corpo = '<div class="o-funcao__faixas">' + f.faixas.map(function (fx, k) { return linhaFaixa(n, k + 1, fx); }).join('') + '</div>' +
        '<button type="button" class="o-btn o-btn--quiet o-btn--sm" data-addfaixa="' + (n - 1) + '"' + (f.faixas.length >= MAX_FAIXAS ? ' disabled' : '') + '>+ Adicionar faixa de horário</button>';
    }
    return '<div class="o-funcao" role="group" aria-label="Função ' + n + '">' +
      '<div class="o-funcao__topo">' +
        '<div class="o-field o-funcao__nome"><label class="o-label o-label--sm" for="' + p + 'nome">Função ou equipe</label>' +
          '<div class="o-input-wrap"><input id="' + p + 'nome" class="o-input" type="text" maxlength="40" value="' + esc(f.nome) + '" placeholder="ex.: Recepcionista" autocomplete="off" /></div></div>' +
        '<div class="o-field"><label class="o-label o-label--sm" for="' + p + 'hoje">Pessoas hoje</label>' +
          '<div class="o-input-wrap"><input id="' + p + 'hoje" class="o-input" type="text" inputmode="numeric" data-tipo="inteiro" value="' + esc(f.hoje) + '" /></div></div>' +
        '<div class="o-field"><label class="o-label o-label--sm" for="' + p + 'salario">Salário bruto</label>' +
          '<div class="o-input-wrap o-input-wrap--prefix"><span class="o-input-prefix">R$</span><input id="' + p + 'salario" class="o-input" type="text" inputmode="decimal" data-tipo="brl" value="' + esc(f.salario) + '" /></div></div>' +
        '<button type="button" class="o-faixa__rm" data-rmfunc="' + (n - 1) + '" aria-label="Remover a função ' + n + '"><span aria-hidden="true">×</span></button>' +
      '</div>' + corpo +
      '<p class="o-error o-funcao__erro" id="e-func-' + n + '" hidden></p>' +
    '</div>';
  }

  /** Copia o que está nos campos para FUN (a semana importada é preservada). */
  function lerFuncoesCampos() {
    FUN = FUN.map(function (f, i) {
      var n = i + 1, p = 'f-func-' + n + '-';
      if (!$(p + 'nome')) return f;
      var o = { nome: $(p + 'nome').value, hoje: $(p + 'hoje').value, salario: $(p + 'salario').value, semana: f.semana || null, escala: f.escala || null, nomes: f.nomes || null, faixas: [] };
      if (!f.semana && !f.escala) {
        o.faixas = f.faixas.map(function (fx, k) {
          var q = p + 'faixa-' + (k + 1) + '-';
          return [$(q + 'ini').value, $(q + 'fim').value, $(q + 'pessoas').value];
        });
      }
      return o;
    });
  }

  function desenharFuncoes(focar) {
    Object.keys(touched).forEach(function (k) { if (k.indexOf('f-func-') === 0) delete touched[k]; });
    $('funcoes').innerHTML = FUN.map(function (f, i) { return cartaoFuncao(i + 1, f); }).join('');
    var so1 = FUN.length === 1;
    qsa('[data-rmfunc]', $('funcoes')).forEach(function (b) { b.disabled = so1; });
    qsa('.o-funcao__faixas', $('funcoes')).forEach(function (box) {
      var rms = qsa('[data-rmfaixa]', box);
      rms.forEach(function (b) { b.disabled = rms.length === 1; });
    });
    var cheio = FUN.length >= MAX_FUNCOES;
    $('funcao-add').disabled = cheio;
    $('funcao-limite').hidden = !cheio;
    $('dias-bloco').hidden = importado;
    $('faixa-ajuda').hidden = importado;
    desenharEscala();
    $('imp-voltar').hidden = !importado;
    if (focar && $(focar)) $(focar).focus();
  }

  /** Tabela "o que o simulador leu": pessoas e horas de cada dia, somando as equipes da escala importada. */
  function desenharEscala() {
    var box = $('escala-resumo'), com = FUN.filter(function (f) { return f.escala; });
    box.hidden = !com.length;
    if (!com.length) return;
    var linhas = '', tp = 0, th = 0;
    for (var d = 0; d < 7; d++) {
      var p = 0, h = 0;
      com.forEach(function (f) { p += f.escala.dias[d].pessoas; h += f.escala.dias[d].horas; });
      tp += p; th += h;
      linhas += '<tr><td>' + DIAS_ABREV[d].charAt(0).toUpperCase() + DIAS_ABREV[d].slice(1) + '</td><td>' + (p ? num(p) : '—') + '</td><td>' + (h ? horas(Math.round(h * 10) / 10) : '—') + '</td></tr>';
    }
    $('escala-tabela').querySelector('tbody').innerHTML = linhas +
      '<tr class="is-total"><td>Semana</td><td>' + num(tp) + '</td><td>' + horas(Math.round(th * 10) / 10) + '</td></tr>';
  }

  function funcoesDoPerfil(lista) {
    return lista.map(function (f) {
      return { nome: f.nome, hoje: f.hoje, salario: f.salario, semana: null, escala: null, faixas: f.faixas.map(function (x) { return x.slice(); }) };
    });
  }

  function lerEntradas() {
    lerFuncoesCampos();
    var ratual = radio('ratual'), rfut = radio('rfut'), benmodo = radio('benmodo');
    var dias = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return val('f-dia-' + i); }).map(function (v) { return v === null ? NaN : v; });
    var e = {
      regimeAtual: ratual,
      jornadaAtual: ratual === '12x36' ? 42 : val('f-jatual'),
      regimeFuturo: rfut,
      etapa: Number(radio('etapa')),
      intervalo: val('f-intervalo'),
      base: 'equipe',
      dias: dias,
      funcoes: FUN.map(function (f) {
        var hoje = parseBR(f.hoje), sal = parseBR(f.salario);
        var o = { nome: f.nome.trim(), hoje: hoje === null ? NaN : hoje, salario: sal === null ? 0 : sal };
        if (f.escala) { o.escala = f.escala; o.nomes = f.nomes || null; o.semana = null; o.manual = false; }
        else if (f.semana) { o.semana = f.semana; o.manual = false; }
        else {
          var faixas = f.faixas.map(function (x) {
            var p = parseBR(x[2]);
            return { ini: parseHora(x[0]), fim: parseHora(x[1]), pessoas: p === null ? NaN : p };
          });
          o.manual = true; o.faixasBrutas = faixas;
          o.semana = C.semanaDeFaixas(faixas, dias.map(function (m) { return isNaN(m) ? 0 : m; }));
        }
        return o;
      }),
      encargosPct: val('f-encargos'),
      beneficiosModo: benmodo,
      mesInicio: Number($('f-mes').value)
    };
    if (e.intervalo === null) e.intervalo = 0;
    if (benmodo === 'detalhe') {
      e.vr = val('f-vr'); e.vt = val('f-vt'); e.saude = val('f-saude');
      ['vr', 'vt', 'saude'].forEach(function (k) { if (e[k] === null) e[k] = 0; });
    } else {
      e.beneficios = val('f-ben'); if (e.beneficios === null) e.beneficios = 0;
    }
    if (e.encargosPct === null) e.encargosPct = 0;
    if (e.jornadaAtual === null) e.jornadaAtual = NaN;
    return e;
  }

  /** Simula e junta a validação do movimento semanal (só no modo manual). */
  function simular(e) {
    var extra = [];
    if (!importado) {
      var algum = false;
      e.dias.forEach(function (m, i) {
        if (!(m >= 0 && m <= 500)) extra.push({ campo: 'dia-' + i, mensagem: 'O movimento do dia precisa ficar entre 0% e 500%.' });
        else if (m > 0) algum = true;
      });
      if (!algum && !extra.length) extra.push({ campo: 'dias', mensagem: 'Pelo menos um dia da semana precisa ter movimento.' });
    }
    var r = C.simularFuncoes(e);
    if (r.ok && !extra.length) return r;
    var vistos = {}, erros = (r.ok ? [] : r.erros).concat(extra).filter(function (it) { var k = it.campo + it.mensagem; var m = /^funcao-(d+)-faixa-d+$/.exec(it.campo); if (m) k = 'f' + m[1] + it.mensagem; if (vistos[k]) return false; vistos[k] = 1; return true; });
    return { ok: false, erros: erros };
  }

  /** campo do motor -> id do input */
  function inputDoCampo(campo) {
    if (CAMPO_INPUT[campo]) return CAMPO_INPUT[campo];
    var m = /^funcao-(\d+)-(hoje|salario)$/.exec(campo);
    if (m) return 'f-func-' + m[1] + '-' + m[2];
    m = /^funcao-(\d+)-faixa-(\d+)$/.exec(campo);
    if (m) return 'f-func-' + m[1] + '-faixa-' + m[2] + '-ini';
    m = /^funcao-(\d+)-faixas$/.exec(campo);
    if (m) return $('f-func-' + m[1] + '-faixa-1-ini') ? 'f-func-' + m[1] + '-faixa-1-ini' : 'f-func-' + m[1] + '-nome';
    m = /^dia-(\d)$/.exec(campo);
    if (m) return 'f-dia-' + m[1];
    if (campo === 'dias') return 'f-dia-0';
    if (campo === 'funcoes') return 'f-func-1-hoje';
    if (campo === 'regimeFuturo') return 'e-rfut';
    return null;
  }
  function caixaErro(inputId) {
    if (CAMPO_ERRO[inputId]) return CAMPO_ERRO[inputId];
    var m = /^f-func-(\d+)-/.exec(inputId);
    if (m) return 'e-func-' + m[1];
    if (/^f-dia-/.test(inputId)) return 'e-dias';
    return null;
  }

  function mostrarErros(erros) {
    var porInput = {};
    erros.forEach(function (x) { var id = inputDoCampo(x.campo); if (id && !porInput[id]) porInput[id] = x.mensagem; });
    qsa('.o-error', form).forEach(function (b) { b.hidden = true; b.textContent = ''; });
    qsa('.o-input', form).forEach(function (i) { i.removeAttribute('aria-invalid'); var w = i.closest('.o-input-wrap'); if (w) w.classList.remove('is-invalid'); });
    Object.keys(porInput).forEach(function (id) {
      if (id === 'e-rfut') { var b0 = $('e-rfut'); b0.textContent = porInput[id]; b0.hidden = false; return; }
      var input = $(id);
      if (!input || !touched[id]) return;
      var box = $(caixaErro(id));
      if (box && !box.textContent) { box.textContent = porInput[id]; box.hidden = false; }
      input.setAttribute('aria-invalid', 'true');
      var wrap = input.closest('.o-input-wrap'); if (wrap) wrap.classList.add('is-invalid');
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
    box.setAttribute('aria-label', 'Quadro futuro de ' + pessoas(total) + ': ' + pessoas(total - novas) + ' da equipe de hoje e ' + num(novas) + ' novas contratações.');
    $('viz-legenda').innerHTML = '<span><i></i>equipe de hoje (' + num(total - novas) + ')</span><span><i class="is-new"></i>novas contratações (' + num(novas) + ')</span>' +
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

  /** Primeira tela: nada enviado e nada digitado. */
  function semDados(e) {
    return !importado && !Object.keys(touched).length &&
      FUN.every(function (f) { return !String(f.nome).trim() && !String(f.hoje).trim() && !String(f.salario).trim() && (f.faixas || []).every(function (x) { return !x[0] && !x[1] && !x[2]; }); });
  }

  function render() {
    var e = lerEntradas();
    var r = simular(e);
    var result = $('resultado');
    mostrarErros(r.ok ? [] : r.erros);
    explicarVT(e);
    explicarRegime(e);

    var errBox = result.querySelector('.o-result__err');
    if (!r.ok) {
      ultimo = null;
      result.classList.add('is-invalid');
      if (semDados(e)) setSelo('warn', 'Envie a escala ou preencha os campos para ver o resultado'); else setSelo('crit', 'Dados insuficientes — confira os campos indicados');
      if (!errBox) { errBox = el('div', 'o-result__err'); result.querySelector('.o-result__head').after(errBox); }
      errBox.innerHTML = semDados(e) ? '<strong>Como começar:</strong><ul><li>Envie a escala da sua operação (.xlsx), no bloco 2; ou</li><li>preencha a equipe e os horários de cada função.</li></ul>' : '<strong>Para calcular, falta ajustar:</strong><ul>' + r.erros.map(function (x) {
        return '<li><button type="button" class="o-linkbtn" data-foco="' + (inputDoCampo(x.campo) || '') + '">' + esc(x.mensagem) + '</button></li>';
      }).join('') + '</ul>';
      ['r-quadro', 'r-acres-mensal', 'r-acres-anual', 'r-primeiro-ano', 'r-mensal', 'r-pct'].forEach(function (id) { $(id).textContent = '—'; $(id).classList.add('is-na'); });
      $('r-novas').textContent = '—'; $('r-novas').removeAttribute('data-v'); $('r-jornada').textContent = '';
      $('viz').innerHTML = ''; $('viz-legenda').innerHTML = ''; prevNovas = 0;
      $('r-leitura').innerHTML = ''; $('demanda-explica').innerHTML = '';
      $('r-compare').querySelector('tbody').innerHTML = ''; $('r-funcoes').querySelector('tbody').innerHTML = ''; $('r-bars').innerHTML = ''; $('r-memoria').innerHTML = ''; $('exemplo-abrir').disabled = true;
      $('r-mini').classList.remove('has-data');
      $('mini-novas').textContent = '—'; $('mini-custo').textContent = '—';
      anunciar(semDados(e) ? 'Envie a escala ou preencha os campos para ver o resultado.' : 'Faltam dados para calcular. ' + r.erros.map(function (x) { return x.mensagem; }).join(' '));
      return;
    }
    if (errBox) errBox.remove();
    result.classList.remove('is-invalid');
    ultimo = { e: e, r: r };

    setSelo('warn', 'Estimativa por demanda e turnos — não substitui a escala real');

    // custo médio por pessoa (bloco 3)
    $('r-unit').textContent = r.temCusto ? brl(r.unitarioMedio) : '—';
    $('r-unit-parts').textContent = r.temCusto ? 'média das funções, ponderada pela equipe de hoje (salário de cada função + encargos + benefícios)' : 'informe o salário das funções';
    $('encargos-reais').textContent = 'Aplicado ao salário de cada função.';

    // demanda (bloco 2)
    $('demanda-explica').innerHTML = '<span><strong>' + pessoas(r.pessoas) + ' hoje, em ' + num(r.funcoes.length) + (r.funcoes.length === 1 ? ' função' : ' funções') + '.</strong> A demanda soma ' + num(r.pessoasHoraSemana, r.pessoasHoraSemana % 1 ? 1 : 0) + (ultimo && ultimo.e.funcoes.some(function (f) { return f.escala; }) ? ' horas trabalhadas por semana, em ' : ' pessoas-hora por semana, em ') + num(r.diasAbertos) + (r.diasAbertos === 1 ? ' dia aberto' : ' dias abertos') + '.</span>' +
      '<span>No regime de hoje a demanda pede ' + pessoas(r.quadroDemandaHoje) + '.</span>';

    // destaque
    contar('r-novas', r.contratacoes, function (v) { return num(v); });
    $('r-jornada').textContent = REGIME_NOME[r.regimeAtual] + ' → ' + REGIME_NOME[r.regimeFuturo] + ' · ' + r.etapa + 'h';
    desenharViz(r.quadroFuturo, r.contratacoes);
    $('r-leitura').innerHTML = leitura(r);

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
    $('exemplo-abrir').disabled = false;
    $('exemplo-btn-txt').textContent = 'Ver exemplo de escala no ' + r.regimeFuturo;

    // mini barra
    $('mini-novas').textContent = '+' + num(r.contratacoes);
    $('mini-custo').textContent = semCusto ? '—' : '+' + brl0(r.acrescimoMensal);

    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      anunciar('Resultado atualizado: ' + num(r.contratacoes) + ' novas contratações no regime ' + r.regimeFuturo + ', quadro futuro de ' + pessoas(r.quadroFuturo) +
        (semCusto ? '. Informe o salário para ver o custo.' : ', acréscimo mensal de ' + brl(r.acrescimoMensal) + '.'));
    }, 900);
  }

  /** Texto curto que explica o porquê do resultado. */
  function leitura(r) {
    var a = r.alvo, h = r.cenarios[0], t = [];
    if (a.rigido) {
      t.push('<span><strong>No 12x36 a mesma turma se alterna</strong>, então cada função precisa do mesmo número de pessoas em turno em todos os dias abertos. O dia mais forte de cada função define o quadro dela: <strong>' + pessoas(a.referencia) + '</strong> no total.</span>');
    } else {
      t.push('<span>No ' + a.regime + ', cada pessoa trabalha ' + num(a.diasPessoa) + ' dias por semana em turnos de ' + horas(a.turno) + ' (' + horas(a.presenca) + ' na casa, com o intervalo). A demanda pede <strong>' + pessoas(a.referencia) + '</strong> no total.</span>');
    }
    var longos = a.funcoes.filter(function (f) { return f.demanda.limiteCobertura; });
    if (longos.length) t.push('<span>Turnos longos não encaixam em horários escalonados: em <strong>' + longos.map(function (f) { return esc(f.nome); }).join(', ') + '</strong> o quadro vem do mínimo de turnos que cobre todos os horários do dia, e não só das horas somadas.</span>');
    var semSal = ultimo ? ultimo.e.funcoes.filter(function (f) { return !(f.salario > 0); }) : [];
    if (r.temCusto && semSal.length) t.push('<span>Falta o salário de <strong>' + semSal.map(function (f) { return esc(f.nome || 'função sem nome'); }).join(', ') + '</strong>: o custo dessa equipe só considera os benefícios.</span>');
    var maior = a.funcoes.slice().sort(function (x, y) { return y.contratacoes - x.contratacoes; })[0];
    if (maior && maior.contratacoes > 0 && a.funcoes.length > 1) t.push('<span>A função que mais pesa é <strong>' + esc(maior.nome) + '</strong>: ' + num(maior.contratacoes) + (maior.contratacoes === 1 ? ' contratação' : ' contratações') + '.</span>');
    t.push('<span>Hoje (' + h.regime + ') a demanda pede ' + pessoas(r.quadroDemandaHoje) + ' e a sua equipe tem ' + num(r.pessoas) + '.' +
      (r.quadroDemandaHoje !== r.pessoas ? ' Se os números forem diferentes, confira os horários e as pessoas de cada função e o regime de hoje.' : '') + '</span>');
    return t.join('');
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
    $('cmp-titulo').textContent = 'Hoje × regimes na etapa de ' + r.etapa + 'h';
    var max = 0;
    r.cenarios.forEach(function (c) { if (c.mensal > max) max = c.mensal; });
    var bars = $('r-bars'); bars.innerHTML = '';
    r.cenarios.forEach(function (c) {
      var alvo = !c.atual && c.regime === r.regimeFuturo;
      var tr = el('tr', alvo ? 'is-target' : '');
      tr.innerHTML =
        '<td>' + c.regime + (c.atual ? ' <span class="o-tag">hoje</span>' : alvo ? ' <span class="o-tag">seu cenário</span>' : '') + '</td>' +
        '<td>' + num(c.quadro) + '</td>' +
        '<td>' + (c.atual ? '—' : num(c.contratacoes)) + '</td>' +
        '<td>' + (r.temCusto ? brl0(c.mensal) : '—') + '</td>' +
        '<td>' + (c.atual || !r.temCusto ? '—' : '+' + brl0(c.acrescimoMensal)) + '</td>';
      tbody.appendChild(tr);

      if (r.temCusto && max > 0) {
        var b = el('div', 'o-bar');
        var base = r.custoAtual / max, total = c.mensal / max;
        b.innerHTML = '<span class="o-bar__label">' + c.regime + '</span>' +
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

    // por função, no regime pretendido
    $('fun-titulo').textContent = 'Por função, no ' + r.regimeFuturo + ' (' + r.etapa + 'h)';
    var fb = $('r-funcoes').querySelector('tbody'); fb.innerHTML = '';
    var hoje = r.cenarios[0].funcoes;
    r.alvo.funcoes.forEach(function (f, i) {
      var tr = el('tr', f.contratacoes > 0 ? 'is-target' : '');
      tr.innerHTML = '<td>' + esc(f.nome) + '</td><td>' + num(f.hoje) + '</td><td>' + num(hoje[i].referencia) + '</td><td>' + num(f.referencia) + '</td><td>' + num(f.contratacoes) + '</td><td>' + (r.temCusto ? '+' + brl0(f.acrescimoMensal) : '—') + '</td>';
      fb.appendChild(tr);
    });
  }

  function periodo(m) { return m === 12 ? 'só dezembro' : 'de ' + MESES[m - 1] + ' a dezembro'; }

  function li(titulo, formula, nota) {
    return '<li><strong>' + titulo + '</strong><br><code>' + formula + '</code>' + (nota ? '<span class="o-memo-note">' + nota + '</span>' : '') + '</li>';
  }

  function listaTurnos(d) {
    return d.porDia.map(function (t, i) { return DIAS_ABREV[i].slice(0, 3) + ' ' + (t === 0 ? 'fechado' : num(t)); }).join(' · ');
  }

  /** Fórmula do quadro de uma função em um cenário, com os números do usuário. */
  function formulaQuadro(c, f) {
    var d = f.demanda;
    if (c.rigido) {
      return 'teto(' + num(d.pico) + ' turnos no dia mais forte × ' + num(d.abertos) + ' dias abertos × 12h ÷ ' + c.jornada + 'h por semana) = ' + num(f.referencia);
    }
    var dPessoa = Math.min(c.diasPessoa, d.abertos);
    var porSemana = Math.ceil(d.total / dPessoa - 1e-9);
    return 'máximo( teto(' + num(d.total) + ' turnos ÷ ' + num(dPessoa) + ' dias) = ' + num(porSemana) + ' ; ' + num(d.pico) + ' turnos do dia mais forte ) = ' + num(f.referencia);
  }

  function blocoFuncoes(c) {
    return c.funcoes.map(function (f) {
      return '<span class="o-memo-fn"><strong>' + esc(f.nome) + ':</strong> ' + listaTurnos(f.demanda) + ' → ' + formulaQuadro(c, f) + '</span>';
    }).join('<br>');
  }

  function renderMemoria(e, r) {
    var out = [];
    var h = r.cenarios[0], a = r.alvo;
    out.push(li('Demanda da semana',
      num(r.pessoasHoraSemana, r.pessoasHoraSemana % 1 ? 1 : 0) + ' pessoas-hora em ' + num(r.diasAbertos) + (r.diasAbertos === 1 ? ' dia aberto' : ' dias abertos') + ', somando as ' + num(r.funcoes.length) + ' funções',
      e.funcoes.some(function (f) { return f.escala; }) ? 'A demanda vem da escala que você enviou: em cada dia, as horas trabalhadas de todas as pessoas da equipe (sem a pausa de refeição).' : importado ? 'A demanda de cada função vem da escala importada: pessoas por horário, em cada dia da semana.' : 'Cada função soma as pessoas das suas faixas; o percentual de cada dia multiplica a demanda (arredondada para cima).'));
    out.push(li('Turnos no regime de hoje (' + h.regime + ', ' + horas(h.turno) + ' de trabalho + intervalo = ' + horas(h.presenca) + ' na casa)',
      blocoFuncoes(h), (e.funcoes.some(function (f) { return f.escala; }) ? 'Em cada dia: turnos = teto(horas do dia ÷ ' + horas(h.turno) + ' de trabalho por turno), nunca abaixo do pico de pessoas ao mesmo tempo. ' : 'Cada turno começa na primeira hora ainda descoberta, com a duração do regime; o que passa do fim da faixa continua contando como turno. ') + 'Total que a demanda pede hoje: ' + num(h.referencia) + ' pessoas; sua equipe: ' + num(r.pessoas) + '.'));
    out.push(li('Turnos no regime pretendido (' + a.regime + ' · ' + r.etapa + 'h, ' + horas(a.turno) + ' de trabalho + intervalo = ' + horas(a.presenca) + ' na casa)',
      blocoFuncoes(a),
      a.rigido ? 'No 12x36 a mesma turma se alterna, com o mesmo número de pessoas em turno em todos os dias abertos; por isso o dia mais forte de cada função define o quadro dela. Na etapa de 40h o simulador usa 40h por semana (' + num(40 / 12, 1) + ' turnos), e não a média de 42h.'
               : 'Cada pessoa trabalha ' + num(a.diasPessoa) + ' dias por semana. As folgas podem ser encaixadas nos dias de menor movimento.'));
    out.push(li('Novas contratações, função a função',
      a.funcoes.map(function (f, i) { return esc(f.nome) + ': máximo(0; ' + num(f.referencia) + ' − ' + num(r.base === 'variacao' ? h.funcoes[i].referencia : f.hoje) + ') = ' + num(f.contratacoes); }).join('<br>') + '<br><strong>Total: ' + num(r.contratacoes) + '</strong>',
      (r.base === 'variacao' ? 'Cada função contrata só o que o regime pede a mais do que a demanda já pede hoje; a equipe atual continua como está. ' : 'Cada função contrata o que o regime pede além das pessoas informadas hoje. ') + 'Quadro futuro total = ' + num(r.pessoas) + ' da equipe de hoje + ' + num(r.contratacoes) + ' contratações = ' + num(r.quadroFuturo) + '. Nenhum desligamento é presumido, e uma função com sobra não cobre a falta de outra.'));

    out.push(li('Custo mensal por pessoa, em cada função',
      r.funcoes.map(function (f) { return esc(f.nome) + ': ' + brl(f.unit.salario) + ' × (1 + ' + pct(C.toBasisPoints(e.encargosPct)) + ') + ' + brl(f.unit.beneficios) + ' = ' + brl(f.unit.total); }).join('<br>'),
      'O percentual de encargos e provisões é o que você informou; o simulador não aplica alíquota automática. O salário de cada função é o mesmo em todos os regimes.' + (r.funcoes[0].vt ? ' VT: a participação do empregado é o menor valor entre o VT e 6% do salário da função.' : '')));
    if (r.temCusto) {
      out.push(li('Custo mensal equivalente hoje', r.funcoes.map(function (f) { return num(f.hoje) + ' × ' + brl(f.unit.total); }).join(' + ') + ' = ' + brl(r.custoAtual)));
      out.push(li('Acréscimo mensal e anual',
        a.funcoes.map(function (f) { return num(f.contratacoes) + ' × ' + brl(f.unitario); }).join(' + ') + ' = ' + brl(r.acrescimoMensal) + ' por mês · × 12 = ' + brl(r.acrescimoAnual) + ' por ano',
        'Custo dos novos contratados. Considera que o custo da equipe atual não muda (sem horas extras, adicionais ou benefícios por dia alterados).'));
      out.push(li('Primeiro ano, proporcional à admissão',
        brl(r.acrescimoMensal) + ' × ' + r.mesesPrimeiroAno + (r.mesesPrimeiroAno === 1 ? ' mês' : ' meses') + ' (' + periodo(r.mesInicio) + ') = ' + brl(r.primeiroAno),
        'Antes de custos pontuais de admissão (exames, uniforme, treinamento). O desembolso de caixa pode ter outra distribuição.'));
      if (r.percentual !== null) {
        out.push(li('Impacto percentual', brl(r.acrescimoMensal) + ' ÷ ' + brl(r.custoAtual) + ' × 100 = ' + num(r.percentual, 1) + '%',
          'Os dois lados usam o custo de cada função, então a base é comparável.'));
      }
    }
    $('r-memoria').innerHTML = out.join('');
  }

  /* ---------- Exemplo de escala no regime pretendido ---------- */
  var ABREV3 = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  function hmm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }

  /** Horário do turno no jeito do Orbit: "08:00-12:00 / 13:00-17:00" (a pausa de refeição fica no meio do trabalho). */
  function horarioDoTurno(c, T, intervalo) {
    if (!(T > 6) || !(intervalo > 0)) return fmtHora(c.ini) + '-' + fmtHora(c.fim);
    var p1 = Math.round(T / 2 * 2) / 2;
    return fmtHora(c.ini) + '-' + fmtHora(c.ini + p1) + ' / ' + fmtHora(c.ini + p1 + intervalo) + '-' + fmtHora(c.fim);
  }

  function renderExemplo(e, r, duplo) {
    var corpo = $('exemplo-corpo');
    var ex = C.gerarEscalaExemplo(e, r), a = r.alvo, intervalo = e.intervalo || 0, T = a.turno;
    $('exemplo-titulo').innerHTML = 'Exemplo de escala no ' + esc(r.regimeFuturo) + '<span class="ox-sub">exemplo ilustrativo' + (T > 6 && intervalo > 0 ? ' · horários com a pausa de refeição incluída' : '') +
      ' · não aplica os domingos de folga obrigatórios, nem considera feriados, férias ou convenção coletiva</span>';
    var problemas = [], horasTot = 0, porDia = [0, 0, 0, 0, 0, 0, 0], itens = [], avisos = '';
    function grupo(nome, n, cont) { return '<tr class="ox-grupo"><th colspan="9" scope="colgroup">' + esc(nome) + ' · ' + (cont ? 'continuação' : num(n)) + '</th></tr>'; }
    ex.forEach(function (f) {
      if (f.grande) { avisos += '<p class="o-exemplo__nota"><strong>' + esc(f.nome) + ':</strong> o exemplo mostra funções de até 500 pessoas.</p>'; return; }
      if (!f.pessoas) return;
      if (f.semCobertura) problemas.push(esc(f.nome) + ': ' + num(f.semCobertura) + (f.semCobertura === 1 ? ' turno' : ' turnos') + ' sem pessoa');
      if (f.interjornada) problemas.push(esc(f.nome) + ': ' + num(f.interjornada) + ' intervalo(s) menor(es) que 11h entre turnos');
      f.emTurno.forEach(function (n, d) { porDia[d] += n * T; });
      itens.push({ g: true, nome: f.nome, html: grupo(f.nome, f.pessoas, false) });
      f.linhas.forEach(function (l) {
        horasTot += l.horas;
        itens.push({ g: false, nome: f.nome, html: '<tr><th scope="row" class="ox-nome">' + esc(l.nome) + '</th>' + l.dias.map(function (c) {
          if (!c) return '<td><div class="ox-folga"><span>Folga</span><span class="ox-turno__h">0:00</span></div></td>';
          var hor = duplo ? fmtHora(c.ini) + '-' + fmtHora(c.fim) : horarioDoTurno(c, T, intervalo);
          return '<td><div class="ox-turno"><span class="ox-turno__hor">' + hor + '</span><span class="ox-turno__h">' + hmm(T) + '</span></div></td>';
        }).join('') + '<td class="ox-sem">' + horas(l.horas) + '</td></tr>' });
      });
    });
    var cab = '<tr><th scope="col" class="ox-nome">Funcionário</th>' + ABREV3.map(function (d) { return '<th scope="col">' + d + '</th>'; }).join('') + '<th scope="col">Semana</th></tr>';
    var totDia = '<tr class="ox-total"><th scope="row" class="ox-nome">Total do dia</th>' + porDia.map(function (h) { return '<td>' + hmm(h) + '</td>'; }).join('') + '<td>' + horas(horasTot) + '</td></tr>';
    function tabela(lista, comTotal, abre) {
      return '<div class="ox-grade"><table class="ox-tabela"><caption class="o-sr">Escala de exemplo da semana, por equipe e por dia</caption><thead>' + cab + '</thead><tbody>' +
        (comTotal ? totDia : '') + (abre || '') + lista.map(function (x) { return x.html; }).join('') + '</tbody></table></div>';
    }
    var html;
    if (duplo && itens.length > 3) {
      // divide ao meio, em linhas; se cair no meio de uma equipe, a segunda coluna repete o título dela
      var k = Math.ceil(itens.length / 2);
      if (itens[k - 1].g) k--;
      var abre = itens[k].g ? '' : grupo(itens[k].nome, 0, true);
      html = '<div class="ox-duplo">' + tabela(itens.slice(0, k), true, '') + tabela(itens.slice(k), false, abre) + '</div>';
    } else html = tabela(itens, true, '');
    html += avisos;
    if (problemas.length) html += '<p class="o-exemplo__nota"><strong>Atenção:</strong> neste exemplo ficaram pendentes — ' + problemas.join('; ') + '.</p>';
    corpo.innerHTML = html;
  }

  /** Faz a escala caber na janela: reduz as células e, se ainda não couber, divide as equipes em duas colunas. Só rola se a equipe for grande demais. */
  function ajustarDensidade() {
    var corpo = $('exemplo-corpo');
    if (!ultimo) return;
    function cabe() { return corpo.scrollHeight <= corpo.clientHeight + 1; }
    function nivel(duplo) {
      var niveis = ['', 'ox--medio', 'ox--medio ox--mini'], k;
      for (k = 0; k < niveis.length; k++) {
        corpo.classList.remove('ox--medio', 'ox--mini');
        if (niveis[k]) niveis[k].split(' ').forEach(function (c) { corpo.classList.add(c); });
        if (cabe()) return true;
      }
      return false;
    }
    renderExemplo(ultimo.e, ultimo.r, false);
    if (nivel(false)) return;
    if (window.innerWidth >= 1100) {
      renderExemplo(ultimo.e, ultimo.r, true);
      nivel(true);
    }
  }

  (function () {
    var dlg = $('exemplo-modal'), abrir = $('exemplo-abrir'), corpo = $('exemplo-corpo'), origem = null;
    abrir.addEventListener('click', function () {
      if (!ultimo) return;
      renderExemplo(ultimo.e, ultimo.r);
      origem = abrir;
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      corpo.scrollTop = 0; corpo.scrollLeft = 0;
      ajustarDensidade();
      $('exemplo-fechar').focus();
    });
    window.addEventListener('resize', function () { if (dlg.open) ajustarDensidade(); });
    $('exemplo-fechar').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { if (origem) origem.focus(); });
    corpo.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-aba]');
      if (!b) return;
      qsa('[data-aba]', corpo).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      qsa('[data-painel]', corpo).forEach(function (p) { p.hidden = p.getAttribute('data-painel') !== b.getAttribute('data-aba'); });
    });
    dlg.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Tab') return;
      var f = qsa('button, [tabindex="0"]', dlg).filter(function (n) { return !n.disabled && n.offsetParent !== null && !n.closest('[hidden]'); });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  })();

  function explicarRegime(e) {
    var box = $('regime-explica');
    var t = {
      '5x2': '<span><strong>5x2:</strong> cinco dias de trabalho e dois de folga. Na etapa de 42h os turnos têm 8,4h; na de 40h, 8h.</span>',
      '4x3': '<span><strong>4x3:</strong> quatro dias de turnos de 10h e três de folga (40h por semana). Turnos de 10h só existem por convenção ou acordo coletivo, e apenas na etapa de 40h.</span>',
      '12x36': '<span><strong>12x36:</strong> 12 horas de trabalho e 36 de descanso. Na média são 3,5 turnos por semana (42h); na etapa de 40h o simulador usa 40h (3,3 turnos). A mesma turma se alterna, então o número de pessoas em turno é o mesmo em todos os dias abertos.</span>'
    };
    box.innerHTML = t[e.regimeFuturo] || '';
  }

  function explicarVT(e) {
    var box = $('vt-explica');
    if (e.beneficiosModo !== 'detalhe' || !(e.vt > 0)) { box.innerHTML = ''; return; }
    box.innerHTML = '<span><strong>Vale-transporte:</strong> em cada função, o empregado participa com o menor valor entre o VT e 6% do salário básico; a empresa paga o restante.</span>';
  }

  /* ---------- Estado da simulação ---------- */
  function setModo(exemplo) { modoExemplo = exemplo; }

  function aplicarPerfil(p) {
    $('f-jatual').value = p.jornada;
    $('f-intervalo').value = '1';
    marcar('ratual', p.ratual); marcar('etapa', p.etapa); marcar('rfut', p.rfut);
    p.dias.forEach(function (v, i) { $('f-dia-' + i).value = v; });
    importado = false;
    esconderStatusImport();
    FUN = funcoesDoPerfil(p.funcoes);
    touched = {};
    desenharFuncoes();
    syncVisibilidade();
  }

  function iniciarVazio() {
    aplicarPerfil(VAZIO);
    ['f-encargos', 'f-ben'].forEach(function (id) { $(id).value = ''; });
    marcar('benmodo', 'total');
    syncVisibilidade();
    setModo(false);
    render();
  }

  function syncVisibilidade() {
    $('jatual-wrap').hidden = radio('ratual') === '12x36';
    // 4x3 de 10h só existe na etapa de 40h
    var e42 = radio('etapa') === '42';
    var in43 = form.querySelector('input[name="rfut"][value="4x3"]');
    in43.disabled = e42;
    $('opt-4x3').classList.toggle('is-disabled', e42);
    if (e42 && in43.checked) { marcar('rfut', '5x2'); toast('O 4x3 de 10h só existe na etapa de 40h. Voltamos para o 5x2.'); }
    var det = radio('benmodo') === 'detalhe';
    $('ben-detalhe-wrap').hidden = !det;
    $('ben-total-wrap').hidden = det;
  }

  /* ---------- Importação da escala existente ---------- */
  function esconderStatusImport() { var s = $('imp-status'); s.hidden = true; s.textContent = ''; s.classList.remove('is-erro'); }
  function statusImport(texto, erro) {
    var s = $('imp-status'); s.textContent = texto; s.hidden = false; s.classList.toggle('is-erro', !!erro);
  }

  var NOME_DIA_CURTO = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

  function lerArquivo(file) {
    if (file.size > 3 * 1024 * 1024) { statusImport('O arquivo passa de 3 MB. Envie só as linhas dos turnos.', true); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var buf = rd.result, b = new Uint8Array(buf), txt;
      if (b[0] === 0x50 && b[1] === 0x4b) {
        var X = window.OrbitXlsx;
        if (!X) { statusImport('Não foi possível ler planilhas neste navegador. Salve a escala como CSV e tente de novo.', true); return; }
        X.lerXlsx(buf).then(function (planilhas) {
          aplicarImportacao(C.importarGrade(planilhas), true);
        }).catch(function (err) {
          var m = String(err && err.message);
          statusImport(m === 'navegador' ? 'Este navegador não consegue abrir planilhas .xlsx. Atualize o navegador ou salve a escala como CSV.' :
            m === 'cifrado' ? 'A planilha tem senha. Salve uma cópia sem senha e tente de novo.' :
            'Não foi possível abrir a planilha. Confira se é um arquivo .xlsx válido.', true);
        });
        return;
      }
      if (b[0] === 0xD0 && b[1] === 0xCF) { statusImport('Este é um arquivo .xls antigo. Abra no Excel, use Salvar como → Pasta de Trabalho do Excel (.xlsx) e envie de novo.', true); return; }
      try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (err) { txt = new TextDecoder('windows-1252').decode(buf); }
      aplicarImportacao(C.importarEscala(txt), false);
    };
    rd.onerror = function () { statusImport('Não foi possível ler o arquivo.', true); };
    rd.readAsArrayBuffer(file);
  }

  function aplicarImportacao(res, grade) {
    {
      if (!res.ok) { statusImport(res.erro, true); return; }
      if (res.funcoes.length > MAX_FUNCOES) { statusImport('A escala tem mais de ' + MAX_FUNCOES + ' funções. Agrupe as funções parecidas e tente de novo.', true); return; }
      importado = true;
      FUN = res.funcoes.map(function (f) {
        return {
          nome: f.nome, hoje: String(f.hoje),
          salario: f.salario ? f.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
          semana: f.semana || null, escala: f.escala || null, nomes: f.nomes || null, faixas: []
        };
      });
      touched = {};
      setModo(false);
      desenharFuncoes();
      var rs = res.resumo;
      var semSal = res.funcoes.filter(function (f) { return !f.salario; }).length;
      if (grade) {
        statusImport('Escala lida: ' + num(rs.funcoes) + (rs.funcoes === 1 ? ' equipe' : ' equipes') + ', ' + pessoas(rs.pessoas) + ', ' + num(rs.turnos) + ' turnos e ' + horas(Math.round(rs.horas * 10) / 10) + ' trabalhadas por semana' +
          (rs.semanas > 1 ? ' (média de ' + num(rs.semanas) + ' semanas)' : '') + '. As horas não incluem a pausa de refeição.' +
          (rs.anomalias ? ' ' + num(rs.anomalias) + (rs.anomalias === 1 ? ' horário estranho foi lido como estava (ex.: início igual ao fim ou horário sem par).' : ' horários estranhos foram lidos como estavam (ex.: início igual ao fim ou horário sem par).') : '') +
          (rs.diasSemColuna.length ? ' Sem coluna na planilha, e tratados como fechados: ' + rs.diasSemColuna.map(function (i) { return NOME_DIA_CURTO[i]; }).join(', ') + '.' : '') +
          ' Informe o salário de cada equipe nos cartões abaixo para ver o custo.', false);
        render();
        return;
      }
      statusImport('Escala importada: ' + num(rs.turnos) + ' turnos, ' + num(rs.colaboradores) + (rs.colaboradores === 1 ? ' pessoa' : ' pessoas') + ' em ' + num(rs.funcoes) + (rs.funcoes === 1 ? ' função' : ' funções') +
        '. Em média, cada pessoa tem ' + num(rs.turnosPorPessoa, 1) + ' turnos na escala, de ' + num(rs.horasPorTurno, 1) + 'h. Confira se o regime de hoje combina com isso.' +
        (rs.ignoradas.length ? ' Linhas ignoradas por dado inválido: ' + rs.ignoradas.slice(0, 8).join(', ') + (rs.ignoradas.length > 8 ? '…' : '') + '.' : '') +
        (semSal ? ' Informe o salário de ' + (semSal === 1 ? 'uma função' : num(semSal) + ' funções') + ' para ver o custo.' : ''), false);
      render();
    }
  }

  form.addEventListener('input', function (ev) {
    if (ev.isTrusted && modoExemplo) setModo(false);
    if (ev.target.name === 'ratual' || ev.target.name === 'etapa' || ev.target.name === 'rfut' || ev.target.name === 'benmodo') syncVisibilidade();
    render();
  });
  form.addEventListener('change', function (ev) {
    if (ev.target.id === 'imp-file') return;
    if (ev.target.type === 'radio' || ev.target.tagName === 'SELECT' || ev.target.type === 'time') {
      if (ev.isTrusted && modoExemplo) setModo(false);
      syncVisibilidade();
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

  $('funcao-add').addEventListener('click', function () {
    lerFuncoesCampos();
    if (FUN.length >= MAX_FUNCOES) return;
    if (modoExemplo) setModo(false);
    FUN.push({ nome: '', hoje: '', salario: '', semana: null, faixas: [['', '', '']] });
    desenharFuncoes('f-func-' + FUN.length + '-nome');
    render();
  });
  $('funcoes').addEventListener('click', function (ev) {
    var rf = ev.target.closest('[data-rmfunc]');
    if (rf && !rf.disabled) {
      lerFuncoesCampos();
      if (FUN.length <= 1) return;
      if (modoExemplo) setModo(false);
      var i = Number(rf.getAttribute('data-rmfunc'));
      FUN.splice(i, 1);
      desenharFuncoes('f-func-' + Math.max(1, i) + '-nome');
      render();
      return;
    }
    var af = ev.target.closest('[data-addfaixa]');
    if (af && !af.disabled) {
      lerFuncoesCampos();
      var j = Number(af.getAttribute('data-addfaixa'));
      if (FUN[j].faixas.length >= MAX_FAIXAS) return;
      if (modoExemplo) setModo(false);
      FUN[j].faixas.push(['', '', '']);
      desenharFuncoes('f-func-' + (j + 1) + '-faixa-' + FUN[j].faixas.length + '-ini');
      render();
      return;
    }
    var rx = ev.target.closest('[data-rmfaixa]');
    if (rx && !rx.disabled) {
      lerFuncoesCampos();
      var par = rx.getAttribute('data-rmfaixa').split(',').map(Number);
      if (FUN[par[0]].faixas.length <= 1) return;
      if (modoExemplo) setModo(false);
      FUN[par[0]].faixas.splice(par[1], 1);
      desenharFuncoes('f-func-' + (par[0] + 1) + '-faixa-' + Math.max(1, par[1]) + '-ini');
      render();
    }
  });

  $('imp-btn').addEventListener('click', function () { $('imp-file').click(); });
  $('imp-file').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (f) lerArquivo(f);
    this.value = '';
  });
  $('imp-modelo').addEventListener('click', function (ev) {
    var blob = new Blob(['﻿' + C.MODELO_CSV], { type: 'text/csv;charset=utf-8' });
    this.href = URL.createObjectURL(blob);
    setTimeout(function () { URL.revokeObjectURL(ev.target.href); }, 2000);
  });
  $('imp-voltar').addEventListener('click', function () {
    FUN = [{ nome: '', hoje: '', salario: '', semana: null, escala: null, faixas: [['', '', '']] }];
    importado = false;
    esconderStatusImport();
    touched = {};
    desenharFuncoes('f-func-1-nome');
    render();
  });


  $('resultado').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-foco]');
    if (b && b.getAttribute('data-foco')) {
      var input = $(b.getAttribute('data-foco'));
      if (!input) return;
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
    linhas.push('• Equipe hoje: ' + pessoas(r.pessoas) + ' em ' + num(r.funcoes.length) + (r.funcoes.length === 1 ? ' função' : ' funções') + ', regime ' + r.regimeAtual + (r.regimeAtual === '12x36' ? '' : ' (' + horas(r.jornadaAtual) + ' por semana)') + (importado ? ' · demanda a partir da escala importada' : ''));
    linhas.push('• Regime pretendido: ' + r.regimeFuturo + ' · etapa de ' + r.etapa + 'h · demanda de ' + num(r.pessoasHoraSemana, r.pessoasHoraSemana % 1 ? 1 : 0) + ' pessoas-hora/semana em ' + num(r.diasAbertos) + ' dias abertos');
    linhas.push('• Por função: ' + r.alvo.funcoes.map(function (f) { return f.nome + ' (hoje ' + num(f.hoje) + ', +' + num(f.contratacoes) + ')'; }).join('; '));
    linhas.push('• Quadro futuro total: ' + num(r.quadroFuturo) + ' · Novas contratações: ' + num(r.contratacoes));
    if (r.temCusto) {
      linhas.push('• Custo mensal médio por pessoa: ' + brl(r.unitarioMedio) + ' (encargos e provisões informados: ' + pct(C.toBasisPoints(e.encargosPct)) + ')');
      linhas.push('• Acréscimo mensal: ' + brl(r.acrescimoMensal) + ' · anual completo: ' + brl(r.acrescimoAnual));
      linhas.push('• Primeiro ano (' + periodo(r.mesInicio) + '): ' + brl(r.primeiroAno));
      if (r.percentual !== null) linhas.push('• Impacto no custo de pessoal: +' + num(r.percentual, 1) + '%');
    }
    linhas.push('Estimativa por demanda e turnos, sem montar a escala. Parâmetros a validar com contador/DP e jurídico.');
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

  iniciarVazio();

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
    var alvos = qsa('.o-pillar, .o-how__step, .o-faq__item, .o-about .o-sec-head, .o-benef .o-sec-head, .o-faq .o-sec-head, .o-who');
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

  /* Agendar conversa: abre só o pop-up do Cal.com, na própria página.
     O href fica como reserva se o script do Cal.com não estiver disponível. */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[data-cal-link]');
    if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (window.Cal && window.Cal.loaded) ev.preventDefault();
  }, true);
})();
