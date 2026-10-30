// Testes do motor de cálculo do simulador Orbit.
// Rodar (sem npm install): node --test orbit/tests/
// Casos de aceite: "Orbit — Projeto Simulador Quadro & Custos", págs. 6, 9, 14, 17, 18 e 19.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../orbit-calc.js');

const exemploP9 = {
  pessoas: 100, jornadaAtual: 44, jornadaFutura: 40, base: 'horas',
  salario: 2000, encargosPct: 45, beneficiosModo: 'total', beneficios: 500, mesInicio: 7
};

test('p.14 — 100 pessoas 44h → 40h: 110 no total, 10 contratações', () => {
  assert.equal(C.quadroPorHoras(100, 44, 40), 110);
  const r = C.simular({ pessoas: 100, jornadaAtual: 44, jornadaFutura: 40 });
  assert.equal(r.quadroFuturo, 110);
  assert.equal(r.contratacoes, 10);
});

test('p.14 — 100 pessoas 44h → 42h: 105 (arredondado para cima), 5 contratações', () => {
  assert.equal(C.quadroPorHoras(100, 44, 42), 105); // 104,76… → 105
  const r = C.simular({ pessoas: 100, jornadaAtual: 44, jornadaFutura: 42 });
  assert.equal(r.quadroFuturo, 105);
  assert.equal(r.contratacoes, 5);
});

test('p.9 — exemplo completo: custo unitário R$ 3.400 e totais por cenário', () => {
  const r = C.simular(exemploP9);
  assert.equal(r.ok, true);
  assert.equal(r.unitario.salario, 200000);
  assert.equal(r.unitario.encargos, 90000);
  assert.equal(r.unitario.beneficios, 50000);
  assert.equal(r.unitario.total, 340000);

  const [atual, c42, c40] = r.cenarios;
  assert.deepEqual([atual.jornada, c42.jornada, c40.jornada], [44, 42, 40]);
  assert.deepEqual([atual.quadro, c42.quadro, c40.quadro], [100, 105, 110]);
  assert.deepEqual([atual.contratacoes, c42.contratacoes, c40.contratacoes], [0, 5, 10]);
  assert.deepEqual([atual.salarios, c42.salarios, c40.salarios], [20000000, 21000000, 22000000]);
  assert.deepEqual([atual.encargos, c42.encargos, c40.encargos], [9000000, 9450000, 9900000]);
  assert.deepEqual([atual.beneficios, c42.beneficios, c40.beneficios], [5000000, 5250000, 5500000]);
  assert.deepEqual([atual.mensal, c42.mensal, c40.mensal], [34000000, 35700000, 37400000]);
  assert.equal(c42.acrescimoMensal, 1700000);
  assert.equal(c40.acrescimoMensal, 3400000);
  assert.equal(c42.acrescimoAnual, 20400000);
  assert.equal(c40.acrescimoAnual, 40800000);
  assert.equal(r.percentual, 10);
});

test('p.9 — 10 admissões em julho: 6 meses no primeiro ano = R$ 204.000', () => {
  assert.equal(C.mesesPrimeiroAno(7), 6);
  const r = C.simular(exemploP9);
  assert.equal(r.mesesPrimeiroAno, 6);
  assert.equal(r.primeiroAno, 20400000);
  assert.equal(C.formatBRL(r.primeiroAno, true), 'R$ 204.000');
});

test('p.17 — demanda: 7 dias × 12h × 3 pessoas = 252 pessoas-hora ÷ 40h = 7', () => {
  const ph = C.pessoasHoraSemana(7, 12, 3);
  assert.equal(ph / 100, 252);
  assert.equal(C.quadroPorDemanda(ph, 40, 100), 7);
  // 84 ÷ 40 dimensionaria só um posto (3), não os três postos simultâneos
  assert.equal(C.quadroPorDemanda(C.pessoasHoraSemana(7, 12, 1), 40, 100), 3);
  const r = C.simular({ pessoas: 5, jornadaAtual: 44, jornadaFutura: 40, base: 'demanda', dias: 7, horasDia: 12, simultaneas: 3, disponibilidade: 100 });
  assert.equal(r.pessoasHora, 252);
  assert.equal(r.alvo.referencia, 7);
  assert.equal(r.postoUnicoQuadro, 3);
  assert.equal(r.contratacoes, 2);
});

test('p.17 — disponibilidade reduz a capacidade (jornada × disponibilidade)', () => {
  const ph = C.pessoasHoraSemana(7, 12, 3); // 252
  assert.equal(C.quadroPorDemanda(ph, 40, 90), 7); // 252 / 36 = 7
  assert.equal(C.quadroPorDemanda(ph, 40, 85), 8); // 252 / 34 = 7,41 → 8
});

