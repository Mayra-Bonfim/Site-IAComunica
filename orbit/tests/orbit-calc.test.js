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
