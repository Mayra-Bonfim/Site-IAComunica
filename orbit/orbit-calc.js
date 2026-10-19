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
    formatBRL: formatBRL, formatNum: formatNum
  };
});