test('p.17 — fator de dias: 6/5 = +20% de quadro; perda 1/6 = 16,7% (não se acumula com 44/40)', () => {
  assert.equal(Math.round(C.aumentoPorDias(6, 5) * 1000) / 10, 20);
  assert.equal(Math.round(C.perdaPorDias(6, 5) * 1000) / 10, 16.7);
  // A mudança 44→40 já reflete a redução; não multiplicar por 1,2 de novo (seria 132).
  const r = C.simular({ pessoas: 100, jornadaAtual: 44, jornadaFutura: 40 });
  assert.equal(r.quadroFuturo, 110);
  assert.notEqual(r.quadroFuturo, Math.ceil(110 * 1.2));
});

test('p.19 — vale-transporte: participação = menor entre VT e 6% do salário', () => {
  assert.deepEqual(C.valeTransporte(200000, 22000), { participacao: 12000, patronal: 10000 });
  assert.deepEqual(C.valeTransporte(200000, 9000), { participacao: 9000, patronal: 0 });
});

test('p.19 — benefícios detalhados entram líquidos no custo unitário', () => {
  const r = C.simular({ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, salario: 2000, encargosPct: 0,
    beneficiosModo: 'detalhe', vr: 300, vt: 220, saude: 0 });
  assert.equal(r.vt.patronal, 10000);
  assert.equal(r.unitario.beneficios, 40000); // 300 + 100
});

test('p.18 — custo unitário: 2.000 × 1,8 + 500 = R$ 4.100', () => {
  const u = C.custoUnitario(C.toCents(2000), C.toBasisPoints(80), C.toCents(500));
  assert.equal(u.total, 410000);
  assert.equal(C.formatBRL(u.total), 'R$ 4.100,00');
});

test('jornada futura maior ou igual à atual → 0 contratações', () => {
  for (const hf of [44, 46]) {
    const r = C.simular({ pessoas: 100, jornadaAtual: 44, jornadaFutura: hf });
    assert.equal(r.ok, true);
    assert.equal(r.contratacoes, 0);
    assert.equal(r.futuraNaoMenor, true);
    assert.equal(r.quadroFuturo, 100); // nunca sugere reduzir o quadro
  }
});

test('quadro disponível maior que o necessário → 0 contratações; menor → mais contratações', () => {
  assert.equal(C.contratacoes(110, 115), 0);
  assert.equal(C.contratacoes(110, 95), 15);
  const r = C.simular({ pessoas: 100, disponivel: 98, jornadaAtual: 44, jornadaFutura: 40 });
  assert.equal(r.contratacoes, 12);
});

test('entradas inválidas são rejeitadas com mensagem em português', () => {
  const casos = [
    [{ pessoas: 0, jornadaAtual: 44, jornadaFutura: 40 }, 'pessoas'],
    [{ pessoas: -5, jornadaAtual: 44, jornadaFutura: 40 }, 'pessoas'],
    [{ pessoas: 10.5, jornadaAtual: 44, jornadaFutura: 40 }, 'pessoas'],
    [{ pessoas: 10, jornadaAtual: 0, jornadaFutura: 40 }, 'jornadaAtual'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: -1 }, 'jornadaFutura'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, salario: -1 }, 'salario'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, encargosPct: -10 }, 'encargosPct'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, disponivel: -1 }, 'disponivel'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, base: 'demanda', dias: 7, horasDia: 12, simultaneas: 3, disponibilidade: 0 }, 'disponibilidade'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, base: 'demanda', dias: 7, horasDia: 12, simultaneas: 3, disponibilidade: 120 }, 'disponibilidade'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, base: 'demanda', dias: 8, horasDia: 12, simultaneas: 3, disponibilidade: 100 }, 'dias'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, base: 'demanda', dias: 7, horasDia: 0, simultaneas: 3, disponibilidade: 100 }, 'horasDia'],
    [{ pessoas: 10, jornadaAtual: 44, jornadaFutura: 40, mesInicio: 13 }, 'mesInicio'],
    [{ pessoas: NaN, jornadaAtual: 44, jornadaFutura: 40 }, 'pessoas']
  ];
  for (const [entrada, campo] of casos) {
    const r = C.simular(entrada);
    assert.equal(r.ok, false, JSON.stringify(entrada));
    assert.ok(r.erros.some((x) => x.campo === campo), `esperava erro em ${campo}`);
    assert.ok(r.erros.every((x) => typeof x.mensagem === 'string' && x.mensagem.length > 10));
  }
  // funções puras não quebram com zeros
  assert.equal(C.quadroPorHoras(100, 44, 0), 0);
  assert.equal(C.quadroPorDemanda(0, 40, 100), 0);
  assert.equal(C.mesesPrimeiroAno(0), 0);
});

