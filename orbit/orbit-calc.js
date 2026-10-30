/* ============================================================
   ORBIT — Motor de cálculo do simulador (lógica pura, sem DOM)
   ------------------------------------------------------------
   Fonte das fórmulas: "Orbit — Projeto Simulador Quadro & Custos"
   (concepção v1.1, 19/10/2026), págs. 6, 9, 14, 16, 17, 18 e 19.

   Princípios:
   - Dinheiro sempre em CENTAVOS INTEIROS (sem erro de ponto flutuante).
   - Horas em CENTÉSIMOS inteiros (42,5h = 4250) para o teto ser exato.
   - Percentuais em PONTOS-BASE inteiros (45% = 4500).
   - Nenhuma alíquota legal é aplicada automaticamente: o percentual
     de encargos/provisões é sempre informado pelo usuário.
   - Não acumula o ajuste de jornada (44/40) com fator de dias (6/5).

   Funciona no navegador (window.OrbitCalc) e no Node (module.exports).
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbitCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Conversões para inteiros ---------- */

  /** Reais (número) -> centavos inteiros. */
  function toCents(reais) { return Math.round(Number(reais) * 100); }

  /** Horas (número, até 2 casas) -> centésimos de hora inteiros. */
  function toHundredths(h) { return Math.round(Number(h) * 100); }

  /** Percentual (ex.: 45 ou 45,5) -> pontos-base inteiros (4500 / 4550). */
  function toBasisPoints(pct) { return Math.round(Number(pct) * 100); }

  /** Teto de a/b para inteiros não negativos, b > 0. */
  function ceilDiv(a, b) {
    if (b <= 0) throw new RangeError('divisor deve ser positivo');
    return Math.floor((a + b - 1) / b);
  }

  /** Arredonda a/b para o inteiro mais próximo (meio para cima), a,b >= 0. */
  function roundDiv(a, b) { return Math.floor((2 * a + b) / (2 * b)); }

  /** valor (centavos) × percentual (pontos-base), arredondado ao centavo. */
  function applyBp(cents, bp) { return roundDiv(cents * bp, 10000); }

  /* ---------- Dimensionamento ---------- */

  /**
   * Cálculo A — preservar o volume atual de horas (PDF p.6 e p.18).
   * Quadro = teto(N × Hatual ÷ Hfutura).
   * @param {number} n pessoas atuais (inteiro >= 0)
   * @param {number} hAtual jornada atual em horas
   * @param {number} hFutura jornada futura em horas
   */
  function quadroPorHoras(n, hAtual, hFutura) {
    var ha = toHundredths(hAtual), hf = toHundredths(hFutura);
    if (!(n >= 0) || ha <= 0 || hf <= 0) return 0;
    return ceilDiv(n * ha, hf);
  }

  /**
   * Pessoas-hora semanais exigidas (PDF p.17).
   * dias × horas por dia × pessoas simultâneas.
   * Retorna em CENTÉSIMOS de pessoa-hora.
   */
  function pessoasHoraSemana(dias, horasDia, simultaneas) {
    return Math.round(Number(dias)) * toHundredths(horasDia) * Math.round(Number(simultaneas));
  }

  /**
   * Cálculo B — partir da demanda (PDF p.6 e p.17).
   * Quadro = teto[horas exigidas ÷ (jornada × disponibilidade)].
   * @param {number} phCentesimos pessoas-hora (centésimos) — use pessoasHoraSemana
   * @param {number} hJornada jornada semanal em horas
   * @param {number} dispPct disponibilidade efetiva em % (0 < d <= 100)
   */
  function quadroPorDemanda(phCentesimos, hJornada, dispPct) {
    var hj = toHundredths(hJornada), bp = toBasisPoints(dispPct);
    if (phCentesimos <= 0 || hj <= 0 || bp <= 0 || bp > 10000) return 0;
    // ph/100 ÷ (hj/100 × bp/10000) = ph × 10000 ÷ (hj × bp)
    return ceilDiv(phCentesimos * 10000, hj * bp);
  }

  /** Contratações = máximo(0; quadro futuro − quadro disponível). PDF p.6/p.18 */
  function contratacoes(quadroFuturo, disponivel) {
    return Math.max(0, quadroFuturo - Math.max(0, disponivel));
  }

  /* ---------- Benefícios ---------- */

  /**
   * Vale-transporte (PDF p.19; Decreto 10.854/2021 arts. 114–117).
   * Participação do empregado = menor entre o VT concedido e 6% do salário básico.
   * Custo patronal = VT concedido − participação.
   * Entradas e saídas em centavos.
   */
  function valeTransporte(salarioCents, vtCents) {
    var seisPorCento = roundDiv(Math.max(0, salarioCents) * 6, 100);
    var participacao = Math.min(Math.max(0, vtCents), seisPorCento);
    return { participacao: participacao, patronal: Math.max(0, vtCents) - participacao };
  }

  /** Custo unitário = salário × (1 + e) + benefícios líquidos. PDF p.18 (centavos). */
  function custoUnitario(salarioCents, encargosBp, beneficiosCents) {
    var encargos = applyBp(salarioCents, encargosBp);
    return {
      salario: salarioCents,
      encargos: encargos,
      beneficios: beneficiosCents,
      total: salarioCents + encargos + beneficiosCents
    };
  }

  /* ---------- Fatores didáticos (PDF p.17) ---------- */

  /** Aumento de quadro para repor dias: (diasAntes/diasDepois) − 1. Ex.: 6/5 − 1 = 20%. */
  function aumentoPorDias(diasAntes, diasDepois) { return diasAntes / diasDepois - 1; }
  /** Perda de capacidade em dias: 1 − diasDepois/diasAntes. Ex.: 1/6 = 16,7%. */
  function perdaPorDias(diasAntes, diasDepois) { return 1 - diasDepois / diasAntes; }

  /** Meses no primeiro ano a partir do mês de admissão (1–12), mês incluído. Jul = 6. */
  function mesesPrimeiroAno(mesInicio) {
    var m = Math.round(Number(mesInicio));
    if (!(m >= 1 && m <= 12)) return 0;
    return 13 - m;
  }

  /* ---------- Validação ---------- */

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /**
   * Valida as entradas. Retorna lista de { campo, mensagem } em português simples.
   */
  function validar(e) {
    var erros = [];
    function add(campo, msg) { erros.push({ campo: campo, mensagem: msg }); }

    if (!isNum(e.pessoas) || e.pessoas < 1) add('pessoas', 'Informe quantas pessoas trabalham hoje (pelo menos 1).');
    else if (Math.round(e.pessoas) !== e.pessoas) add('pessoas', 'Use um número inteiro de pessoas.');
    else if (e.pessoas > 100000) add('pessoas', 'Para mais de 100 mil pessoas, fale com a gente: o cálculo precisa ser por unidade.');

    if (!isNum(e.jornadaAtual) || e.jornadaAtual <= 0 || e.jornadaAtual > 80) add('jornadaAtual', 'A jornada atual precisa ficar entre 1 e 80 horas por semana.');
    if (!isNum(e.jornadaFutura) || e.jornadaFutura <= 0 || e.jornadaFutura > 80) add('jornadaFutura', 'A jornada futura precisa ficar entre 1 e 80 horas por semana.');

    if (e.disponivel != null) {
      if (!isNum(e.disponivel) || e.disponivel < 0) add('disponivel', 'O quadro disponível não pode ser negativo.');
      else if (Math.round(e.disponivel) !== e.disponivel) add('disponivel', 'Use um número inteiro de pessoas.');
    }

    if (e.base === 'demanda') {
      if (!isNum(e.dias) || e.dias < 1 || e.dias > 7 || Math.round(e.dias) !== e.dias) add('dias', 'Dias de funcionamento: um número inteiro de 1 a 7.');
      if (!isNum(e.horasDia) || e.horasDia <= 0 || e.horasDia > 24) add('horasDia', 'Horas de funcionamento por dia: entre 1 e 24.');
      if (!isNum(e.simultaneas) || e.simultaneas < 1 || Math.round(e.simultaneas) !== e.simultaneas) add('simultaneas', 'Pessoas ao mesmo tempo: um número inteiro, pelo menos 1.');
      if (!isNum(e.disponibilidade) || e.disponibilidade <= 0 || e.disponibilidade > 100) add('disponibilidade', 'A disponibilidade precisa ser maior que 0% e no máximo 100%.');
    }

    if (e.salario != null && (!isNum(e.salario) || e.salario < 0)) add('salario', 'O salário não pode ser negativo.');
    if (e.encargosPct != null && (!isNum(e.encargosPct) || e.encargosPct < 0 || e.encargosPct > 300)) add('encargosPct', 'Encargos e provisões: um percentual entre 0% e 300%.');
    ['beneficios', 'vr', 'vt', 'saude'].forEach(function (k) {
      if (e[k] != null && (!isNum(e[k]) || e[k] < 0)) add(k, 'Este valor não pode ser negativo.');
    });
    if (e.mesInicio != null && !(e.mesInicio >= 1 && e.mesInicio <= 12)) add('mesInicio', 'Escolha um mês de janeiro a dezembro.');

    return erros;
  }

  /* ---------- Simulação completa (modo rápido) ---------- */

  /**
   * @param {object} e entradas
   *  pessoas, jornadaAtual, jornadaFutura, disponivel (opcional, padrão = pessoas),
   *  base: 'horas' | 'demanda', dias, horasDia, simultaneas, disponibilidade (%),
   *  salario (R$), encargosPct (%), beneficiosModo: 'total' | 'detalhe',
   *  beneficios (R$, líquido por pessoa), vr, vt, saude (R$), mesInicio (1–12)
   */
  function simular(e) {
    var erros = validar(e);
    if (erros.length) return { ok: false, erros: erros };

    var n = e.pessoas;
    var disponivel = e.disponivel == null ? n : e.disponivel;
    var base = e.base === 'demanda' ? 'demanda' : 'horas';

    // ---- Benefícios líquidos por pessoa
    var salarioC = toCents(e.salario || 0);
    var vt = null, beneficiosC;
    if (e.beneficiosModo === 'detalhe') {
      vt = valeTransporte(salarioC, toCents(e.vt || 0));
      beneficiosC = toCents(e.vr || 0) + vt.patronal + toCents(e.saude || 0);
    } else {
      beneficiosC = toCents(e.beneficios || 0);
    }
    var unit = custoUnitario(salarioC, toBasisPoints(e.encargosPct || 0), beneficiosC);

    // ---- Demanda
    var ph = base === 'demanda' ? pessoasHoraSemana(e.dias, e.horasDia, e.simultaneas) : 0;
    var postoUnico = base === 'demanda' ? pessoasHoraSemana(e.dias, e.horasDia, 1) : 0;

    function quadroPara(h) {
      return base === 'demanda'
        ? quadroPorDemanda(ph, h, e.disponibilidade)
        : quadroPorHoras(n, e.jornadaAtual, h);
    }

    // ---- Cenários: atual + 42h + 40h + futura (se diferente), só os menores que a atual
    var futuras = [42, 40];
    if (futuras.indexOf(e.jornadaFutura) === -1) futuras.push(e.jornadaFutura);
    futuras = futuras.filter(function (h) { return h < e.jornadaAtual; })
      .sort(function (a, b) { return b - a; });
    if (e.jornadaFutura >= e.jornadaAtual && futuras.indexOf(e.jornadaFutura) === -1) futuras.push(e.jornadaFutura);

    var custoAtual = n * unit.total;
    function cenario(h, ehAtual) {
      // Referência matemática (por horas ou por demanda). Nunca sugere desligar
      // ninguém: o quadro total futuro é o disponível + contratações.
      var referencia = ehAtual ? n : quadroPara(h);
      var novas = ehAtual ? 0 : contratacoes(referencia, disponivel);
      var mensal = custoAtual + novas * unit.total;
      return {
        jornada: h,
        atual: !!ehAtual,
        referencia: referencia,
        quadro: ehAtual ? n : Math.max(0, disponivel) + novas,
        contratacoes: novas,
        salarios: (n + novas) * unit.salario,
        encargos: (n + novas) * unit.encargos,
        beneficios: (n + novas) * unit.beneficios,
        mensal: mensal,
        acrescimoMensal: mensal - custoAtual,
        acrescimoAnual: (mensal - custoAtual) * 12
      };
    }
    var cenarios = [cenario(e.jornadaAtual, true)].concat(futuras.map(function (h) { return cenario(h, false); }));
    var alvo = cenarios.filter(function (c) { return !c.atual && c.jornada === e.jornadaFutura; })[0];

    var meses = mesesPrimeiroAno(e.mesInicio == null ? 1 : e.mesInicio);
    var primeiroAno = alvo.acrescimoMensal * meses;
    // Percentual só com base comparável (mesmo custo unitário nos dois lados) e base > 0.
    var percentual = custoAtual > 0 ? (alvo.acrescimoMensal / custoAtual) * 100 : null;

    return {
      ok: true,
      base: base,
      pessoas: n,
      disponivel: disponivel,
      jornadaAtual: e.jornadaAtual,
      jornadaFutura: e.jornadaFutura,
      futuraNaoMenor: e.jornadaFutura >= e.jornadaAtual,
      pessoasHora: ph / 100,
      postoUnicoQuadro: base === 'demanda' ? ceilDiv(postoUnico, toHundredths(e.jornadaFutura)) : null,
      quadroDemandaJornadaAtual: base === 'demanda' ? quadroPorDemanda(ph, e.jornadaAtual, e.disponibilidade) : null,
      unitario: unit,
      vt: vt,
      custoAtual: custoAtual,
      cenarios: cenarios,
      alvo: alvo,
      quadroFuturo: alvo.quadro,
      contratacoes: alvo.contratacoes,
      custoFuturo: alvo.mensal,
      acrescimoMensal: alvo.acrescimoMensal,
      acrescimoAnual: alvo.acrescimoAnual,
      mesInicio: e.mesInicio == null ? 1 : e.mesInicio,
      mesesPrimeiroAno: meses,
      primeiroAno: primeiroAno,
      percentual: percentual,
      temCusto: unit.total > 0
    };
  }

  /* ---------- Regimes de escala (6x1, 5x2, 4x3, 12x36) ----------
     O quadro sai da cobertura da demanda por faixa de horário e por dia da
     semana, com turnos de duração fixa por regime:
     - regimes flexíveis (6x1, 5x2, 4x3): as folgas podem ser encaixadas nos
       dias fracos; quadro = máximo entre (turnos da semana ÷ dias de trabalho
       por pessoa) e (turnos do dia mais forte);
     - 12x36: a mesma turma se alterna, então o número de pessoas em turno é o
       mesmo em todos os dias abertos; o dia mais forte define o quadro.
     Premissas: turnos sem intervalo, salário e benefícios iguais entre regimes. */

  var SLOT = 6;                 // fatias de 10 minutos por hora
  var REGIMES_ATUAIS = ['6x1', '5x2', '4x3', '12x36'];

  function infoAtual(regime, jornadaAtual) {
    if (regime === '12x36') return { id: regime, turno: 12, jornada: 42, dias: 3.5, rigido: true };
    var dias = regime === '5x2' ? 5 : regime === '4x3' ? 4 : 6;
    return { id: regime, turno: jornadaAtual / dias, jornada: jornadaAtual, dias: dias, rigido: false };
  }

  function infoFuturo(regime, etapa) {
    if (regime === '12x36') return { id: regime, turno: 12, jornada: etapa, dias: etapa / 12, rigido: true };
    var dias = regime === '4x3' ? 4 : 5;
    return { id: regime, turno: etapa / dias, jornada: etapa, dias: dias, rigido: false };
  }

  /** Regimes oferecidos em cada etapa da EC nº 141: o 4x3 de 10h só na etapa de 40h. */
  function regimesDaEtapa(etapa) { return etapa === 40 ? ['5x2', '4x3', '12x36'] : ['5x2', '12x36']; }

  /** Faixas (horas decimais) -> demanda por fatia de 10 min, a partir do início mais cedo. */
  function perfilBase(faixas) {
    var t0 = Infinity, tf = -Infinity, itens = faixas.map(function (f) {
      var i = Math.round(f.ini * SLOT), x = Math.round(f.fim * SLOT);
      if (x <= i) x += 24 * SLOT;
      if (i < t0) t0 = i;
      if (x > tf) tf = x;
      return { i: i, x: x, p: f.pessoas };
    });
    var base = [];
    for (var k = 0; k < tf - t0; k++) base.push(0);
    itens.forEach(function (it) { for (var s = it.i; s < it.x; s++) base[s - t0] += it.p; });
    return base;
  }

  /** Turnos de duração fixa (em fatias) para cobrir a demanda: começa um turno na primeira fatia descoberta. */
  function turnosParaCobrir(demanda, duracao) {
    var n = demanda.length, fim = [], cob = 0, total = 0, s;
    for (s = 0; s < n + duracao + 1; s++) fim.push(0);
    for (s = 0; s < n; s++) {
      cob -= fim[s];
      if (cob < demanda[s]) {
        var c = demanda[s] - cob;
        cob += c; fim[s + duracao] += c; total += c;
      }
    }
    return total;
  }

  /** dias: 7 percentuais (seg a dom) sobre a demanda base; 0 = fechado. */
  function demandaSemanal(base, dias, turnoHoras) {
    var duracao = Math.max(1, Math.round(turnoHoras * SLOT));
    var porDia = [], total = 0, pico = 0, abertos = 0, fatias = 0;
    dias.forEach(function (m) {
      if (!(m > 0)) { porDia.push(0); return; }
      var dem = base.map(function (b) { return Math.ceil(b * m / 100 - 1e-9); });
      var t = turnosParaCobrir(dem, duracao);
      dem.forEach(function (d) { fatias += d; });
      porDia.push(t); total += t; abertos++;
      if (t > pico) pico = t;
    });
    return { porDia: porDia, total: total, pico: pico, abertos: abertos, pessoasHora: fatias / SLOT };
  }

  /** Quadro necessário (pessoas) para o regime, com disponibilidade em pontos-base. */
  function quadroDoRegime(info, d, dispBp) {
    if (d.total <= 0) return 0;
    if (info.rigido) return ceilDiv(d.pico * d.abertos * 12 * 10000, info.jornada * dispBp);
    var diasPessoa = Math.min(info.dias, d.abertos);
    return Math.max(ceilDiv(d.total * 10000, diasPessoa * dispBp), ceilDiv(d.pico * 10000, dispBp));
  }

  function validarRegimes(e) {
    var erros = [];
    function add(campo, msg) { erros.push({ campo: campo, mensagem: msg }); }

    if (!isNum(e.pessoas) || e.pessoas < 1) add('pessoas', 'Informe quantas pessoas trabalham hoje (pelo menos 1).');
    else if (Math.round(e.pessoas) !== e.pessoas) add('pessoas', 'Use um número inteiro de pessoas.');
    else if (e.pessoas > 100000) add('pessoas', 'Para mais de 100 mil pessoas, fale com a gente: o cálculo precisa ser por unidade.');

    if (REGIMES_ATUAIS.indexOf(e.regimeAtual) === -1) add('regimeAtual', 'Escolha o regime de hoje.');
    else if (e.regimeAtual !== '12x36' && (!isNum(e.jornadaAtual) || e.jornadaAtual <= 0 || e.jornadaAtual > 80)) add('jornadaAtual', 'A jornada atual precisa ficar entre 1 e 80 horas por semana.');

    if (e.etapa !== 42 && e.etapa !== 40) add('etapa', 'Escolha a etapa da jornada (42h ou 40h).');
    else if (regimesDaEtapa(e.etapa).indexOf(e.regimeFuturo) === -1) {
      add('regimeFuturo', e.regimeFuturo === '4x3' ? 'O 4x3 com turnos de 10h só existe na etapa de 40h, por convenção ou acordo coletivo.' : 'Escolha o regime pretendido.');
    }

    if (e.disponivel != null) {
      if (!isNum(e.disponivel) || e.disponivel < 0) add('disponivel', 'O quadro disponível não pode ser negativo.');
      else if (Math.round(e.disponivel) !== e.disponivel) add('disponivel', 'Use um número inteiro de pessoas.');
    }

    if (!isNum(e.disponibilidade) || e.disponibilidade <= 0 || e.disponibilidade > 100) add('disponibilidade', 'A disponibilidade precisa ser maior que 0% e no máximo 100%.');

    if (!Array.isArray(e.faixas) || e.faixas.length < 1) add('faixas', 'Informe pelo menos uma faixa de horário.');
    else if (e.faixas.length > 8) add('faixas', 'Use no máximo 8 faixas de horário.');
    else e.faixas.forEach(function (f, i) {
      var n = i + 1;
      if (!isNum(f.ini) || f.ini < 0 || f.ini >= 24) add('faixa-' + n + '-ini', 'Faixa ' + n + ': informe o horário de início.');
      if (!isNum(f.fim) || f.fim < 0 || f.fim > 24) add('faixa-' + n + '-fim', 'Faixa ' + n + ': informe o horário de fim.');
      else if (isNum(f.ini) && f.fim === f.ini) add('faixa-' + n + '-fim', 'Faixa ' + n + ': o fim não pode ser igual ao início.');
      if (!isNum(f.pessoas) || f.pessoas < 1 || Math.round(f.pessoas) !== f.pessoas || f.pessoas > 5000) add('faixa-' + n + '-pessoas', 'Faixa ' + n + ': número inteiro de pessoas, de 1 a 5.000.');
    });

    if (!Array.isArray(e.dias) || e.dias.length !== 7) add('dias', 'Informe o movimento dos sete dias da semana.');
    else {
      var algum = false;
      e.dias.forEach(function (m, i) {
        if (!isNum(m) || m < 0 || m > 500) add('dia-' + i, 'O movimento do dia precisa ficar entre 0% e 500%.');
        else if (m > 0) algum = true;
      });
      if (!algum && !erros.some(function (x) { return /^dia-/.test(x.campo); })) add('dias', 'Pelo menos um dia da semana precisa ter movimento.');
    }

    if (e.salario != null && (!isNum(e.salario) || e.salario < 0)) add('salario', 'O salário não pode ser negativo.');
    if (e.encargosPct != null && (!isNum(e.encargosPct) || e.encargosPct < 0 || e.encargosPct > 300)) add('encargosPct', 'Encargos e provisões: um percentual entre 0% e 300%.');
    ['beneficios', 'vr', 'vt', 'saude'].forEach(function (k) {
      if (e[k] != null && (!isNum(e[k]) || e[k] < 0)) add(k, 'Este valor não pode ser negativo.');
    });
    if (e.mesInicio != null && !(e.mesInicio >= 1 && e.mesInicio <= 12)) add('mesInicio', 'Escolha um mês de janeiro a dezembro.');
    return erros;
  }

  /**
   * Simulação por regime de escala.
   * Entradas: pessoas, regimeAtual, jornadaAtual, regimeFuturo, etapa (42|40),
   * faixas [{ini, fim, pessoas}] em horas decimais, dias [7 percentuais seg..dom],
   * disponibilidade (%), disponivel (opcional), salario, encargosPct,
   * beneficiosModo, beneficios | vr/vt/saude, mesInicio.
   */
  function simularRegimes(e) {
    var erros = validarRegimes(e);
    if (erros.length) return { ok: false, erros: erros };

    var n = e.pessoas;
    var disponivel = e.disponivel == null ? n : e.disponivel;
    var dispBp = toBasisPoints(e.disponibilidade);

    var salarioC = toCents(e.salario || 0), vt = null, beneficiosC;
    if (e.beneficiosModo === 'detalhe') {
      vt = valeTransporte(salarioC, toCents(e.vt || 0));
      beneficiosC = toCents(e.vr || 0) + vt.patronal + toCents(e.saude || 0);
    } else {
      beneficiosC = toCents(e.beneficios || 0);
    }
    var unit = custoUnitario(salarioC, toBasisPoints(e.encargosPct || 0), beneficiosC);
    var custoAtual = n * unit.total;

    var base = perfilBase(e.faixas);
    var hoje = infoAtual(e.regimeAtual, e.jornadaAtual);
    var dHoje = demandaSemanal(base, e.dias, hoje.turno);
    var quadroHoje = quadroDoRegime(hoje, dHoje, dispBp);

    function cenario(info, ehAtual) {
      var d = ehAtual ? dHoje : demandaSemanal(base, e.dias, info.turno);
      var referencia = ehAtual ? quadroHoje : quadroDoRegime(info, d, dispBp);
      var novas = ehAtual ? 0 : contratacoes(referencia, disponivel);
      var mensal = custoAtual + novas * unit.total;
      return {
        regime: info.id, atual: !!ehAtual, turno: info.turno, jornada: info.jornada, diasPessoa: info.dias, rigido: info.rigido,
        demanda: d, referencia: referencia,
        quadro: ehAtual ? n : Math.max(0, disponivel) + novas,
        contratacoes: novas,
        salarios: (ehAtual ? n : n + novas) * unit.salario,
        mensal: mensal, acrescimoMensal: mensal - custoAtual, acrescimoAnual: (mensal - custoAtual) * 12
      };
    }
    var cenarios = [cenario(hoje, true)].concat(regimesDaEtapa(e.etapa).map(function (id) { return cenario(infoFuturo(id, e.etapa), false); }));
    var alvo = cenarios.filter(function (c) { return !c.atual && c.regime === e.regimeFuturo; })[0];

    var meses = mesesPrimeiroAno(e.mesInicio == null ? 1 : e.mesInicio);
    return {
      ok: true, pessoas: n, disponivel: disponivel, regimeAtual: e.regimeAtual, regimeFuturo: e.regimeFuturo, etapa: e.etapa,
      jornadaAtual: hoje.jornada, disponibilidade: e.disponibilidade,
      unitario: unit, vt: vt, custoAtual: custoAtual,
      quadroDemandaHoje: quadroHoje, demandaHoje: dHoje,
      pessoasHoraSemana: dHoje.pessoasHora, diasAbertos: dHoje.abertos,
      cenarios: cenarios, alvo: alvo,
      quadroFuturo: alvo.quadro, contratacoes: alvo.contratacoes, custoFuturo: alvo.mensal,
      acrescimoMensal: alvo.acrescimoMensal, acrescimoAnual: alvo.acrescimoAnual,
      mesInicio: e.mesInicio == null ? 1 : e.mesInicio, mesesPrimeiroAno: meses, primeiroAno: alvo.acrescimoMensal * meses,
      percentual: custoAtual > 0 ? (alvo.acrescimoMensal / custoAtual) * 100 : null,
      temCusto: unit.total > 0
    };
  }

  /* ---------- Simulação por função (versão comparativa) ----------
     Cada função tem a sua equipe de hoje, o seu salário e a sua demanda dia a dia
     (faixas de horário por dia da semana). O quadro de cada regime sai da cobertura
     da demanda daquela função; o total é a soma das funções.
     Turnos: a presença na casa é o tempo de trabalho + o intervalo de refeição
     (quando o turno passa de 6h). */

  var DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

  /** Presença na casa (horas) de um turno de trabalho de `trabalho` horas. */
  function presenca(trabalho, intervalo) { return trabalho + (trabalho > 6 ? (intervalo || 0) : 0); }

  /** Demanda da semana a partir de 7 listas de faixas (uma por dia; lista vazia = fechado). */
  function demandaDeDias(semana, presencaHoras) {
    var duracao = Math.max(1, Math.round(presencaHoras * SLOT));
    var porDia = [], total = 0, pico = 0, abertos = 0, fatias = 0;
    semana.forEach(function (faixas) {
      if (!faixas || !faixas.length) { porDia.push(0); return; }
      var dem = perfilBase(faixas);
      var t = turnosParaCobrir(dem, duracao);
      dem.forEach(function (d) { fatias += d; });
      porDia.push(t); total += t; abertos++;
      if (t > pico) pico = t;
    });
    return { porDia: porDia, total: total, pico: pico, abertos: abertos, pessoasHora: fatias / SLOT };
  }

  /** Faixas de uma função (modo manual) × movimento % de cada dia -> 7 listas de faixas. */
  function semanaDeFaixas(faixas, dias) {
    return dias.map(function (m) {
      if (!(m > 0)) return [];
      return faixas.map(function (f) { return { ini: f.ini, fim: f.fim, pessoas: Math.ceil(f.pessoas * m / 100 - 1e-9) }; });
    });
  }

  function validarFuncoes(e) {
    var erros = [];
    function add(campo, msg) { erros.push({ campo: campo, mensagem: msg }); }

    if (REGIMES_ATUAIS.indexOf(e.regimeAtual) === -1) add('regimeAtual', 'Escolha o regime de hoje.');
    else if (e.regimeAtual !== '12x36' && (!isNum(e.jornadaAtual) || e.jornadaAtual <= 0 || e.jornadaAtual > 80)) add('jornadaAtual', 'A jornada atual precisa ficar entre 1 e 80 horas por semana.');

    if (e.etapa !== 42 && e.etapa !== 40) add('etapa', 'Escolha a etapa da jornada (42h ou 40h).');
    else if (regimesDaEtapa(e.etapa).indexOf(e.regimeFuturo) === -1) {
      add('regimeFuturo', e.regimeFuturo === '4x3' ? 'O 4x3 com turnos de 10h só existe na etapa de 40h, por convenção ou acordo coletivo.' : 'Escolha o regime pretendido.');
    }

    if (e.intervalo != null && (!isNum(e.intervalo) || e.intervalo < 0 || e.intervalo > 3)) add('intervalo', 'O intervalo de refeição precisa ficar entre 0 e 3 horas.');

    if (!Array.isArray(e.funcoes) || e.funcoes.length < 1) add('funcoes', 'Informe pelo menos uma função.');
    else if (e.funcoes.length > 40) add('funcoes', 'Use no máximo 40 funções.');
    else {
      var somaHoje = 0;
      e.funcoes.forEach(function (f, i) {
        var n = i + 1, p = 'funcao-' + n + '-';
        if (!isNum(f.hoje) || f.hoje < 0 || Math.round(f.hoje) !== f.hoje || f.hoje > 100000) add(p + 'hoje', 'Função ' + n + ': informe quantas pessoas estão nela hoje (número inteiro, pode ser 0).');
        else somaHoje += f.hoje;
        if (f.salario != null && (!isNum(f.salario) || f.salario < 0)) add(p + 'salario', 'Função ' + n + ': o salário não pode ser negativo.');
        if (f.escala) {
          var okEsc = Array.isArray(f.escala.dias) && f.escala.dias.length === 7 && f.escala.dias.every(function (d) { return d && isNum(d.pessoas) && d.pessoas >= 0 && isNum(d.horas) && d.horas >= 0; });
          if (!okEsc || !f.escala.dias.some(function (d) { return d.pessoas > 0 && d.horas > 0; })) add(p + 'faixas', 'Função ' + n + ': a escala não tem nenhum dia com horas trabalhadas.');
          return;
        }
        if (!Array.isArray(f.semana) || f.semana.length !== 7) { add(p + 'faixas', 'Função ' + n + ': informe a demanda.'); return; }
        var algum = false;
        f.semana.forEach(function (faixas, d) {
          (faixas || []).forEach(function (fx, k) {
            var ok = isNum(fx.ini) && fx.ini >= 0 && fx.ini < 48 && isNum(fx.fim) && fx.fim > 0 && fx.fim <= 48 && fx.fim !== fx.ini && isNum(fx.pessoas) && fx.pessoas >= 1 && Math.round(fx.pessoas) === fx.pessoas && fx.pessoas <= 5000;
            if (!ok) add(f.manual ? p + 'faixa-' + (k + 1) : p + 'faixas', 'Função ' + n + ': confira os horários e as pessoas da demanda.');
          });
          if (faixas && faixas.length) algum = true;
        });
        if (!algum) add(p + 'faixas', 'Função ' + n + ': informe pelo menos uma faixa de horário com pessoas.');
      });
      if (!erros.length && somaHoje < 1) add('funcoes', 'Informe pelo menos uma pessoa na equipe de hoje.');
    }

    if (e.encargosPct != null && (!isNum(e.encargosPct) || e.encargosPct < 0 || e.encargosPct > 300)) add('encargosPct', 'Encargos e provisões: um percentual entre 0% e 300%.');
    ['beneficios', 'vr', 'vt', 'saude'].forEach(function (k) {
      if (e[k] != null && (!isNum(e[k]) || e[k] < 0)) add(k, 'Este valor não pode ser negativo.');
    });
    if (e.mesInicio != null && !(e.mesInicio >= 1 && e.mesInicio <= 12)) add('mesInicio', 'Escolha um mês de janeiro a dezembro.');
    return erros;
  }

  /**
   * Entradas: regimeAtual, jornadaAtual, regimeFuturo, etapa (42|40), intervalo (h),
   * funcoes [{nome, hoje, salario, semana: 7 listas de {ini,fim,pessoas}}],
   * encargosPct, beneficiosModo, beneficios | vr/vt/saude, mesInicio.
   */
  function simularFuncoes(e) {
    var erros = validarFuncoes(e);
    if (erros.length) return { ok: false, erros: erros };

    var intervalo = e.intervalo == null ? 0 : e.intervalo;
    var encBp = toBasisPoints(e.encargosPct || 0);
    var fixo = e.beneficiosModo === 'detalhe' ? null : toCents(e.beneficios || 0);

    var funcoes = e.funcoes.map(function (f, i) {
      var salarioC = toCents(f.salario || 0), vt = null, benC;
      if (fixo === null) {
        vt = valeTransporte(salarioC, toCents(e.vt || 0));
        benC = toCents(e.vr || 0) + vt.patronal + toCents(e.saude || 0);
      } else benC = fixo;
      return { nome: f.nome || ('Função ' + (i + 1)), hoje: f.hoje, semana: f.semana, escala: f.escala || null, unit: custoUnitario(salarioC, encBp, benC), vt: vt };
    });
    var n = funcoes.reduce(function (s, f) { return s + f.hoje; }, 0);
    var custoAtual = funcoes.reduce(function (s, f) { return s + f.hoje * f.unit.total; }, 0);

    var variacao = e.base !== 'equipe';
    var refsHoje = [];
    function cenario(info, ehAtual) {
      var pres = presenca(info.turno, intervalo);
      var linhas = funcoes.map(function (f, i) {
        var d = f.escala ? demandaDeEscala(f.escala, info.turno, pres) : demandaDeDias(f.semana, pres);
        var ref = quadroDoRegime(info, d, 10000);
        if (ehAtual) refsHoje[i] = ref;
        var novas = ehAtual ? 0 : (variacao ? Math.max(0, ref - refsHoje[i]) : contratacoes(ref, f.hoje));
        return {
          nome: f.nome, hoje: f.hoje, demanda: d, referencia: ref, contratacoes: novas,
          quadro: ehAtual ? f.hoje : f.hoje + novas,
          mensal: (ehAtual ? f.hoje : f.hoje + novas) * f.unit.total,
          acrescimoMensal: novas * f.unit.total, unitario: f.unit.total
        };
      });
      var soma = function (k) { return linhas.reduce(function (s, l) { return s + l[k]; }, 0); };
      var mensal = soma('mensal');
      var porDia = [0, 1, 2, 3, 4, 5, 6].map(function (d) { return linhas.reduce(function (s, l) { return s + l.demanda.porDia[d]; }, 0); });
      return {
        regime: info.id, atual: !!ehAtual, turno: info.turno, presenca: pres, jornada: info.jornada, diasPessoa: info.dias, rigido: info.rigido,
        funcoes: linhas, referencia: soma('referencia'), quadro: soma('quadro'), contratacoes: soma('contratacoes'),
        demanda: { porDia: porDia, total: porDia.reduce(function (a, b) { return a + b; }, 0), pico: Math.max.apply(null, porDia), abertos: porDia.filter(function (x) { return x > 0; }).length },
        mensal: mensal, acrescimoMensal: mensal - custoAtual, acrescimoAnual: (mensal - custoAtual) * 12
      };
    }
    var hoje = infoAtual(e.regimeAtual, e.jornadaAtual);
    var cenarios = [cenario(hoje, true)].concat(regimesDaEtapa(e.etapa).map(function (id) { return cenario(infoFuturo(id, e.etapa), false); }));
    var alvo = cenarios.filter(function (c) { return !c.atual && c.regime === e.regimeFuturo; })[0];
    var meses = mesesPrimeiroAno(e.mesInicio == null ? 1 : e.mesInicio);
    var pessoasHora = funcoes.reduce(function (s, f) { return s + (f.escala ? f.escala.dias.reduce(function (a, d) { return a + (d.horas || 0); }, 0) : demandaDeDias(f.semana, 1).pessoasHora); }, 0);

    return {
      ok: true, base: variacao ? 'variacao' : 'equipe', pessoas: n, disponivel: n, regimeAtual: e.regimeAtual, regimeFuturo: e.regimeFuturo, etapa: e.etapa, intervalo: intervalo,
      jornadaAtual: hoje.jornada, funcoes: funcoes, custoAtual: custoAtual,
      unitarioMedio: n > 0 ? roundDiv(custoAtual, n) : 0,
      quadroDemandaHoje: cenarios[0].referencia, demandaHoje: cenarios[0].demanda,
      pessoasHoraSemana: pessoasHora, diasAbertos: cenarios[0].demanda.abertos,
      cenarios: cenarios, alvo: alvo,
      quadroFuturo: alvo.quadro, contratacoes: alvo.contratacoes, custoFuturo: alvo.mensal,
      acrescimoMensal: alvo.acrescimoMensal, acrescimoAnual: alvo.acrescimoAnual,
      mesInicio: e.mesInicio == null ? 1 : e.mesInicio, mesesPrimeiroAno: meses, primeiroAno: alvo.acrescimoMensal * meses,
      percentual: custoAtual > 0 ? (alvo.acrescimoMensal / custoAtual) * 100 : null,
      temCusto: custoAtual > 0 && e.funcoes.some(function (f) { return f.salario > 0; })
    };
  }

  /* ---------- Importação de uma escala existente (CSV) ----------
     Colunas: colaborador; função; dia; início; fim; [salário]. Uma linha por turno.
     "dia" aceita segunda…domingo (ou seg…dom) e datas (dd/mm/aaaa ou aaaa-mm-dd).
     Com datas de várias semanas, a demanda de cada dia da semana é a média (arredondada para cima). */

  function semAcento(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

  var COLUNAS = {
    colaborador: ['colaborador', 'funcionario', 'nome', 'pessoa', 'empregado'],
    funcao: ['funcao', 'cargo', 'setor'],
    dia: ['dia', 'data', 'dia da semana'],
    inicio: ['inicio', 'entrada', 'hora inicio', 'hora de inicio'],
    fim: ['fim', 'saida', 'termino', 'hora fim', 'hora de fim'],
    salario: ['salario', 'salario bruto', 'salario base']
  };

  function dividirCSV(texto) {
    var linhas = String(texto).replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!linhas.length) return [];
    var cab = linhas[0], sep = ';';
    if ((cab.match(/;/g) || []).length === 0) sep = (cab.match(/\t/g) || []).length ? '\t' : ',';
    return linhas.map(function (l) {
      var out = [], cur = '', asp = false;
      for (var i = 0; i < l.length; i++) {
        var c = l[i];
        if (c === '"') { if (asp && l[i + 1] === '"') { cur += '"'; i++; } else asp = !asp; }
        else if (c === sep && !asp) { out.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(cur);
      return out.map(function (x) { return x.trim(); });
    });
  }

  function diaDaSemana(s) {
    var t = semAcento(s);
    var nomes = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    for (var i = 0; i < 7; i++) if (t.indexOf(nomes[i]) === 0) return { idx: i, chave: null };
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t), y, mo, d;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { idx: (dt.getUTCDay() + 6) % 7, chave: y + '-' + mo + '-' + d };
  }

  function horaDeTexto(s) {
    var m = /^(\d{1,2})(?::(\d{2}))?\s*h?(?::\d{2})?$/.exec(semAcento(s));
    if (!m) return NaN;
    var h = +m[1], mi = m[2] ? +m[2] : 0;
    if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return NaN;
    return h + mi / 60;
  }

  function numeroBR(s) {
    var t = String(s == null ? '' : s).replace(/R\$|\s/g, '');
    if (t === '') return null;
    if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
    var v = Number(t);
    return isFinite(v) ? v : NaN;
  }

  function importarEscala(texto) {
    var tab = dividirCSV(texto);
    if (tab.length < 2) return { ok: false, erro: 'O arquivo precisa ter uma linha de títulos e pelo menos um turno.' };
    var cab = tab[0].map(semAcento), col = {};
    Object.keys(COLUNAS).forEach(function (k) {
      for (var i = 0; i < cab.length; i++) if (COLUNAS[k].indexOf(cab[i]) !== -1) { col[k] = i; return; }
    });
    var faltam = ['colaborador', 'funcao', 'dia', 'inicio', 'fim'].filter(function (k) { return col[k] == null; });
    if (faltam.length) return { ok: false, erro: 'Não encontramos as colunas: ' + faltam.map(function (k) { return { colaborador: 'colaborador', funcao: 'função', dia: 'dia', inicio: 'início', fim: 'fim' }[k]; }).join(', ') + '. Use o modelo para conferir os títulos.' };

    var funcs = {}, ordem = [], pessoas = {}, ignoradas = [], linhasOk = 0, horasTotal = 0;
    for (var r = 1; r < tab.length; r++) {
      var L = tab[r], colab = L[col.colaborador], func = L[col.funcao];
      var dia = diaDaSemana(L[col.dia]), ini = horaDeTexto(L[col.inicio]), fim = horaDeTexto(L[col.fim]);
      if (!colab && !func && !L[col.dia]) continue;
      if (!colab || !func || !dia || isNaN(ini) || isNaN(fim) || ini === fim) { ignoradas.push(r + 1); continue; }
      if (fim <= ini) fim += 24;
      var fk = semAcento(func), F = funcs[fk];
      if (!F) { F = funcs[fk] = { nome: func, colabs: {}, salarios: {}, dias: [{}, {}, {}, {}, {}, {}, {}], datas: [{}, {}, {}, {}, {}, {}, {}] }; ordem.push(fk); }
      var ck = semAcento(colab);
      F.colabs[ck] = true; pessoas[ck + '|' + fk] = true;
      var sal = col.salario != null ? numeroBR(L[col.salario]) : null;
      if (sal != null && !isNaN(sal) && sal > 0) F.salarios[ck] = sal;
      var dk = dia.chave || 'semana';
      F.datas[dia.idx][dk] = true;
      var slots = F.dias[dia.idx][dk] || (F.dias[dia.idx][dk] = {});
      var a = Math.round(ini * SLOT), b = Math.round(fim * SLOT);
      for (var s = a; s < b; s++) slots[s] = (slots[s] || 0) + 1;
      linhasOk++; horasTotal += fim - ini;
    }
    if (!ordem.length) return { ok: false, erro: 'Nenhum turno válido encontrado. Confira os dias e os horários (ex.: 08:00).' };

    var funcoes = ordem.map(function (fk) {
      var F = funcs[fk], semana = F.dias.map(function (porData) {
        var chaves = Object.keys(porData);
        if (!chaves.length) return [];
        var soma = {}, maxS = 0;
        chaves.forEach(function (c) { Object.keys(porData[c]).forEach(function (s) { soma[s] = (soma[s] || 0) + porData[c][s]; if (+s > maxS) maxS = +s; }); });
        var faixas = [], atual = null;
        for (var s = 0; s <= maxS + 1; s++) {
          var v = soma[s] ? Math.ceil(soma[s] / chaves.length - 1e-9) : 0;
          if (atual && atual.pessoas === v && v > 0) { atual.fim = (s + 1) / SLOT; continue; }
          if (atual) { faixas.push(atual); atual = null; }
          if (v > 0) atual = { ini: s / SLOT, fim: (s + 1) / SLOT, pessoas: v };
        }
        if (atual) faixas.push(atual);
        // junta fatias contíguas com a mesma contagem já feito; ajusta fim ao fechamento exato
        return faixas;
      });
      var sals = Object.keys(F.salarios).map(function (k) { return F.salarios[k]; });
      return {
        nome: F.nome, hoje: Object.keys(F.colabs).length, semana: semana,
        salario: sals.length ? Math.round(sals.reduce(function (a, b) { return a + b; }, 0) / sals.length * 100) / 100 : null
      };
    });
    var colaboradores = Object.keys(pessoas).length;
    return {
      ok: true, funcoes: funcoes,
      resumo: { turnos: linhasOk, ignoradas: ignoradas, colaboradores: colaboradores, funcoes: funcoes.length, horasPorTurno: horasTotal / linhasOk, turnosPorPessoa: linhasOk / colaboradores }
    };
  }

  /* ---------- Importação da escala em grade (.xlsx) ----------
     Formato típico de planilha de estabelecimento: um bloco por equipe (título, linha "Nome" com os dias,
     uma linha por pessoa) e, em cada dia, os horários "08:00 - 10:00 / 10:30 - 16:00" ou "Folga".
     O simulador lê, por função e por dia da semana: pessoas, horas trabalhadas (sem a pausa),
     pico de pessoas ao mesmo tempo e a curva de cobertura. Nomes não são guardados. */

  var NOMES_COLUNA_NOME = ['nome', 'colaborador', 'colaboradores', 'funcionario', 'funcionarios', 'pessoa', 'equipe'];

  function textoCelula(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }

  function diaDoCabecalho(v) {
    var dt, m, t;
    if (typeof v === 'number') {
      if (v < 30000 || v > 80000) return null;
      dt = new Date(Math.round((v - 25569) * 86400000));
      return { idx: (dt.getUTCDay() + 6) % 7, chave: dt.getUTCFullYear() + '-' + (dt.getUTCMonth() + 1) + '-' + dt.getUTCDate() };
    }
    t = semAcento(v);
    var y, mo, d;
    if ((m = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    if (y) {
      dt = new Date(Date.UTC(y, mo - 1, d));
      if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return { idx: (dt.getUTCDay() + 6) % 7, chave: y + '-' + mo + '-' + d };
    }
    if (/^seg/.test(t)) return { idx: 0, chave: null };
    if (/^ter/.test(t)) return { idx: 1, chave: null };
    if (/^qua/.test(t)) return { idx: 2, chave: null };
    if (/^qui/.test(t)) return { idx: 3, chave: null };
    if (/^sex/.test(t)) return { idx: 4, chave: null };
    if (/^s.?b/.test(t)) return { idx: 5, chave: null };
    if (/^dom/.test(t)) return { idx: 6, chave: null };
    return null;
  }

  /** Linha de cabeçalho: uma célula "Nome" e pelo menos 3 células à direita que são dias. */
  function cabecalhoDeLinha(linha) {
    var c0 = -1, i;
    for (i = 0; i < linha.length; i++) if (linha[i] != null && textoCelula(linha[i]) !== '') { c0 = i; break; }
    if (c0 < 0 || NOMES_COLUNA_NOME.indexOf(semAcento(textoCelula(linha[c0]))) === -1) return null;
    var cols = [];
    for (i = c0 + 1; i < linha.length; i++) {
      if (linha[i] == null) continue;
      var d = diaDoCabecalho(linha[i]);
      if (d) cols.push({ col: i, idx: d.idx, chave: d.chave });
    }
    return cols.length >= 3 ? { c0: c0, cols: cols } : null;
  }

  function horasDeCelula(texto) {
    var re = /\b(\d{1,2})(?::(\d{2})|h(\d{2})?)/g, m, ts = [], ruim = 0;
    while ((m = re.exec(texto))) {
      var h = +m[1], mi = m[2] ? +m[2] : (m[3] ? +m[3] : 0);
      if (h > 24 || mi > 59 || (h === 24 && mi > 0)) { ruim++; continue; }
      ts.push(h + mi / 60);
    }
    var blocos = [], estranho = ruim, i;
    for (i = 0; i + 1 < ts.length; i += 2) {
      var a = ts[i], b = ts[i + 1];
      if (a === b) { estranho++; continue; }
      if (b < a) b += 24;
      blocos.push([a, b]);
    }
    if (ts.length % 2) estranho++;
    return { blocos: blocos, estranho: estranho, temHora: ts.length > 0 };
  }

  function rle(slots, passo) {
    var out = [], i = 0, n = slots.length;
    while (i < n) {
      if (!slots[i]) { i++; continue; }
      var j = i;
      while (j < n && slots[j] === slots[i]) j++;
      out.push({ ini: i * passo, fim: j * passo, pessoas: slots[i] });
      i = j;
    }
    return out;
  }

  /**
   * planilhas: [{ nome, linhas: [[valor…]…] }]  (saída de OrbitXlsx.lerXlsx)
   * -> { ok, funcoes: [{ nome, hoje, salario: null, escala: { dias: [{ pessoas, horas, pico, ini, fim, faixas }] x7 } }], resumo }
   */
  function importarGrade(planilhas) {
    var funcs = {}, ordem = [], pessoasPorFuncao = {}, anomalias = 0, celulasTrabalho = 0, diasComColuna = {};

    planilhas.forEach(function (pl) {
      var linhas = pl.linhas || [], atual = null, cab = null, tituloPendente = null, r;
      function proxima(k) {
        for (var q = k + 1; q < linhas.length; q++) if (linhas[q] && linhas[q].some(function (c) { return c != null && textoCelula(c) !== ''; })) return linhas[q];
        return null;
      }
      for (r = 0; r < linhas.length; r++) {
        var L = linhas[r];
        if (!L) continue;
        var preenchidas = [];
        L.forEach(function (c, i) { if (c != null && textoCelula(c) !== '') preenchidas.push(i); });
        if (!preenchidas.length) continue;

        var h = cabecalhoDeLinha(L);
        if (h) { cab = h; atual = tituloPendente || atual || pl.nome || 'Equipe'; tituloPendente = null; continue; }

        if (preenchidas.length === 1) {
          var prox = proxima(r);
          if (prox && cabecalhoDeLinha(prox)) { tituloPendente = textoCelula(L[preenchidas[0]]).slice(0, 40); cab = null; continue; }
        }
        if (!cab) continue;

        var nome = textoCelula(L[cab.c0]);
        if (!nome || /^(total|contagem|soma|subtotal)\b/.test(semAcento(nome))) continue;
        var chaveF = semAcento(atual), F = funcs[chaveF];
        var porDia = [], contou = false, i2;
        for (i2 = 0; i2 < cab.cols.length; i2++) {
          var col = cab.cols[i2], cel = textoCelula(L[col.col]);
          if (cel === '') continue;
          var hc = horasDeCelula(cel);
          if (hc.blocos.length) { porDia.push({ col: col, blocos: hc.blocos }); contou = true; anomalias += hc.estranho; }
          else if (hc.temHora) anomalias++;
          if (/folga/.test(semAcento(cel))) contou = true;
        }
        if (!contou) continue;
        if (!F) { F = funcs[chaveF] = { nome: atual, datas: {}, dias: [{}, {}, {}, {}, {}, {}, {}], nomes: [], vistos: {} }; ordem.push(chaveF); pessoasPorFuncao[chaveF] = {}; }
        pessoasPorFuncao[chaveF][semAcento(nome)] = true;
        if (!F.vistos[semAcento(nome)]) { F.vistos[semAcento(nome)] = true; F.nomes.push(nome); }
        cab.cols.forEach(function (c) {
          diasComColuna[c.idx] = true;
          (F.datas[c.idx] = F.datas[c.idx] || {})[c.chave || 'semana'] = true;
        });
        porDia.forEach(function (it) {
          var k = it.col.chave || 'semana', reg = F.dias[it.col.idx][k] || (F.dias[it.col.idx][k] = []);
          reg.push(it.blocos); celulasTrabalho++;
        });
      }
    });

    if (!ordem.length || !celulasTrabalho) return { ok: false, erro: 'Não encontramos horários nesta planilha. Ela precisa ter um bloco por equipe, com a linha "Nome", os dias da semana e os horários de cada pessoa (ex.: 08:00 - 16:00).' };

    var totalPessoas = 0, totalTurnos = 0, totalHoras = 0, semanas = 1;
    var funcoes = ordem.map(function (fk) {
      var F = funcs[fk];
      var dias = F.dias.map(function (porData, idx) {
        var chaves = Object.keys(F.datas[idx] || {});
        if (!chaves.length) return { pessoas: 0, horas: 0, pico: 0, ini: 0, fim: 0, faixas: [] };
        if (chaves.length > semanas) semanas = chaves.length;
        var soma = [], s, pessoas = 0, horas = 0, ini = Infinity, fim = -Infinity;
        for (s = 0; s < 96; s++) soma.push(0);
        chaves.forEach(function (k) {
          (porData[k] || []).forEach(function (blocos) {
            pessoas++;
            blocos.forEach(function (b) {
              horas += b[1] - b[0];
              if (b[0] < ini) ini = b[0];
              if (b[1] > fim) fim = b[1];
              for (var q = Math.round(b[0] * 2); q < Math.round(b[1] * 2) && q < 96; q++) soma[q]++;
            });
          });
        });
        var n = chaves.length;
        var curva = soma.map(function (v) { return v ? Math.ceil(v / n - 1e-9) : 0; });
        var pico = curva.reduce(function (m, v) { return Math.max(m, v); }, 0);
        return {
          pessoas: Math.ceil(pessoas / n - 1e-9), horas: Math.round(horas / n * 100) / 100, pico: pico,
          ini: ini === Infinity ? 0 : ini, fim: fim === -Infinity ? 0 : fim, faixas: rle(curva, 0.5)
        };
      });
      var hoje = Object.keys(pessoasPorFuncao[fk]).length;
      totalPessoas += hoje;
      dias.forEach(function (d) { totalTurnos += d.pessoas; totalHoras += d.horas; });
      return { nome: F.nome, hoje: hoje, salario: null, nomes: F.nomes, escala: { dias: dias } };
    });

    var semColuna = [0, 1, 2, 3, 4, 5, 6].filter(function (i) { return !diasComColuna[i]; });
    return {
      ok: true, funcoes: funcoes,
      resumo: { funcoes: funcoes.length, pessoas: totalPessoas, turnos: totalTurnos, horas: totalHoras, semanas: semanas, anomalias: anomalias, diasSemColuna: semColuna }
    };
  }

  /**
   * Demanda de uma função a partir da escala lida. Em cada dia:
   * turnos = teto(horas do dia ÷ horas por turno), nunca abaixo do pico de pessoas ao mesmo tempo;
   * em turnos longos (≥ 10h na casa) também nunca abaixo do mínimo de turnos que cobre a curva do dia.
   */
  function demandaDeEscala(escala, turno, presencaHoras) {
    var porDia = [], total = 0, pico = 0, abertos = 0, horasSem = 0, limite = false;
    var longo = presencaHoras >= 10, duracao = Math.max(1, Math.round(presencaHoras * SLOT));
    escala.dias.forEach(function (d) {
      if (!d || !(d.pessoas > 0) || !(d.horas > 0)) { porDia.push(0); return; }
      var t = Math.max(Math.ceil(d.horas / turno - 1e-9), d.pico || 0);
      if (longo && d.faixas && d.faixas.length) {
        var cob = turnosParaCobrir(perfilBase(d.faixas), duracao);
        if (cob > t) { t = cob; limite = true; }
      }
      porDia.push(t); total += t; abertos++; horasSem += d.horas;
      if (t > pico) pico = t;
    });
    return { porDia: porDia, total: total, pico: pico, abertos: abertos, pessoasHora: horasSem, limiteCobertura: limite };
  }

  /* ---------- Exemplo de escala no regime pretendido ----------
     Monta UMA semana de exemplo, por função, com o quadro que o regime pede: quem trabalha em cada dia,
     em que horário, e quem folga. Cada dia usa os turnos que o cálculo pediu e começa onde a demanda do
     dia começa. Confere folga na semana e pelo menos 11h entre um turno e o próximo (interjornada).
     É um exemplo ilustrativo: não considera domingos, feriados, férias nem regras de convenção coletiva. */

  function fatiasDoDia(faixas) {
    var n = 60 * SLOT, dem = [], i;
    for (i = 0; i < n; i++) dem.push(0);
    (faixas || []).forEach(function (f) {
      var a = Math.round(f.ini * SLOT), b = Math.round(f.fim * SLOT);
      if (b <= a) b += 24 * SLOT;
      for (var s = a; s < b && s < n; s++) dem[s] += f.pessoas;
    });
    return dem;
  }

  /** Horas de início de `quantidade` turnos de `duracao` fatias, posicionados para cobrir a demanda do dia. */
  function iniciosDoDia(faixas, duracao, quantidade) {
    var dem = fatiasDoDia(faixas), n = dem.length, fim = [], cob = 0, ini = [], i, k;
    for (i = 0; i < n + duracao + 1; i++) fim.push(0);
    for (i = 0; i < n; i++) {
      cob -= fim[i];
      if (cob < dem[i]) { var c = dem[i] - cob; cob += c; fim[i + duracao] += c; for (k = 0; k < c; k++) ini.push(i); }
    }
    // ninguém precisa ficar depois de a demanda acabar: o último turno termina na hora em que o dia fecha
    var ultimo = -1;
    for (i = 0; i < n; i++) if (dem[i] > 0) ultimo = i;
    var limite = Math.max(0, ultimo + 1 - duracao);
    ini = ini.map(function (x) { return Math.min(x, limite); });
    function valor(s) { var v = 0; for (var q = s; q < s + duracao && q < n; q++) v += dem[q]; return v; }
    if (!ini.length) {
      for (i = 0; i < n; i++) if (dem[i] > 0) { ini.push(i); break; }
      if (!ini.length) ini.push(8 * SLOT);
    }
    while (ini.length > quantidade) {          // tira o início que cobre menos demanda
      var pior = 0;
      for (k = 1; k < ini.length; k++) if (valor(ini[k]) < valor(ini[pior])) pior = k;
      ini.splice(pior, 1);
    }
    var vezes = {}, vals = {};
    ini.forEach(function (s) { vezes[s] = (vezes[s] || 0) + 1; if (vals[s] == null) vals[s] = valor(s); });
    while (ini.length < quantidade) {          // repete o início que cobre mais demanda por turno já escalado
      var melhor = null, mv = -1;
      Object.keys(vezes).forEach(function (s) { var v2 = vals[s] / vezes[s]; if (v2 > mv) { mv = v2; melhor = s; } });
      ini.push(+melhor); vezes[melhor]++;
    }
    return ini.sort(function (a, b) { return a - b; }).map(function (s) { return s / SLOT; });
  }

  function faixasDoDia(f, d) { return f.escala ? f.escala.dias[d].faixas : (f.semana || [])[d]; }

  function violacoesInterjornada(plan, presH) {
    var v = 0;
    plan.forEach(function (dias) {
      for (var d = 0; d < 6; d++) if (dias[d] != null && dias[d + 1] != null && dias[d + 1] + 24 - (dias[d] + presH) < 11 - 1e-9) v++;
    });
    return v;
  }

  function sementeAleatoria(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function escalaFlexivel(f, lin, alvo, presH, N, rng) {
    var t = lin.demanda.porDia, D = Math.max(1, Math.min(alvo.diasPessoa, lin.demanda.abertos));
    D = Math.max(1, Math.min(D, Math.ceil(lin.demanda.total / N)));
    var dur = Math.max(1, Math.round(presH * SLOT)), need = t.slice(), trab = [], plan = [], p, d, k;
    for (p = 0; p < N; p++) {
      var desempate = [0, 1, 2, 3, 4, 5, 6].map(function (a) { return rng ? rng() : (a + 3 * p) % 7; });
      var ord = [0, 1, 2, 3, 4, 5, 6].sort(function (a, b) { return (need[b] - need[a]) || (desempate[a] - desempate[b]); });
      var meus = [];
      for (k = 0; k < 7 && meus.length < D; k++) if (need[ord[k]] > 0) { meus.push(ord[k]); need[ord[k]]--; }
      trab.push(meus);
      plan.push([null, null, null, null, null, null, null]);
    }
    for (d = 0; d < 7; d++) {
      var W = [];
      for (p = 0; p < N; p++) if (trab[p].indexOf(d) !== -1) W.push(p);
      if (!W.length) continue;
      var S = iniciosDoDia(faixasDoDia(f, d), dur, W.length);
      W.sort(function (a, b) { return (d > 0 && plan[a][d - 1] != null ? plan[a][d - 1] : -99) - (d > 0 && plan[b][d - 1] != null ? plan[b][d - 1] : -99); });
      W.forEach(function (pp, i) { plan[pp][d] = S[i]; });
    }
    // troca horários entre pessoas do mesmo dia quando isso desfaz um intervalo curto demais entre turnos
    function violDe(dias) { return violacoesInterjornada([dias], presH); }
    for (var passo = 0; passo < 8 && violacoesInterjornada(plan, presH) > 0; passo++) {
      var melhorou = false, q, x, y;
      // 1) troca horários entre duas pessoas no mesmo dia
      for (d = 0; d < 7; d++) {
        var W2 = [];
        for (p = 0; p < N; p++) if (plan[p][d] != null) W2.push(p);
        for (var i = 0; i < W2.length; i++) for (var j = i + 1; j < W2.length; j++) {
          var a1 = W2[i], b1 = W2[j], x1 = plan[a1][d];
          if (plan[b1][d] === x1) continue;
          var antes = violDe(plan[a1]) + violDe(plan[b1]);
          if (!antes) continue;
          plan[a1][d] = plan[b1][d]; plan[b1][d] = x1;
          if (violDe(plan[a1]) + violDe(plan[b1]) >= antes) { plan[b1][d] = plan[a1][d]; plan[a1][d] = x1; } else melhorou = true;
        }
      }
      // 2) troca dias de trabalho entre duas pessoas (cada dia continua com os mesmos horários e o mesmo número de turnos)
      for (p = 0; p < N; p++) {
        for (q = 0; q < N && violDe(plan[p]) > 0; q++) {
          if (q === p) continue;
          var antesPQ = violDe(plan[p]) + violDe(plan[q]), feito = false;
          for (x = 0; x < 7 && !feito; x++) {
            if (plan[p][x] == null || plan[q][x] != null) continue;
            for (y = 0; y < 7 && !feito; y++) {
              if (plan[q][y] == null || plan[p][y] != null) continue;
              var px = plan[p][x], qy = plan[q][y];
              plan[p][x] = null; plan[p][y] = qy; plan[q][y] = null; plan[q][x] = px;
              if (violDe(plan[p]) + violDe(plan[q]) < antesPQ) { feito = true; melhorou = true; }
              else { plan[p][y] = null; plan[p][x] = px; plan[q][x] = null; plan[q][y] = qy; }
            }
          }
        }
      }
      if (!melhorou) break;
    }
    return { plan: plan, pede: t.slice(), viol: violacoesInterjornada(plan, presH) };
  }

  /** Várias tentativas com desempates diferentes; fica com a que respeita mais o descanso de 11h. */
  function escalaFlexivelMelhor(f, lin, alvo, presH, N) {
    var tentativas = N <= 80 ? 60 : N <= 200 ? 8 : 2, melhor = null;
    for (var i = 0; i < tentativas; i++) {
      var g = escalaFlexivel(f, lin, alvo, presH, N, i === 0 ? null : sementeAleatoria(i * 7919 + N));
      if (!melhor || g.viol < melhor.viol) melhor = g;
      if (!melhor.viol) break;
    }
    return melhor;
  }

  function escalaRigida(f, lin, alvo, presH, N) {
    var t = lin.demanda.porDia, P = lin.demanda.pico, dur = Math.max(1, Math.round(presH * SLOT)), plan = [], p, d, j;
    for (p = 0; p < N; p++) plan.push([null, null, null, null, null, null, null]);
    var S = iniciosDoDia(faixasDoDia(f, t.indexOf(P)), dur, P);
    var meio = Math.ceil(N / 2), feitos = [], pede = [];
    for (p = 0; p < N; p++) feitos.push(0);
    for (d = 0; d < 7; d++) {
      pede.push(t[d] > 0 ? P : 0);
      if (!(t[d] > 0)) continue;
      var turma = d % 2;       // uma turma nos dias pares e a outra nos ímpares
      for (j = 0; j < P; j++) {
        var melhor = -1;
        for (p = 0; p < N; p++) {
          var daTurma = (p < meio ? 0 : 1) === turma, pos = (p < meio ? p : p - meio) % P;
          if (!daTurma || pos !== j || plan[p][d] != null) continue;
          if (melhor < 0 || feitos[p] < feitos[melhor]) melhor = p;
        }
        if (melhor >= 0) { plan[melhor][d] = S[j]; feitos[melhor]++; }
      }
    }
    return { plan: plan, pede: pede };
  }

  /**
   * e: as entradas do simulador; r: o resultado de simularFuncoes.
   * -> [{ nome, pessoas, linhas: [{ dias: [{ ini, fim } | null] x7, turnos, horas }], emTurno: [x7], pede: [x7], semCobertura, interjornada }]
   */
  function gerarEscalaExemplo(e, r) {
    var alvo = r.alvo, intervalo = e.intervalo || 0, T = alvo.turno, presH = T + (T > 6 ? intervalo : 0);
    return e.funcoes.map(function (f, fi) {
      var lin = alvo.funcoes[fi], N = lin.quadro;
      if (N > 500) return { nome: lin.nome, pessoas: N, grande: true, linhas: [], emTurno: [0, 0, 0, 0, 0, 0, 0], pede: [0, 0, 0, 0, 0, 0, 0], semCobertura: 0, interjornada: 0 };
      if (!(N > 0)) return { nome: lin.nome, pessoas: 0, linhas: [], emTurno: [0, 0, 0, 0, 0, 0, 0], pede: [0, 0, 0, 0, 0, 0, 0], semCobertura: 0, interjornada: 0 };
      var g = alvo.rigido ? escalaRigida(f, lin, alvo, presH, N) : escalaFlexivelMelhor(f, lin, alvo, presH, N);
      var emTurno = [0, 0, 0, 0, 0, 0, 0];
      var linhas = g.plan.map(function (dias) {
        var n = 0;
        var cel = dias.map(function (s, d) { if (s == null) return null; n++; emTurno[d]++; return { ini: s, fim: s + presH }; });
        return { dias: cel, turnos: n, horas: n * T };
      });
      var nomes = f.nomes || [];
      linhas.forEach(function (l, k) { l.nome = k < nomes.length ? nomes[k] : (nomes.length ? 'Nova pessoa ' + (k - nomes.length + 1) : 'Pessoa ' + (k + 1)); });
      var falta = 0;
      g.pede.forEach(function (x, d) { if (emTurno[d] < x) falta += x - emTurno[d]; });
      return { nome: lin.nome, pessoas: N, linhas: linhas, emTurno: emTurno, pede: g.pede, semCobertura: falta, interjornada: alvo.rigido ? 0 : violacoesInterjornada(g.plan, presH), foraDoExemplo: Math.max(0, nomes.length - N), comNomes: nomes.length > 0 };
    });
  }

  var MODELO_CSV = 'Colaborador;Função;Dia;Início;Fim;Salário bruto\r\n' +
    'Pessoa 1;Recepcionista;segunda;08:00;17:00;2200,00\r\n' +
    'Pessoa 1;Recepcionista;terça;08:00;17:00;2200,00\r\n' +
    'Pessoa 2;Gerente;segunda;08:00;12:00;4500,00\r\n' +
    'Pessoa 2;Gerente;sábado;08:00;12:00;4500,00\r\n';


  /* ---------- Formatação pt-BR ---------- */

  function formatBRL(cents, semCentavos) {
    var v = cents / 100;
    return v.toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
      minimumFractionDigits: semCentavos ? 0 : 2,
      maximumFractionDigits: semCentavos ? 0 : 2
    }).replace(/ /g, ' ');
  }
  function formatNum(v, casas) {
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas || 0, maximumFractionDigits: casas || 0 });
  }

  return {
    toCents: toCents, toHundredths: toHundredths, toBasisPoints: toBasisPoints,
    ceilDiv: ceilDiv, quadroPorHoras: quadroPorHoras, pessoasHoraSemana: pessoasHoraSemana,
    quadroPorDemanda: quadroPorDemanda, contratacoes: contratacoes, valeTransporte: valeTransporte,
    custoUnitario: custoUnitario, aumentoPorDias: aumentoPorDias, perdaPorDias: perdaPorDias,
    mesesPrimeiroAno: mesesPrimeiroAno, validar: validar, simular: simular,
    simularRegimes: simularRegimes, validarRegimes: validarRegimes, regimesDaEtapa: regimesDaEtapa,
    perfilBase: perfilBase, demandaSemanal: demandaSemanal, quadroDoRegime: quadroDoRegime,
    simularFuncoes: simularFuncoes, validarFuncoes: validarFuncoes, importarEscala: importarEscala, importarGrade: importarGrade, gerarEscalaExemplo: gerarEscalaExemplo, demandaDeEscala: demandaDeEscala, semanaDeFaixas: semanaDeFaixas, demandaDeDias: demandaDeDias, presenca: presenca, MODELO_CSV: MODELO_CSV,
    formatBRL: formatBRL, formatNum: formatNum
  };
});
