// Testes da importação de escala em grade (.xlsx) e do cálculo por horas do dia.
// Rodar (sem npm install): node --test orbit/tests/
// Dados sintéticos: nenhum nome ou escala real de estabelecimento.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const C = require('../orbit-calc.js');
const X = require('../orbit-xlsx.js');

// Semana de 07 a 13/09/2026. T1 = 7,5h (pausa de 30 min); T2 = 7,5h e passa da meia-noite.
const CAB = ['Nome', 'Segunda 07-09-2026', 'Terça 08-09-2026', 'Quarta 09-09-2026', 'Quinta 10-09-2026', 'Sexta 11-09-2026', 'Sábado 12-09-2026', 'Domingo 13-09-2026', 'CONTAGEM'];
const T1 = '08:00 - 10:00 /     10:30 - 16:00';
const T2 = '16:00 - 18:00 / 18:30 - 00:00';
const AFAST = 'AUXILIO DOENÇA';
const grade = () => [{ nome: 'escala', linhas: [
  ['Cozinha'], CAB,
  ['Ana', T1, T1, 'Folga', T1, T1, T1, 'Folga C', 1],
  ['Beto', T1, 'Folga', T1, T1, T1, 'Folga', T1, 2],
  ['Carla', AFAST, AFAST, AFAST, AFAST, AFAST, AFAST, AFAST, 0],
  [],
  ['Salão'], CAB,
  ['Davi', T2, T2, T2, 'Folga', T2, T2, T2, 3],
  ['Eva', '10:00 - 10:00 / 10:30 - 16:00', T2, T2, T2, 'Folga', T2, 'Folga', 4]
] }];

test('importar grade: equipes, pessoas, horas e pico por dia', () => {
  const r = C.importarGrade(grade());
  assert.equal(r.ok, true);
  assert.deepEqual(r.funcoes.map((f) => [f.nome, f.hoje]), [['Cozinha', 2], ['Salão', 2]]); // a pessoa afastada não conta
  const coz = r.funcoes[0].escala.dias;
  assert.equal(coz[0].pessoas, 2); assert.equal(coz[0].horas, 15); assert.equal(coz[0].pico, 2);
  assert.equal(coz[2].pessoas, 1);   // quarta: uma folga
  assert.equal(coz[6].pessoas, 1);   // domingo
  const sal = r.funcoes[1].escala.dias;
  assert.equal(sal[1].horas, 15);    // 7,5 + 7,5: a pausa não conta
  assert.equal(sal[0].horas, 7.5 + 5.5); // 10:00-10:00 é descartado; sobra 10:30-16:00 = 5,5h
  assert.equal(r.resumo.anomalias, 1);
  assert.equal(r.resumo.semanas, 1);
  assert.equal(r.resumo.pessoas, 4);
  assert.equal(r.resumo.horas, 155.5);
});

test('importar grade: o turno que passa da meia-noite fica no dia em que começou', () => {
  const sal = C.importarGrade(grade()).funcoes[1].escala.dias[0];
  assert.equal(sal.fim, 24);
  assert.ok(sal.faixas.some((f) => f.fim === 24));
});

test('importar grade: planilha sem horários dá erro claro', () => {
  const r = C.importarGrade([{ nome: 'x', linhas: [['Nome', 'Seg', 'Ter', 'Qua'], ['Ana', 'Folga', 'Folga', 'Folga']] }]);
  assert.equal(r.ok, false);
  assert.match(r.erro, /horários/);
});

test('importar grade: duas semanas viram a média por dia da semana', () => {
  const sem = (d0, pessoas) => [['Nome', ...[0, 1, 2].map((i) => `${d0 + i}-09-2026`)], ...pessoas];
  const linhas = [
    ['Caixa'], ...sem(7, [['Ana', '08:00 - 12:00', '08:00 - 12:00', '08:00 - 12:00'], ['Beto', '08:00 - 12:00', 'Folga', 'Folga']]),
    ['Caixa'], ...sem(14, [['Ana', '08:00 - 12:00', '08:00 - 12:00', '08:00 - 12:00'], ['Beto', 'Folga', 'Folga', 'Folga']])
  ];
  const r = C.importarGrade([{ nome: 's', linhas }]);
  assert.equal(r.ok, true);
  assert.equal(r.resumo.semanas, 2);
  assert.equal(r.funcoes.length, 1);
  assert.equal(r.funcoes[0].hoje, 2);
  assert.equal(r.funcoes[0].escala.dias[0].pessoas, 2); // (2 + 1) ÷ 2 = 1,5 → 2
  assert.equal(r.funcoes[0].escala.dias[0].horas, 6);   // (8 + 4) ÷ 2
});