test('dinheiro em centavos inteiros: sem erro de ponto flutuante', () => {
  assert.equal(C.toCents(0.1 + 0.2), 30);
  assert.equal(C.toCents(1234.565), 123457);
  const u = C.custoUnitario(C.toCents(1518.33), C.toBasisPoints(37.7), C.toCents(412.1));
  assert.ok(Number.isInteger(u.encargos) && Number.isInteger(u.total));
  assert.equal(u.encargos, 57241); // 151833 × 0,377 = 57241,04 → 57241
  assert.equal(u.total, 151833 + 57241 + 41210);
  const r = C.simular({ pessoas: 37, jornadaAtual: 44, jornadaFutura: 42.5, salario: 1518.33, encargosPct: 37.7, beneficios: 412.1, mesInicio: 3 });
  for (const c of r.cenarios) {
    for (const k of ['salarios', 'encargos', 'beneficios', 'mensal', 'acrescimoMensal', 'acrescimoAnual']) {
      assert.ok(Number.isInteger(c[k]), k);
    }
  }
  assert.equal(C.quadroPorHoras(37, 44, 42.5), 39); // 38,30… → 39
  assert.equal(r.primeiroAno, r.acrescimoMensal * 10);
});

/* ============================================================
   Regimes de escala (6x1, 5x2, 4x3, 12x36) — simularRegimes
   Perfis didáticos (números ilustrativos, não são dados reais).
   ============================================================ */
const faixasRestaurante = [
  { ini: 5, fim: 9, pessoas: 2 }, { ini: 9, fim: 12, pessoas: 3 }, { ini: 12, fim: 16, pessoas: 6 },
  { ini: 16, fim: 19, pessoas: 2 }, { ini: 19, fim: 23, pessoas: 5 }, { ini: 23, fim: 1, pessoas: 2 }
];
function entradaRegime(over) {
  return Object.assign({
    pessoas: 20, regimeAtual: '6x1', jornadaAtual: 44, regimeFuturo: '12x36', etapa: 40,
    faixas: faixasRestaurante, dias: [100, 100, 100, 100, 150, 150, 150], disponibilidade: 100,
    salario: 2000, encargosPct: 45, beneficiosModo: 'total', beneficios: 500, mesInicio: 7
  }, over || {});
}
const quadros = (r) => Object.fromEntries(r.cenarios.map((c) => [c.atual ? 'hoje' : c.regime, c.referencia]));

test('regimes — restaurante com pico de fim de semana: 12x36 pede mais gente que 5x2 e 4x3', () => {
  const r = C.simularRegimes(entradaRegime({ etapa: 40 }));
  assert.equal(r.ok, true);
  assert.deepEqual(quadros(r), { hoje: 20, '5x2': 23, '4x3': 24, '12x36': 28 });
  assert.equal(r.quadroDemandaHoje, 20);
  assert.equal(r.contratacoes, 8);       // 28 − 20 disponíveis
  assert.equal(r.quadroFuturo, 28);
});

test('regimes — etapa de 42h: 12x36 usa a média de 42h (3,5 turnos) e o 4x3 não é oferecido', () => {
  const r = C.simularRegimes(entradaRegime({ etapa: 42 }));
  assert.deepEqual(quadros(r), { hoje: 20, '5x2': 23, '12x36': 26 });
  assert.deepEqual(C.regimesDaEtapa(42), ['5x2', '12x36']);
  assert.deepEqual(C.regimesDaEtapa(40), ['5x2', '4x3', '12x36']);
});

test('regimes — sem variação de movimento na semana, 12x36 não pede gente a mais que hoje', () => {
  const r = C.simularRegimes(entradaRegime({ etapa: 42, dias: [100, 100, 100, 100, 100, 100, 100] }));
  const q = quadros(r);
  assert.equal(q['12x36'], q.hoje);
  assert.ok(q['5x2'] > q.hoje);
});

test('regimes — 4x3 com etapa de 42h é rejeitado', () => {
  const r = C.simularRegimes(entradaRegime({ etapa: 42, regimeFuturo: '4x3' }));
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((x) => x.campo === 'regimeFuturo'));
});

