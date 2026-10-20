// Testes do motor dos simuladores do Nexus Med.
// Rodar (sem npm install): node --test nexusmed/tests/nexusmed-calc.test.js
// Casos conferidos à mão com o relatório de mercado de 19/10/2026 (seções 5.4 e 5.6).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../nexusmed-calc.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} esperado ${b}, obtido ${a}`);
const base = { N: 16, D: 20, T: 30, tIn: 7, tOut: 0, V: 300 };

test('consulta — tabela do relatório (r 10/20/30% com φ 25/50/75%)', () => {
  const casos = [
    { r: 0.10, phi: 0.25, delta: 0.7, horas: 3.7, dn: 7.6, pagas: 1.9, ganho: 573, pct: 0.6 },
    { r: 0.20, phi: 0.50, delta: 1.4, horas: 7.5, dn: 15.7, pagas: 7.8, ganho: 2349, pct: 2.4 },
    { r: 0.30, phi: 0.75, delta: 2.1, horas: 11.2, dn: 24.1, pagas: 18.1, ganho: 5419, pct: 5.6 }
  ];
  for (const k of casos) {
    const c = C.cenarioConsulta({ ...base, phi: k.phi }, { id: 'x', r: k.r, rFora: 0 });
    close(c.delta, k.delta, 1e-9, 'Δ');
    close(c.horasDevolvidas, k.horas, 0.05, 'horas');
    close(c.deltaNTeorico, k.dn, 0.05, 'ΔN');
    close(c.consultasPagas, k.pagas, 0.05, 'pagas');
    close(c.ganhoFaturamento / 100, k.ganho, 1, 'ganho R$');
    close(c.pctFaturamento * 100, k.pct, 0.05, 'Δ%');
    assert.equal(c.faturamentoAtual, 9600000); // R$ 96.000
    assert.equal(c.foraObservado, false);
  }
});

test('consulta — Δ% = φ·Δ/(T−Δ): N, D e V se cancelam', () => {
  const a = C.cenarioConsulta({ ...base, phi: 0.5 }, { r: 0.2, rFora: 0 });
  const b = C.cenarioConsulta({ ...base, N: 40, D: 8, V: 1234.56, phi: 0.5 }, { r: 0.2, rFora: 0 });
  close(a.pctFaturamento, b.pctFaturamento, 1e-12);
  close(a.pctFaturamento, 0.5 * 1.4 / 28.6, 1e-12);
});

test('consulta — sanidade: Δ = 5 min, φ = 100% → +20% e aviso "fora do observado"', () => {
  const c = C.cenarioConsulta({ ...base, tIn: 25, phi: 1 }, { r: 0.2, rFora: 0 }); // Δ = 25 × 0,2 = 5
  close(c.delta, 5, 1e-9);
  close(c.pctFaturamento, 0.20, 1e-12);
  close(c.deltaNTeorico, 64, 1e-9);
  assert.equal(c.ganhoFaturamento, 1920000); // R$ 19.200
  assert.equal(c.foraObservado, true);
});