const entradaGrade = (rf) => ({
  regimeAtual: '6x1', jornadaAtual: 44, regimeFuturo: rf, etapa: 40, intervalo: 0.5, base: 'variacao',
  funcoes: C.importarGrade(grade()).funcoes.map((f) => ({ nome: f.nome, hoje: f.hoje, salario: 2000, escala: f.escala })),
  encargosPct: 50, beneficiosModo: 'total', beneficios: 0, mesInicio: 1
});

test('simular com escala: turnos do dia = teto(horas ÷ horas do turno), nunca abaixo do pico', () => {
  const r = C.simularFuncoes(entradaGrade('5x2'));
  assert.equal(r.ok, true);
  const hoje = r.cenarios[0].funcoes[0].demanda;          // 6x1 de 44h: turno de 7,33h
  assert.deepEqual([hoje.porDia[0], hoje.porDia[3]], [3, 3]); // 15h ÷ 7,33 = 2,05 → 3
  const novo = r.alvo.funcoes[0].demanda;                 // 5x2 de 40h: turno de 8h
  assert.deepEqual([novo.porDia[0], novo.porDia[3]], [2, 2]); // 15h ÷ 8 = 1,9 → 2
  assert.equal(r.pessoasHoraSemana, 155.5);
});

test('simular com escala: 12x36 nunca pede menos que o regime de hoje', () => {
  const r = C.simularFuncoes(entradaGrade('12x36'));
  assert.equal(r.ok, true);
  assert.equal(r.alvo.rigido, true);
  assert.ok(r.alvo.referencia >= r.cenarios[0].referencia);
});

test('simular com escala: sem salário não há custo; com salário há', () => {
  const e = entradaGrade('5x2');
  e.funcoes.forEach((f) => { f.salario = 0; });
  assert.equal(C.simularFuncoes(e).temCusto, false);
  assert.equal(C.simularFuncoes(entradaGrade('5x2')).temCusto, true);
});

test('simular com escala: escala sem nenhum dia trabalhado é recusada', () => {
  const e = entradaGrade('5x2');
  e.funcoes[0].escala = { dias: Array.from({ length: 7 }, () => ({ pessoas: 0, horas: 0, pico: 0, faixas: [] })) };
  assert.equal(C.simularFuncoes(e).ok, false);
});