test('regimes — empresa que já está em 12x36 compara com 5x2 em condições justas', () => {
  const r = C.simularRegimes(entradaRegime({ regimeAtual: '12x36', regimeFuturo: '5x2', etapa: 40, pessoas: 28 }));
  assert.equal(r.ok, true);
  assert.equal(r.cenarios[0].regime, '12x36');
  assert.equal(r.cenarios[0].referencia, 26); // pico 13 × 7 dias ÷ 3,5 dias por pessoa
  assert.equal(r.quadroDemandaHoje, 26);
});

test('regimes — faixa que atravessa a meia-noite (23:00 às 01:00) e dia fechado (0%)', () => {
  const r = C.simularRegimes(entradaRegime({ dias: [100, 100, 100, 100, 100, 100, 0] }));
  assert.equal(r.ok, true);
  assert.equal(r.diasAbertos, 6);
  assert.equal(r.demandaHoje.porDia[6], 0);
});

test('regimes — disponibilidade de 90% aumenta o quadro de todos os regimes', () => {
  const cheio = quadros(C.simularRegimes(entradaRegime()));
  const noventa = quadros(C.simularRegimes(entradaRegime({ disponibilidade: 90 })));
  for (const k of Object.keys(cheio)) assert.ok(noventa[k] >= cheio[k], k);
  assert.ok(noventa['5x2'] > cheio['5x2']);
});

test('regimes — custo: contratações × custo unitário, sem desligamento presumido', () => {
  const r = C.simularRegimes(entradaRegime({ pessoas: 40, regimeFuturo: '5x2' }));
  assert.equal(r.contratacoes, 0);          // 23 < 40 disponíveis
  assert.equal(r.acrescimoMensal, 0);
  const s = C.simularRegimes(entradaRegime({ regimeFuturo: '5x2' }));
  assert.equal(s.contratacoes, 3);
  assert.equal(s.acrescimoMensal, 3 * 340000);
});

test('regimes — validação das faixas e dos dias', () => {
  const sem = C.simularRegimes(entradaRegime({ faixas: [] }));
  assert.equal(sem.ok, false);
  const igual = C.simularRegimes(entradaRegime({ faixas: [{ ini: 8, fim: 8, pessoas: 2 }] }));
  assert.ok(igual.erros.some((x) => x.campo === 'faixa-1-fim'));
  const pessoas = C.simularRegimes(entradaRegime({ faixas: [{ ini: 8, fim: 12, pessoas: 0 }] }));
  assert.ok(pessoas.erros.some((x) => x.campo === 'faixa-1-pessoas'));
  const fechado = C.simularRegimes(entradaRegime({ dias: [0, 0, 0, 0, 0, 0, 0] }));
  assert.ok(fechado.erros.some((x) => x.campo === 'dias'));
  const disp = C.simularRegimes(entradaRegime({ disponibilidade: 0 }));
  assert.ok(disp.erros.some((x) => x.campo === 'disponibilidade'));
});

/* ---------- Versão comparativa: simulação por função e importação de escala ---------- */
const hh = (s) => { const [a, b] = s.split(':').map(Number); return a + b / 60; };
const fn = (nome, hoje, salario, faixas, dias) => ({
  nome, hoje, salario,
  semana: C.semanaDeFaixas(faixas.map(([i, f, p]) => ({ ini: hh(i), fim: hh(f), pessoas: p })), dias || [100, 100, 100, 100, 100, 100, 0])
});
const base = { regimeAtual: '6x1', jornadaAtual: 44, regimeFuturo: '5x2', etapa: 40, intervalo: 1, encargosPct: 45, beneficios: 500 };

test('por função: o intervalo soma ao turno e uma janela de 9h cabe em um turno de 8h', () => {
  const r = C.simularFuncoes({ ...base, funcoes: [fn('Recepcionista', 2, 2000, [['08:00', '17:00', 1]])] });
  assert.equal(r.ok, true);
  const cinco = r.cenarios.find((c) => c.regime === '5x2');
  // 8h de trabalho + 1h de intervalo = 9h na casa: 6 turnos na semana ÷ 5 dias = 2 pessoas
  assert.equal(cinco.funcoes[0].referencia, 2);
  assert.equal(cinco.presenca, 9);
});

test('por função: sem intervalo a mesma janela exige turnos a mais', () => {
  const r = C.simularFuncoes({ ...base, intervalo: 0, funcoes: [fn('Recepcionista', 2, 2000, [['08:00', '17:00', 1]])] });
  assert.equal(r.cenarios.find((c) => c.regime === '5x2').funcoes[0].referencia, 3); // 2 turnos por dia × 6 dias ÷ 5 = 2,4 → 3
});