test('consulta — cenários padrão e tempo fora do expediente só em qualidade de vida', () => {
  const r = C.simularConsulta({ ...base, tOut: 3, phi: 0.5 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.cenarios.map((c) => c.r), [0.10, 0.20, 0.30]);
  assert.deepEqual(r.cenarios.map((c) => c.rFora), [0.10, 0.15, 0.20]);
  assert.equal(r.cenarios.find((c) => c.padrao).id, 'moderado');
  assert.equal(r.cenarios.find((c) => c.acimaDoMedido).id, 'otimista');
  const sem = C.simularConsulta({ ...base, tOut: 0, phi: 0.5 }).cenarios[1];
  const com = r.cenarios[1];
  assert.equal(com.ganhoFaturamento, sem.ganhoFaturamento, 'fora do expediente não mexe no faturamento');
  close(com.pctFaturamento, sem.pctFaturamento, 1e-12);
  close(com.horasFora, 320 * 3 * 0.15 / 60, 1e-9);
  close(com.horasDevolvidas, sem.horasDevolvidas + com.horasFora, 1e-9);
});

test('consulta — φ = 0 ("agenda com horários vagos"): zero de faturamento, horas continuam', () => {
  const c = C.simularConsulta({ ...base, phi: 0 }).cenarios[1];
  assert.equal(c.ganhoFaturamento, 0);
  assert.equal(c.pctFaturamento, 0);
  close(c.horasDevolvidas, 7.4667, 0.001);
});

test('consulta — valor do tempo é alternativo e o motor nunca soma com faturamento', () => {
  const c = C.simularConsulta({ ...base, phi: 0.5 }).cenarios[1];
  close(c.valorHora, 300 * 60 / 30, 1e-9); // padrão derivado: R$ 600/h
  assert.equal(c.valorTempo, Math.round(c.horasDevolvidas * 60000));
  const chaves = Object.keys(c).join(',');
  assert.ok(!/total|soma|combinad/i.test(chaves), 'não deve existir campo de soma: ' + chaves);
  const c2 = C.simularConsulta({ ...base, phi: 0.5, valorHora: 250 }).cenarios[1];
  assert.equal(c2.valorTempo, Math.round(c2.horasDevolvidas * 25000));
  assert.equal(c2.ganhoFaturamento, c.ganhoFaturamento, 'mudar o valor da hora não altera o faturamento');
});

test('laudista — L=25, D=20, v=40, r=15%, φ=50% → +8,8%, R$ 1.765', () => {
  const c = C.cenarioLaudo({ modalidade: 'rx-torax', L: 25, D: 20, t: 6, pagamento: 'producao', v: 40, phi: 0.5 }, { id: 'x', r: 0.15 });
  close(c.deltaLTeorico, 88.2, 0.05);
  close(c.laudosPagos, 44.1, 0.05);
  assert.equal(c.faturamentoAtual, 2000000); // R$ 20.000
  close(c.ganhoFaturamento / 100, 1765, 1);
  close(c.pctFaturamento * 100, 8.8, 0.05);
});

test('laudista — r=5%, φ=25% → +1,3%', () => {
  const c = C.cenarioLaudo({ modalidade: 'rx-torax', L: 25, D: 20, t: 6, pagamento: 'producao', v: 40, phi: 0.25 }, { r: 0.05 });
  close(c.pctFaturamento * 100, 1.3, 0.05);
  close(c.pctFaturamento, 0.25 * 0.05 / 0.95, 1e-12);
});

test('laudista — cenários com teto de 15% e modalidade sem estudo só no conservador', () => {
  const rx = C.simularLaudo({ modalidade: 'rx-torax', L: 25, D: 20, t: 6, pagamento: 'producao', v: 40, phi: 0.5 });
  assert.deepEqual(rx.cenarios.map((c) => c.r), [0.05, 0.10, 0.15]);
  assert.ok(Math.max(...C.CENARIOS_LAUDO.map((c) => c.r)) <= 0.15);
  assert.equal(rx.semEstudo, false);
  const us = C.simularLaudo({ modalidade: 'us-abdome', L: 25, D: 20, t: 6, pagamento: 'producao', v: 40, phi: 0.5 });
  assert.equal(us.semEstudo, true);
  assert.deepEqual(us.cenarios.map((c) => c.id), ['conservador']);
});

test('laudista — plantão fixo não gera aumento de renda; mostra horas e R$/hora equivalente', () => {
  const r = C.simularLaudo({ modalidade: 'rx-torax', L: 25, D: 20, t: 6, pagamento: 'plantao', horasPlantao: 6, valorPlantao: 1200 });
  assert.equal(r.ok, true);
  for (const c of r.cenarios) {
    assert.equal(c.aumentaRenda, false);
    assert.equal(c.ganhoFaturamento, 0);
    assert.equal(c.pctFaturamento, 0);
  }
  const m = r.cenarios[1]; // 10%
  close(m.horasLiberadasPorPlantao, 0.6, 1e-9);
  assert.equal(m.valorHoraEquivalente, Math.round(120000 / (6 * 0.9))); // R$ 222,22
});

test('laudista — misto mostra só horas (sem aumento de renda calculado)', () => {
  const r = C.simularLaudo({ modalidade: 'rx-torax', L: 25, D: 20, t: 6, pagamento: 'misto' });
  assert.equal(r.ok, true);
  assert.ok(r.cenarios.every((c) => c.ganhoFaturamento === 0 && c.aumentaRenda === false));
  close(r.cenarios[1].horasDevolvidas, 500 * 6 * 0.10 / 60, 1e-9);
});

test('laudista — referência de segurança por modalidade (teto por turno de 6 h, Bretas et al.)', () => {
  // radiografia: teto 50; o exemplo padrão (25/dia) não alerta em nenhum cenário
  const padrao = C.simularLaudo({ modalidade: 'rx-torax', L: 25, D: 20, t: 6, pagamento: 'producao', v: 40, phi: 0.5 });
  assert.ok(padrao.cenarios.every((c) => c.acimaReferenciaSeguranca === false && c.ritmoAtualAcimaReferencia === false));
  // ultrassom: teto 30; 28/dia + 15% com fila → 28 + 28·0,15/0,85·0,75 ≈ 31,7 > 30 → alerta
  const us = C.cenarioLaudo({ modalidade: 'us-abdome', L: 28, D: 20, t: 10, pagamento: 'producao', v: 40, phi: 0.75 }, { r: 0.15 });
  assert.equal(us.refTurno6h, 30);
  assert.equal(us.acimaReferenciaSeguranca, true);
  // sem fila (φ = 0): o ritmo não muda, não há alerta do cenário
  const semFila = C.cenarioLaudo({ modalidade: 'us-abdome', L: 28, D: 20, t: 10, pagamento: 'producao', v: 40, phi: 0 }, { r: 0.15 });
  assert.equal(semFila.acimaReferenciaSeguranca, false);
  // ritmo atual já acima do teto: sinal separado, não atribuído ao cenário
  const jaAcima = C.cenarioLaudo({ modalidade: 'us-abdome', L: 35, D: 20, t: 8, pagamento: 'producao', v: 40, phi: 0.5 }, { r: 0.05 });
  assert.equal(jaAcima.ritmoAtualAcimaReferencia, true);
  assert.equal(jaAcima.acimaReferenciaSeguranca, false);
  // modalidade sem faixa no estudo: sem referência numérica
  const ecg = C.cenarioLaudo({ modalidade: 'ecg', L: 200, D: 20, t: 1, pagamento: 'producao', v: 10, phi: 0.75 }, { r: 0.05 });
  assert.equal(ecg.refTurno6h, null);
  assert.equal(ecg.acimaReferenciaSeguranca, false);
});

test('entradas inválidas: zero, negativo, NaN, t_in ≥ T, φ fora de 0–1', () => {
  const ruins = [
    [{ ...base, N: 0, phi: 0.5 }, 'N'], [{ ...base, N: -3, phi: 0.5 }, 'N'], [{ ...base, N: NaN, phi: 0.5 }, 'N'],
    [{ ...base, D: 0, phi: 0.5 }, 'D'], [{ ...base, T: 0, phi: 0.5 }, 'T'], [{ ...base, tIn: 0, phi: 0.5 }, 'tIn'],
    [{ ...base, tIn: 30, phi: 0.5 }, 'tIn'], [{ ...base, tIn: 45, phi: 0.5 }, 'tIn'], [{ ...base, V: 0, phi: 0.5 }, 'V'],
    [{ ...base, V: -10, phi: 0.5 }, 'V'], [{ ...base, phi: 1.5 }, 'phi'], [{ ...base, phi: -0.1 }, 'phi'],
    [{ ...base, tOut: -1, phi: 0.5 }, 'tOut'], [{ ...base, phi: 0.5, valorHora: -5 }, 'valorHora']
  ];
  for (const [e, campo] of ruins) {
    const r = C.simularConsulta(e);
    assert.equal(r.ok, false, JSON.stringify(e));
    assert.ok(r.erros.some((x) => x.campo === campo), 'esperava erro em ' + campo);
    assert.ok(r.erros.every((x) => x.mensagem.length > 10));
  }
  const l = { modalidade: 'rx-torax', L: 25, D: 20, t: 6, pagamento: 'producao', v: 40, phi: 0.5 };
  const ruinsL = [
    [{ ...l, L: 0 }, 'L'], [{ ...l, t: -1 }, 't'], [{ ...l, v: 0 }, 'v'], [{ ...l, phi: 2 }, 'phi'],
    [{ ...l, modalidade: 'xyz' }, 'modalidade'], [{ ...l, pagamento: 'outro' }, 'pagamento'],
    [{ ...l, pagamento: 'plantao', horasPlantao: 0, valorPlantao: 1000 }, 'horasPlantao'],
    [{ ...l, pagamento: 'plantao', horasPlantao: 6, valorPlantao: NaN }, 'valorPlantao']
  ];
  for (const [e, campo] of ruinsL) {
    const r = C.simularLaudo(e);
    assert.equal(r.ok, false, JSON.stringify(e));
    assert.ok(r.erros.some((x) => x.campo === campo), 'esperava erro em ' + campo);
  }
  // r fora de 0–1 não divide por zero
  const r1 = C.cenarioLaudo(l, { r: 1 });
  assert.equal(r1.invalido, true);
  const cr = C.cenarioConsulta({ ...base, phi: 0.5 }, { r: 5, rFora: 0 }); // Δ = 35 > T
  assert.equal(cr.invalido, true);
});

test('dinheiro em centavos inteiros e formatação pt-BR', () => {
  const r = C.simularConsulta({ ...base, V: 287.35, phi: 0.5, tOut: 2.5 });
  for (const c of r.cenarios) {
    assert.ok(Number.isInteger(c.ganhoFaturamento) && Number.isInteger(c.faturamentoAtual) && Number.isInteger(c.valorTempo));
  }
  assert.equal(C.toCents(0.1 + 0.2), 30);
  assert.equal(C.brl(234900), 'R$ 2.349');
  assert.equal(C.brl(9600000), 'R$ 96.000');
  assert.equal(C.pct(0.0245), '2,5%');
  assert.equal(C.duracao(7.4667), '7 h 28 min');
  assert.equal(C.duracao(0.75), '45 min');
  assert.equal(C.duracao(2), '2 h');
  assert.equal(C.duracao(1234.5), '1.234 h 30 min');
});