/* ---------- Leitor de .xlsx ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(arquivos, deflate) {
  const partes = [], central = [];
  let pos = 0;
  Object.keys(arquivos).forEach((nome) => {
    const dado = Buffer.from(arquivos[nome], 'utf8'), comp = deflate ? zlib.deflateRawSync(dado) : dado, nb = Buffer.from(nome);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(deflate ? 8 : 0, 8);
    h.writeUInt32LE(crc32(dado), 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(dado.length, 22); h.writeUInt16LE(nb.length, 26);
    partes.push(h, nb, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(deflate ? 8 : 0, 10);
    c.writeUInt32LE(crc32(dado), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(dado.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(pos, 42);
    central.push(c, nb);
    pos += 30 + nb.length + comp.length;
  });
  const cd = Buffer.concat(central), fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(central.length / 2, 8); fim.writeUInt16LE(central.length / 2, 10);
  fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(pos, 16);
  return new Uint8Array(Buffer.concat([...partes, cd, fim]));
}
const XLSX = {
  'xl/workbook.xml': '<workbook xmlns:r="x"><sheets><sheet name="escala &amp; teste" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="t" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>Cozinha</t></si><si><t>Nome</t></si><si><r><t>Segunda </t></r><r><t>07-09-2026</t></r></si><si><t>Ter&#231;a 08-09-2026</t></si><si><t>Quarta 09-09-2026</t></si><si><t>Ana</t></si><si><t>08:00 - 16:00</t></si><si><t>Folga</t></si></sst>',
  'xl/worksheets/sheet1.xml': '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c><c r="C2" t="s"><v>3</v></c><c r="D2" t="s"><v>4</v></c><c r="E2" s="3"/></row>' +
    '<row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3" t="s"><v>6</v></c><c r="C3" t="inlineStr"><is><t>09:00 - 13:00</t></is></c><c r="D3" t="s"><v>7</v></c><c r="F3"><v>42</v></c></row>' +
    '</sheetData></worksheet>'
};

for (const deflate of [false, true]) {
  test(`ler xlsx (${deflate ? 'compactado' : 'sem compressão'}): textos compartilhados, inline e células vazias`, async () => {
    const pl = await X.lerXlsx(zip(XLSX, deflate));
    assert.equal(pl.length, 1);
    assert.equal(pl[0].nome, 'escala & teste');
    assert.equal(pl[0].linhas[0][0], 'Cozinha');
    assert.equal(pl[0].linhas[1][1], 'Segunda 07-09-2026');
    assert.equal(pl[0].linhas[1][2], 'Terça 08-09-2026');
    assert.equal(pl[0].linhas[2][2], '09:00 - 13:00');
    assert.equal(pl[0].linhas[2][5], 42);
    const g = C.importarGrade(pl);
    assert.equal(g.ok, true);
    assert.equal(g.funcoes[0].escala.dias[0].horas, 8);
    assert.equal(g.funcoes[0].escala.dias[1].horas, 4);
  });
}

test('ler xlsx: arquivo que não é xlsx é recusado', async () => {
  await assert.rejects(X.lerXlsx(new Uint8Array([1, 2, 3, 4])));
  await assert.rejects(X.lerXlsx(zip({ 'a.txt': 'oi' }, false)), /nao-xlsx/);
});

/* ---------- Exemplo de escala no regime pretendido ---------- */
const comIntervalo = (rf) => Object.assign(entradaGrade(rf), { intervalo: 1, base: 'equipe' });

test('exemplo de escala 5x2: cada dia fecha com os turnos pedidos, folga e 11h entre turnos', () => {
  const e = comIntervalo('5x2'), r = C.simularFuncoes(e);
  const ex = C.gerarEscalaExemplo(e, r);
  assert.equal(ex.length, 2);
  ex.forEach((f, i) => {
    assert.equal(f.pessoas, r.alvo.funcoes[i].referencia);
    assert.deepEqual(f.emTurno, r.alvo.funcoes[i].demanda.porDia);
    assert.equal(f.semCobertura, 0);
    assert.equal(f.interjornada, 0);
    f.linhas.forEach((l) => { assert.ok(l.turnos <= 5); assert.ok(l.dias.some((d) => d === null)); }); // 5 dias no máximo, com folga
  });
  const turno = ex[0].linhas.find((l) => l.turnos > 0).dias.find((d) => d);
  assert.equal(turno.fim - turno.ini, 9); // 8h de trabalho + 1h de intervalo
});

test('exemplo de escala 12x36: mesmo número em turno nos dias abertos, nunca em dias seguidos', () => {
  const e = comIntervalo('12x36'), r = C.simularFuncoes(e);
  const ex = C.gerarEscalaExemplo(e, r);
  ex.forEach((f, i) => {
    const P = r.alvo.funcoes[i].demanda.pico;
    f.emTurno.forEach((n, d) => assert.equal(n, r.alvo.funcoes[i].demanda.porDia[d] > 0 ? P : 0));
    f.linhas.forEach((l) => { for (let d = 0; d < 6; d++) assert.ok(!(l.dias[d] && l.dias[d + 1])); });
    assert.equal(f.semCobertura, 0);
  });
});

test('exemplo de escala: contratações contam contra a equipe informada', () => {
  const e = comIntervalo('5x2'), r = C.simularFuncoes(e);
  assert.equal(r.base, 'equipe');
  r.alvo.funcoes.forEach((f) => assert.equal(f.contratacoes, Math.max(0, f.referencia - f.hoje)));
});