test('por função: cada função usa o seu salário no custo', () => {
  const r = C.simularFuncoes({
    ...base, regimeFuturo: '12x36', encargosPct: 0, beneficios: 0,
    funcoes: [fn('A', 1, 2000, [['08:00', '16:00', 1]]), fn('B', 1, 5000, [['08:00', '16:00', 1]])]
  });
  assert.equal(r.custoAtual, 700000);
  const a = r.alvo.funcoes;
  assert.equal(a[0].unitario, 200000);
  assert.equal(a[1].unitario, 500000);
  assert.equal(r.acrescimoMensal, a[0].contratacoes * 200000 + a[1].contratacoes * 500000);
});

test('por função: modo variação ignora a folga ou a falta entre a equipe informada e a demanda', () => {
  const f = [fn('X', 1, 2000, [['08:00', '17:00', 1]])];
  const v = C.simularFuncoes({ ...base, funcoes: f, base: 'variacao' });
  const q = C.simularFuncoes({ ...base, funcoes: f, base: 'equipe' });
  const cv = v.cenarios.find((c) => c.regime === '5x2'), cq = q.cenarios.find((c) => c.regime === '5x2');
  assert.equal(cv.contratacoes, Math.max(0, cv.funcoes[0].referencia - v.cenarios[0].funcoes[0].referencia));
  assert.equal(cq.contratacoes, Math.max(0, cq.funcoes[0].referencia - 1));
});

test('por função: validações', () => {
  const campos = (e) => C.simularFuncoes(e).erros.map((x) => x.campo);
  assert.ok(campos({ ...base, funcoes: [] }).includes('funcoes'));
  assert.ok(campos({ ...base, funcoes: [{ nome: 'A', hoje: NaN, salario: 0, semana: [[], [], [], [], [], [], []] }] }).includes('funcao-1-hoje'));
  assert.ok(campos({ ...base, funcoes: [{ nome: 'A', hoje: 1, salario: 0, semana: [[], [], [], [], [], [], []] }] }).includes('funcao-1-faixas'));
  assert.ok(campos({ ...base, intervalo: 5, funcoes: [fn('A', 1, 0, [['08:00', '12:00', 1]])] }).includes('intervalo'));
  assert.ok(campos({ ...base, etapa: 42, regimeFuturo: '4x3', funcoes: [fn('A', 1, 0, [['08:00', '12:00', 1]])] }).includes('regimeFuturo'));
});

test('importar escala: funções, pessoas, dias e salário', () => {
  const csv = 'Colaborador;Função;Dia;Início;Fim;Salário\nAna;Recepcionista;segunda;08:00;17:00;2.200,00\nAna;Recepcionista;terça;08:00;17:00;2.200,00\nBia;Recepcionista;terça;08:00;17:00;2.400,00\nCarla;Gerente;sábado;22:00;02:00;\n';
  const r = C.importarEscala(csv);
  assert.equal(r.ok, true);
  assert.equal(r.funcoes.length, 2);
  const rec = r.funcoes[0];
  assert.equal(rec.nome, 'Recepcionista'); assert.equal(rec.hoje, 2); assert.equal(rec.salario, 2300);
  assert.deepEqual(rec.semana[0], [{ ini: 8, fim: 17, pessoas: 1 }]);
  assert.deepEqual(rec.semana[1], [{ ini: 8, fim: 17, pessoas: 2 }]);
  assert.deepEqual(rec.semana[2], []);
  const ger = r.funcoes[1];
  assert.equal(ger.salario, null);
  assert.deepEqual(ger.semana[5], [{ ini: 22, fim: 26, pessoas: 1 }]);
});

test('importar escala: datas de várias semanas viram a média por dia da semana', () => {
  const csv = 'Colaborador,Funcao,Data,Inicio,Fim\nA,Caixa,05/10/2026,09:00,13:00\nB,Caixa,05/10/2026,09:00,13:00\nA,Caixa,12/10/2026,09:00,13:00\n';
  const r = C.importarEscala(csv);
  assert.equal(r.ok, true);
  assert.deepEqual(r.funcoes[0].semana[0], [{ ini: 9, fim: 13, pessoas: 2 }]); // média 1,5 → 2
});

test('importar escala: erros claros', () => {
  assert.equal(C.importarEscala('a;b\n1;2').ok, false);
  assert.match(C.importarEscala('Colaborador;Função;Dia\nA;B;seg').erro, /início, fim/);
  assert.equal(C.importarEscala('Colaborador;Função;Dia;Início;Fim\nA;B;xx;08:00;17:00').ok, false);
});
