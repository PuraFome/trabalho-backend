const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { gerarModeloXlsx, gerarXlsxSimples, lerXlsx, criarZip } = require('../../utils/xlsx');
const {
  MODELO_CABECALHO,
  MODELO_EXEMPLO,
  normalizarNome,
  validarLinhas
} = require('../../utils/importacaoLancamentos');

function montarMapas(categorias, fontes) {
  const categoriasPorNome = new Map();
  for (const categoria of categorias) {
    const chave = normalizarNome(categoria.nome);
    if (!categoriasPorNome.has(chave)) {
      categoriasPorNome.set(chave, []);
    }
    categoriasPorNome.get(chave).push(categoria);
  }
  const fontesPorNome = new Map();
  for (const fonte of fontes) {
    fontesPorNome.set(normalizarNome(fonte.nome), fonte);
  }
  return { categoriasPorNome, fontesPorNome };
}

describe('utils/xlsx.js - gerarModeloXlsx', () => {
  test('gera um ZIP (magic PK) com validação de dados', () => {
    const buf = gerarModeloXlsx({
      categorias: [{ nome: 'Mercado' }, { nome: 'Salário' }],
      fontes: [{ nome: 'Cartão Nubank' }]
    });
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.subarray(0, 2).toString(), 'PK');
    const texto = buf.toString('latin1');
    assert.ok(texto.includes('dataValidation'));
    assert.ok(texto.includes('type="date"'));
    assert.ok(texto.includes('name="Categorias"'));
    assert.ok(texto.includes('name="Fontes"'));
  });

  test('sem categorias/fontes mantém apenas a validação de data', () => {
    const buf = gerarModeloXlsx({ categorias: [], fontes: [] });
    const texto = buf.toString('latin1');
    assert.ok(texto.includes('type="date"'));
    assert.ok(!texto.includes('name="Categorias"'));
    assert.ok(!texto.includes('name="Fontes"'));
  });

  test('célula com formato de data (número de série) vira AAAA-MM-DD', () => {
    const styles =
      '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>' +
      '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>';
    const sheet =
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" s="1"><v>45292</v></c></row>' +
      '</sheetData></worksheet>';
    const buf = criarZip([
      { name: 'xl/styles.xml', data: Buffer.from(styles, 'utf8') },
      { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') }
    ]);
    assert.equal(lerXlsx(buf)[0][0], '2024-01-01');
  });
});

describe('utils/xlsx.js - gerarXlsxSimples', () => {
  test('cabeçalho + linhas; data vira serial e número permanece numérico', () => {
    const buf = gerarXlsxSimples({
      nomeAba: 'Lançamentos',
      cabecalho: ['Data', 'Descrição', 'Valor'],
      linhas: [
        ['2026-11-20', 'Padaria', 25.5],
        ['2026-11-21', 'Uber', 30]
      ],
      tipos: { 0: 'data', 2: 'numero' }
    });
    assert.equal(buf.subarray(0, 2).toString(), 'PK');
    const linhas = lerXlsx(buf);
    assert.deepEqual(linhas[0], ['Data', 'Descrição', 'Valor']);
    assert.deepEqual(linhas[1], ['2026-11-20', 'Padaria', '25.5']);
    assert.deepEqual(linhas[2], ['2026-11-21', 'Uber', '30']);
  });

  test('escapa caracteres especiais e mantém célula vazia', () => {
    const buf = gerarXlsxSimples({
      cabecalho: ['A', 'B'],
      linhas: [['x & y', '']]
    });
    assert.deepEqual(lerXlsx(buf)[1], ['x & y', '']);
  });
});

describe('utils/xlsx.js - lerXlsx', () => {
  test('lê cabeçalho e linha de exemplo do modelo gerado', () => {
    const buf = gerarModeloXlsx({
      categorias: [{ nome: 'Mercado' }],
      fontes: [{ nome: 'Cartão Nubank' }]
    });
    const linhas = lerXlsx(buf);
    assert.deepEqual(linhas[0], MODELO_CABECALHO);
    assert.deepEqual(linhas[1], MODELO_EXEMPLO);
  });

  test('lê inline string e célula numérica', () => {
    const sheet =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Data</t></is></c><c r="B1" t="inlineStr"><is><t>Descrição</t></is></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>2026-11-20</t></is></c><c r="B2"><v>42.5</v></c></row>' +
      '</sheetData></worksheet>';
    const buf = criarZip([{ name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') }]);
    const linhas = lerXlsx(buf);
    assert.deepEqual(linhas[0], ['Data', 'Descrição']);
    assert.deepEqual(linhas[1], ['2026-11-20', '42.5']);
  });

  test('lê strings compartilhadas (sharedStrings)', () => {
    const ss =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">' +
      '<si><t>Ola</t></si><si><t>Mundo</t></si></sst>';
    const sheet =
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '</sheetData></worksheet>';
    const buf = criarZip([
      { name: 'xl/sharedStrings.xml', data: Buffer.from(ss, 'utf8') },
      { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') }
    ]);
    const linhas = lerXlsx(buf);
    assert.deepEqual(linhas[0], ['Ola', 'Mundo']);
  });

  test('decodifica entidades XML', () => {
    const sheet =
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>a &amp; b &lt;c&gt;</t></is></c></row>' +
      '</sheetData></worksheet>';
    const buf = criarZip([{ name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') }]);
    assert.deepEqual(lerXlsx(buf)[0], ['a & b <c>']);
  });

  test('modelo lido + validarLinhas ignora cabeçalho e exemplo', () => {
    const buf = gerarModeloXlsx({
      categorias: [{ nome: 'Mercado' }],
      fontes: [{ nome: 'Cartão Nubank' }]
    });
    const linhas = lerXlsx(buf);
    const mapas = montarMapas(
      [{ id: 2, nome: 'Mercado', tipo: 'saida' }],
      [{ id: 10, nome: 'Cartão Nubank', tipo: 'cartao_credito' }]
    );
    const { erros, validos } = validarLinhas(linhas, mapas);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 0);
  });
});
