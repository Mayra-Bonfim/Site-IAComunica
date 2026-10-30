/* Orbit — leitor mínimo de planilhas .xlsx (sem dependências).
   Um .xlsx é um zip com XML dentro: aqui lemos o zip, descompactamos só o que interessa
   (planilhas e textos compartilhados) e devolvemos as células como linhas de valores.
   Tudo roda no navegador (DecompressionStream) ou no Node (zlib, para os testes). */
(function (root) {
  'use strict';

  var MAX_ENTRADA = 30 * 1024 * 1024;   // limite do arquivo já descompactado (proteção contra zip malicioso)
  var MAX_LINHAS = 5000;
  var MAX_COLUNAS = 60;

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] * 16777216)) >>> 0; }

  function inflar(bytes, metodo) {
    if (metodo === 0) return Promise.resolve(bytes);
    if (metodo !== 8) return Promise.reject(new Error('compressao'));
    if (typeof DecompressionStream === 'function') {
      var ds = new DecompressionStream('deflate-raw');
      var w = ds.writable.getWriter();
      w.write(bytes); w.close();
      return new Response(ds.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
    }
    if (typeof require === 'function') {
      try { return Promise.resolve(new Uint8Array(require('zlib').inflateRawSync(Buffer.from(bytes)))); }
      catch (e) { return Promise.reject(e); }
    }
    return Promise.reject(new Error('navegador'));
  }

  /** Índice do zip: nome -> { metodo, tam, comp, pos }. */
  function indiceZip(b) {
    if (b.length < 22 || b[0] !== 0x50 || b[1] !== 0x4b) throw new Error('nao-zip');
    var fim = -1, i;
    for (i = b.length - 22; i >= Math.max(0, b.length - 22 - 65557); i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 5 && b[i + 3] === 6) { fim = i; break; }
    }
    if (fim < 0) throw new Error('nao-zip');
    var n = u16(b, fim + 10), pos = u32(b, fim + 16), out = {};
    for (i = 0; i < n; i++) {
      if (u32(b, pos) !== 0x02014b50) throw new Error('nao-zip');
      var flags = u16(b, pos + 8), metodo = u16(b, pos + 10), comp = u32(b, pos + 20), tam = u32(b, pos + 24);
      var nl = u16(b, pos + 28), el = u16(b, pos + 30), cl = u16(b, pos + 32), loc = u32(b, pos + 42);
      var nome = new TextDecoder('utf-8').decode(b.subarray(pos + 46, pos + 46 + nl));
      out[nome] = { metodo: metodo, tam: tam, comp: comp, loc: loc, cifrado: !!(flags & 1) };
      pos += 46 + nl + el + cl;
    }
    return out;
  }

  function lerEntrada(b, idx, nome) {
    var e = idx[nome];
    if (!e) return Promise.resolve(null);
    if (e.cifrado) return Promise.reject(new Error('cifrado'));
    if (e.tam > MAX_ENTRADA) return Promise.reject(new Error('grande'));
    if (u32(b, e.loc) !== 0x04034b50) return Promise.reject(new Error('nao-zip'));
    var ini = e.loc + 30 + u16(b, e.loc + 26) + u16(b, e.loc + 28);
    return inflar(b.subarray(ini, ini + e.comp), e.metodo).then(function (d) {
      return new TextDecoder('utf-8').decode(d);
    });
  }

  function decodificar(s) {
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, function (m, g) {
      if (g === 'amp') return '&'; if (g === 'lt') return '<'; if (g === 'gt') return '>';
      if (g === 'quot') return '"'; if (g === 'apos') return "'";
      var cp = g.charAt(1) === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      try { return String.fromCodePoint(cp); } catch (e) { return ''; }
    });
  }

  function textos(xml) {
    var out = [], re = /<t\b[^>]*>([\s\S]*?)<\/t>/g, m, s = '';
    while ((m = re.exec(xml))) s += decodificar(m[1]);
    out.push(s);
    return out[0];
  }

  function stringsCompartilhadas(xml) {
    if (!xml) return [];
    var out = [], re = /<si\b[^>]*>([\s\S]*?)<\/si>/g, m;
    while ((m = re.exec(xml))) out.push(textos(m[1]));
    return out;
  }

  function colunaDeRef(ref) {
    var m = /^([A-Z]+)/.exec(ref), n = 0, i;
    if (!m) return -1;
    for (i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }

  function linhasDaPlanilha(xml, compartilhadas) {
    var linhas = [], reRow = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, m;
    while ((m = reRow.exec(xml))) {
      if (!m[2]) { continue; }
      var rn = /\br="(\d+)"/.exec(m[1]);
      var idx = rn ? Number(rn[1]) - 1 : linhas.length;
      if (idx >= MAX_LINHAS) break;
      var cel = [], reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c, ult = -1;
      while ((c = reC.exec(m[2]))) {
        var at = c[1], ref = /\br="([A-Z]+\d+)"/.exec(at), col = ref ? colunaDeRef(ref[1]) : ult + 1;
        ult = col;
        if (col < 0 || col >= MAX_COLUNAS || !c[2]) continue;
        var t = /\bt="(\w+)"/.exec(at), tipo = t ? t[1] : 'n', corpo = c[2], v = null, vm;
        if (tipo === 'inlineStr') v = textos(corpo);
        else if ((vm = /<v>([\s\S]*?)<\/v>/.exec(corpo))) {
          var bruto = decodificar(vm[1]);
          if (tipo === 's') v = compartilhadas[Number(bruto)];
          else if (tipo === 'str' || tipo === 'e') v = bruto;
          else if (tipo === 'b') v = bruto === '1';
          else { var nv = Number(bruto); v = isFinite(nv) ? nv : bruto; }
        }
        if (v !== null && v !== undefined && v !== '') cel[col] = v;
      }
      while (linhas.length < idx) linhas.push([]);
      linhas[idx] = cel;
    }
    return linhas;
  }

  /** ArrayBuffer/Uint8Array de um .xlsx -> Promise<[{ nome, linhas: [[valor…]…] }]>. */
  function lerXlsx(buffer) {
    var b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), idx;
    try { idx = indiceZip(b); } catch (e) { return Promise.reject(e); }
    if (!idx['xl/workbook.xml']) return Promise.reject(new Error('nao-xlsx'));
    return Promise.all([
      lerEntrada(b, idx, 'xl/workbook.xml'),
      lerEntrada(b, idx, 'xl/_rels/workbook.xml.rels'),
      lerEntrada(b, idx, 'xl/sharedStrings.xml')
    ]).then(function (r) {
      var wb = r[0], rels = r[1] || '', comp = stringsCompartilhadas(r[2]);
      var alvos = {}, mr, reRel = /<Relationship\b([^>]*?)\/?>/g;
      while ((mr = reRel.exec(rels))) {
        var id = /\bId="([^"]+)"/.exec(mr[1]), tg = /\bTarget="([^"]+)"/.exec(mr[1]);
        if (id && tg) alvos[id[1]] = tg[1].replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/');
      }
      var folhas = [], ms, reSh = /<sheet\b([^>]*?)\/?>/g;
      while ((ms = reSh.exec(wb))) {
        var nm = /\bname="([^"]*)"/.exec(ms[1]), rid = /\br:id="([^"]+)"/.exec(ms[1]);
        if (nm && rid && alvos[rid[1]]) folhas.push({ nome: decodificar(nm[1]), caminho: alvos[rid[1]] });
      }
      if (!folhas.length) throw new Error('nao-xlsx');
      return Promise.all(folhas.map(function (f) {
        return lerEntrada(b, idx, f.caminho).then(function (xml) {
          return { nome: f.nome, linhas: xml ? linhasDaPlanilha(xml, comp) : [] };
        });
      }));
    });
  }

  var api = { lerXlsx: lerXlsx };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbitXlsx = api;
})(typeof self !== 'undefined' ? self : this);
