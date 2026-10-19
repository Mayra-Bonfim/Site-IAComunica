/* ============================================================
   NEXUS MED — Motor dos simuladores (lógica pura, sem DOM)
   ------------------------------------------------------------
   Fonte das fórmulas e dos cenários:
   hubs/negocios/pesquisa/mercado/nexus-med-simuladores-tempo-faturamento-2026-10-19.md
   (seções 5.3, 5.5, 5.6 e 5.7) + decisões da Mayra de 19/10/2026.

   Regras do motor:
   - Todo percentual de redução é HIPÓTESE de cenário, tirada de estudos
     com outros produtos. Nada aqui é medição do Nexus Med.
   - Faturamento e "valor do tempo" são saídas ALTERNATIVAS: o motor nunca
     devolve a soma das duas (dupla contagem).
   - Tempo fora do expediente entra só em qualidade de vida, nunca em faturamento.
   - Dinheiro sai em centavos inteiros (arredondamento só no final).
   Funciona no navegador (window.NxCalc) e no Node (module.exports).
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NxCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSAO = 'Premissas v1 · outubro/2026';

  /* ---------- Cenários (edite aqui; valores definidos pela Mayra em 19/10/2026) ---------- */
  var CENARIOS_CONSULTA = [
    { id: 'conservador', nome: 'Conservador', r: 0.10, rFora: 0.10 },
    { id: 'moderado',    nome: 'Moderado',    r: 0.20, rFora: 0.15, padrao: true },
    { id: 'otimista',    nome: 'Otimista',    r: 0.30, rFora: 0.20, acimaDoMedido: true }
  ];
  // Laudista: teto de 15% (radiografia em prática real mediu 15,5%).
  var CENARIOS_LAUDO = [
    { id: 'conservador', nome: 'Conservador', r: 0.05 },
    { id: 'moderado',    nome: 'Moderado',    r: 0.10, padrao: true },
    { id: 'otimista',    nome: 'Otimista',    r: 0.15 }
  ];
  // φ: fração do tempo liberado que vira atendimento pago (pergunta de demanda).
  var DEMANDA = { sim: 0.75, talvez: 0.50, nao: 0 };
  var LIMITE_OBSERVADO_CONSULTA = 0.08;    // acima de +8% no faturamento: "fora do observado"
  // Teto da faixa relatada por radiologistas brasileiros, em exames por turno de 6 h (Bretas et al.,
  // Radiologia Brasileira): radiografia 40 a 50; ultrassom 18 a 30; tomografia e ressonância 15 a 30.
  // Modalidades sem faixa no estudo não têm referência numérica (só o texto neutro).

  var MODALIDADES = [
    { id: 'rx-torax', nome: 'Radiografia (raio-X)', comEstudo: true, refTurno6h: 50 },
    { id: 'us-abdome', nome: 'Ultrassom abdominal', refTurno6h: 30 },
    { id: 'tc-cranio', nome: 'Tomografia de crânio', refTurno6h: 30 },
    { id: 'rm-joelho', nome: 'Ressonância de joelho', refTurno6h: 30 },
    { id: 'ecg', nome: 'Eletrocardiograma' },
    { id: 'eco', nome: 'Ecocardiograma' },
    { id: 'espirometria', nome: 'Espirometria' },
    { id: 'fundoscopia', nome: 'Fundoscopia' },
    { id: 'oct', nome: 'OCT' },
    { id: 'mapeamento-retina', nome: 'Mapeamento de retina' },
    { id: 'topografia-cornea', nome: 'Topografia de córnea' },
    { id: 'outra', nome: 'Outra' }
  ];

  /* ---------- utilidades ---------- */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function toCents(reais) { return Math.round(Number(reais) * 100); }
  function centsRound(x) { return Math.round(x); }

  function erro(lista, campo, msg) { lista.push({ campo: campo, mensagem: msg }); }

  /* ============================================================
     SIMULADOR 1 — Médico de consulta
     e: { N, D, T, tIn, tOut, V (R$), phi (0–1), valorHora (R$, opcional) }
     ============================================================ */
  function validarConsulta(e) {
    var x = [];
    if (!isNum(e.N) || e.N <= 0) erro(x, 'N', 'Informe quantas consultas você faz por dia (mais que zero).');
    else if (e.N > 200) erro(x, 'N', 'Use no máximo 200 consultas por dia.');
    if (!isNum(e.D) || e.D <= 0 || e.D > 31) erro(x, 'D', 'Dias de atendimento por mês: um número de 1 a 31.');
    if (!isNum(e.T) || e.T <= 0 || e.T > 480) erro(x, 'T', 'Minutos de agenda por consulta: maior que zero e até 480.');
    if (!isNum(e.tIn) || e.tIn <= 0) erro(x, 'tIn', 'Informe quantos minutos de prontuário você gasta por consulta dentro do horário (mais que zero).');
    else if (isNum(e.T) && e.T > 0 && e.tIn >= e.T) erro(x, 'tIn', 'O tempo de prontuário dentro do horário precisa ser menor que o tempo da consulta na agenda.');
    if (e.tOut != null && (!isNum(e.tOut) || e.tOut < 0 || e.tOut > 240)) erro(x, 'tOut', 'Minutos fora do expediente: de 0 a 240 por consulta.');
    if (!isNum(e.V) || e.V <= 0) erro(x, 'V', 'Informe o valor líquido médio que você recebe por consulta (mais que zero).');
    if (!isNum(e.phi) || e.phi < 0 || e.phi > 1) erro(x, 'phi', 'Escolha uma das respostas sobre a sua agenda.');
    if (e.valorHora != null && (!isNum(e.valorHora) || e.valorHora < 0)) erro(x, 'valorHora', 'O valor da sua hora não pode ser negativo.');
    return x;
  }

  function cenarioConsulta(e, c) {
    var tOut = e.tOut || 0;
    var consultasMes = e.N * e.D;
    var delta = e.tIn * c.r;                       // min economizados dentro do slot
    if (!(delta < e.T)) return { id: c.id, invalido: true };
    var dnTeorico = consultasMes * delta / (e.T - delta);
    var pagas = dnTeorico * e.phi;
    var vCents = toCents(e.V);
    var f0 = consultasMes * vCents;
    var ganho = centsRound(pagas * vCents);
    var pct = e.phi * delta / (e.T - delta);       // N, D e V se cancelam
    var minDentro = consultasMes * delta;
    var minFora = consultasMes * tOut * c.rFora;
    var horas = (minDentro + minFora) / 60;
    var valorHora = e.valorHora != null ? e.valorHora : e.V * 60 / e.T;
    return {
      id: c.id, nome: c.nome, r: c.r, rFora: c.rFora, acimaDoMedido: !!c.acimaDoMedido, padrao: !!c.padrao,
      delta: delta,
      consultasMes: consultasMes,
      deltaNTeorico: dnTeorico,
      consultasPagas: pagas,
      faturamentoAtual: f0,              // centavos
      ganhoFaturamento: ganho,           // centavos — alternativa A
      pctFaturamento: pct,
      foraObservado: pct > LIMITE_OBSERVADO_CONSULTA,
      horasDentro: minDentro / 60,
      horasFora: minFora / 60,
      horasDevolvidas: horas,
      periodos4h: horas / 4,
      valorHora: valorHora,
      valorHoraDerivado: e.valorHora == null,
      valorTempo: centsRound(horas * toCents(valorHora))  // centavos — alternativa B (nunca somar com A)
    };
  }

  function simularConsulta(e) {
    var erros = validarConsulta(e);
    if (erros.length) return { ok: false, erros: erros };
    var cenarios = CENARIOS_CONSULTA.map(function (c) { return cenarioConsulta(e, c); });
    if (cenarios.some(function (c) { return c.invalido; })) {
      return { ok: false, erros: [{ campo: 'tIn', mensagem: 'Com esses números, o tempo economizado ficaria maior que a consulta. Revise os minutos.' }] };
    }
    return { ok: true, tipo: 'consulta', versao: VERSAO, entradas: e, cenarios: cenarios };
  }

  /* ============================================================
     SIMULADOR 2 — Médico laudista
     e: { modalidade, L, D, t, pagamento: 'producao'|'misto'|'plantao',
          v (R$, produção), phi, horasPlantao, valorPlantao, valorHora (opcional) }
     ============================================================ */
  function modalidade(id) {
    for (var i = 0; i < MODALIDADES.length; i++) if (MODALIDADES[i].id === id) return MODALIDADES[i];
    return null;
  }

  function validarLaudo(e) {
    var x = [];
    if (!modalidade(e.modalidade)) erro(x, 'modalidade', 'Escolha a modalidade do exame.');
    if (!isNum(e.L) || e.L <= 0) erro(x, 'L', 'Informe quantos laudos você faz por dia (mais que zero).');
    else if (e.L > 500) erro(x, 'L', 'Use no máximo 500 laudos por dia.');
    if (!isNum(e.D) || e.D <= 0 || e.D > 31) erro(x, 'D', 'Dias por mês: um número de 1 a 31.');
    if (!isNum(e.t) || e.t <= 0 || e.t > 240) erro(x, 't', 'Minutos por laudo: maior que zero e até 240.');
    if (['producao', 'misto', 'plantao'].indexOf(e.pagamento) === -1) erro(x, 'pagamento', 'Escolha como você recebe.');
    if (e.pagamento === 'producao') {
      if (!isNum(e.v) || e.v <= 0) erro(x, 'v', 'Informe o valor que você recebe por laudo (mais que zero).');
      if (!isNum(e.phi) || e.phi < 0 || e.phi > 1) erro(x, 'phi', 'Escolha uma das respostas sobre a fila de exames.');
    }
    if (e.pagamento === 'plantao') {
      if (!isNum(e.horasPlantao) || e.horasPlantao <= 0 || e.horasPlantao > 24) erro(x, 'horasPlantao', 'Horas do plantão: maior que zero e até 24.');
      if (!isNum(e.valorPlantao) || e.valorPlantao <= 0) erro(x, 'valorPlantao', 'Informe o valor do plantão (mais que zero).');
    }
    if (e.valorHora != null && (!isNum(e.valorHora) || e.valorHora < 0)) erro(x, 'valorHora', 'O valor da sua hora não pode ser negativo.');
    return x;
  }

  function cenarioLaudo(e, c, mod) {
    mod = mod || modalidade(e.modalidade);
    if (!(c.r >= 0 && c.r < 1)) return { id: c.id, invalido: true };
    var laudosMes = e.L * e.D;
    var horasLaudoDia = e.L * e.t / 60;
    var minLiberados = laudosMes * e.t * c.r;
    var horas = minLiberados / 60;
    var out = {
      id: c.id, nome: c.nome, r: c.r, padrao: !!c.padrao,
      laudosMes: laudosMes,
      deltaLTeorico: laudosMes * c.r / (1 - c.r),
      horasDevolvidas: horas,
      periodos4h: horas / 4,
      horasLaudoDia: horasLaudoDia,
      aumentaRenda: e.pagamento === 'producao'
    };
    // faturamento: só por produção
    if (e.pagamento === 'producao') {
      var vCents = toCents(e.v);
      out.laudosPagos = out.deltaLTeorico * e.phi;
      out.faturamentoAtual = laudosMes * vCents;
      out.ganhoFaturamento = centsRound(out.laudosPagos * vCents);
      out.pctFaturamento = e.phi * c.r / (1 - c.r);
      var extrasDia = out.laudosPagos / e.D;
      // referência de segurança por modalidade (teto relatado por turno de 6 h). Só alerta quando
      // o cenário acrescenta laudos e leva o ritmo para acima do teto; se o ritmo atual já está
      // acima, sinaliza separadamente (o cenário não é a causa).
      out.refTurno6h = mod && mod.refTurno6h ? mod.refTurno6h : null;
      out.laudosDiaComCenario = e.L + extrasDia;
      out.ritmoAtualAcimaReferencia = out.refTurno6h != null && e.L > out.refTurno6h;
      out.acimaReferenciaSeguranca = out.refTurno6h != null && extrasDia > 0 &&
        !out.ritmoAtualAcimaReferencia && out.laudosDiaComCenario > out.refTurno6h;
    } else {
      out.laudosPagos = 0;
      out.ganhoFaturamento = 0;
      out.pctFaturamento = 0;
      out.acimaReferenciaSeguranca = false;
      out.ritmoAtualAcimaReferencia = false;
    }
    if (e.pagamento === 'plantao') {
      out.horasLiberadasPorPlantao = e.horasPlantao * c.r;
      out.valorHoraPlantaoHoje = toCents(e.valorPlantao) / e.horasPlantao;
      out.valorHoraEquivalente = centsRound(toCents(e.valorPlantao) / (e.horasPlantao * (1 - c.r)));
    }
    var valorHora = e.valorHora != null ? e.valorHora
      : (e.pagamento === 'plantao' ? e.valorPlantao / e.horasPlantao
        : (e.pagamento === 'producao' ? e.v * 60 / e.t : null));
    out.valorHora = valorHora;
    out.valorHoraDerivado = e.valorHora == null;
    out.valorTempo = valorHora == null ? null : centsRound(horas * toCents(valorHora));
    return out;
  }

  function simularLaudo(e) {
    var erros = validarLaudo(e);
    if (erros.length) return { ok: false, erros: erros };
    var mod = modalidade(e.modalidade);
    var lista = mod.comEstudo ? CENARIOS_LAUDO : CENARIOS_LAUDO.filter(function (c) { return c.id === 'conservador'; });
    return {
      ok: true, tipo: 'laudo', versao: VERSAO, entradas: e, modalidade: mod,
      semEstudo: !mod.comEstudo,
      cenarios: lista.map(function (c) { return cenarioLaudo(e, c, mod); })
    };
  }

  /* ---------- formatação pt-BR ---------- */
  function brl(cents, casas) {
    var c = casas == null ? 0 : casas;
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c }).replace(/ /g, ' ');
  }
  function num(v, casas) {
    var c = casas == null ? 0 : casas;
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  }
  function pct(v, casas) { return num(v * 100, casas == null ? 1 : casas) + '%'; }
  /** horas decimais -> "7 h 28 min" (ou "45 min") */
  function duracao(horas) {
    var m = Math.round(horas * 60);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return num(h) + ' h' + (r ? ' ' + (r < 10 ? '0' + r : r) + ' min' : '');
  }

  return {
    VERSAO: VERSAO, CENARIOS_CONSULTA: CENARIOS_CONSULTA, CENARIOS_LAUDO: CENARIOS_LAUDO,
    DEMANDA: DEMANDA, MODALIDADES: MODALIDADES, LIMITE_OBSERVADO_CONSULTA: LIMITE_OBSERVADO_CONSULTA,
    toCents: toCents, simularConsulta: simularConsulta, simularLaudo: simularLaudo,
    validarConsulta: validarConsulta, validarLaudo: validarLaudo, cenarioConsulta: cenarioConsulta, cenarioLaudo: cenarioLaudo,
    brl: brl, num: num, pct: pct, duracao: duracao
  };
});
