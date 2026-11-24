const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv } = require('../../utils/csv');
const {
  MODELO_CABECALHO,
  MODELO_EXEMPLO,
  normalizarNome,
  gerarModelo,
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

const CATEGORIA_MERCADO = { id: 2, nome: 'Mercado', tipo: 'saida' };
const CATEGORIA_SALARIO = { id: 1, nome: 'Salário', tipo: 'entrada' };
const FONTE_CARTAO = { id: 10, nome: 'Cartão Nubank', tipo: 'cartao_credito' };
const FONTE_CONTA = { id: 11, nome: 'Conta Corrente', tipo: 'conta' };

const MAPAS_BASE = montarMapas(
  [CATEGORIA_MERCADO, CATEGORIA_SALARIO],
  [FONTE_CARTAO, FONTE_CONTA]
);

describe('utils/csv.js - parseCsv', () => {
  test('linhas simples separadas por vírgula', () => {
    assert.deepEqual(parseCsv('a,b,c\nd,e,f'), [['a', 'b', 'c'], ['d', 'e', 'f']]);
  });

  test('campo entre aspas contendo vírgula', () => {
    assert.deepEqual(parseCsv('"a,b",c'), [['a,b', 'c']]);
  });

  test('aspas escapadas com ""', () => {
    assert.deepEqual(parseCsv('"a""b",c'), [['a"b', 'c']]);
  });

  test('quebra CRLF', () => {
    assert.deepEqual(parseCsv('a,b\r\nc,d'), [['a', 'b'], ['c', 'd']]);
  });

  test('quebra CR isolada', () => {
    assert.deepEqual(parseCsv('a,b\rc,d'), [['a', 'b'], ['c', 'd']]);
  });

  test('remove BOM inicial', () => {
    assert.deepEqual(parseCsv('\uFEFFa,b'), [['a', 'b']]);
  });

  test('quebra de linha final não cria linha vazia', () => {
    assert.deepEqual(parseCsv('a,b\n'), [['a', 'b']]);
  });

  test('nova linha dentro de aspas é literal', () => {
    assert.deepEqual(parseCsv('"a\nb",c'), [['a\nb', 'c']]);
  });

  test('campos vazios são preservados', () => {
    assert.deepEqual(parseCsv('a,,c'), [['a', '', 'c']]);
  });

  test('entrada não-string retorna []', () => {
    assert.deepEqual(parseCsv(null), []);
    assert.deepEqual(parseCsv(undefined), []);
    assert.deepEqual(parseCsv(42), []);
  });

  test('string vazia retorna []', () => {
    assert.deepEqual(parseCsv(''), []);
  });
});

describe('utils/importacaoLancamentos.js - gerarModelo', () => {
  test('cabeçalho e linha de exemplo', () => {
    const linhas = gerarModelo().split('\n');
    assert.equal(linhas[0], MODELO_CABECALHO.join(','));
    assert.equal(linhas[1], MODELO_EXEMPLO.join(','));
    assert.equal(linhas[2], '');
  });

  test('cabeçalho tem as 6 colunas obrigatórias', () => {
    assert.deepEqual(MODELO_CABECALHO, [
      'Data',
      'Descrição',
      'Categoria',
      'Fonte/Destino',
      'Parcela',
      'Valor'
    ]);
  });
});

describe('utils/importacaoLancamentos.js - validarLinhas', () => {
  test('arquivo válido: ignora cabeçalho e exemplo, aceita a linha de dados', () => {
    const linhas = [
      MODELO_CABECALHO,
      MODELO_EXEMPLO,
      ['2026-11-20', 'Padaria', 'Mercado', 'Cartão Nubank', '1', '25.50']
    ];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 1);
    assert.deepEqual(validos[0], {
      linha: 3,
      tipo: 'saida',
      descricao: 'Padaria',
      valor: 25.5,
      data: '2026-11-20',
      categoriaId: 2,
      categoriaNome: 'Mercado',
      fonteDestinoId: 10,
      fonteNome: 'Cartão Nubank',
      parcelas: 1
    });
  });

  test('detecta cabeçalho sem diferenciar maiúsculas/acentos', () => {
    const linhas = [['data', 'DESCRICAO', 'categoria', 'fonte/destino', 'parcela', 'valor']];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 0);
  });

  test('ignora linhas totalmente vazias', () => {
    const linhas = [['', '', '', '', '', ''], ['   ', '', '', '', '', '']];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 0);
  });

  test('data inválida → erro na coluna Data', () => {
    const linhas = [['15/11/2026', 'Padaria', 'Mercado', 'Cartão Nubank', '1', '25.50']];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(validos.length, 0);
    assert.equal(erros.length, 1);
    assert.equal(erros[0].coluna, 'Data');
    assert.equal(erros[0].linha, 1);
  });

  test('valor com vírgula decimal → erro na coluna Valor', () => {
    const linhas = [['2026-11-20', 'Padaria', 'Mercado', 'Cartão Nubank', '1', '25,50']];
    const { erros } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 1);
    assert.equal(erros[0].coluna, 'Valor');
  });

  test('valor zero → erro na coluna Valor', () => {
    const linhas = [['2026-11-20', 'Padaria', 'Mercado', 'Cartão Nubank', '1', '0']];
    const { erros } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 1);
    assert.equal(erros[0].coluna, 'Valor');
  });

  test('categoria inexistente → fica pendente de criação (sem erro)', () => {
    const linhas = [['2026-11-20', 'Padaria', 'Inexistente', 'Cartão Nubank', '1', '25.50']];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 1);
    assert.equal(validos[0].categoriaId, null);
    assert.equal(validos[0].categoriaNome, 'Inexistente');
    assert.equal(validos[0].tipo, 'saida');
  });

  test('categoria ambígua sem coluna Tipo → erro na coluna Categoria', () => {
    const mapas = montarMapas(
      [{ id: 1, nome: 'Algo', tipo: 'entrada' }, { id: 2, nome: 'Algo', tipo: 'saida' }],
      [FONTE_CONTA]
    );
    const linhas = [['2026-11-20', 'X', 'Algo', 'Conta Corrente', '1', '25.50']];
    const { erros } = validarLinhas(linhas, mapas);
    assert.equal(erros.length, 1);
    assert.equal(erros[0].coluna, 'Categoria');
  });

  test('categoria ambígua com coluna Tipo → desambigua', () => {
    const mapas = montarMapas(
      [{ id: 1, nome: 'Algo', tipo: 'entrada' }, { id: 2, nome: 'Algo', tipo: 'saida' }],
      [FONTE_CONTA]
    );
    const linhas = [
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Fonte/Destino', 'Parcela', 'Valor'],
      ['2026-11-20', 'Entrada', 'X', 'Algo', 'Conta Corrente', '1', '25.50']
    ];
    const { erros, validos } = validarLinhas(linhas, mapas);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 1);
    assert.equal(validos[0].tipo, 'entrada');
    assert.equal(validos[0].categoriaId, 1);
  });

  test('fonte inexistente → fica pendente de criação (sem erro)', () => {
    const linhas = [['2026-11-20', 'Padaria', 'Mercado', 'Inexistente', '1', '25.50']];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 1);
    assert.equal(validos[0].fonteDestinoId, null);
    assert.equal(validos[0].fonteNome, 'Inexistente');
  });

  test('parcelamento em fonte que não é cartão → erro na coluna Parcela', () => {
    const linhas = [['2026-11-20', 'Curso', 'Mercado', 'Conta Corrente', '3', '300.00']];
    const { erros } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 1);
    assert.equal(erros[0].coluna, 'Parcela');
  });

  test('parcelamento em categoria de entrada → erro na coluna Parcela', () => {
    const linhas = [['2026-11-20', 'Curso', 'Salário', 'Cartão Nubank', '3', '300.00']];
    const { erros } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 1);
    assert.equal(erros[0].coluna, 'Parcela');
  });

  test('parcelamento válido em cartão e saída', () => {
    const linhas = [['2026-11-20', 'Notebook', 'Mercado', 'Cartão Nubank', '10', '3000.00']];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 1);
    assert.equal(validos[0].parcelas, 10);
    assert.equal(validos[0].tipo, 'saida');
  });

  test('linha com colunas faltando → erros nas colunas ausentes', () => {
    const linhas = [['2026-11-20', 'Padaria', 'Mercado']];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(validos.length, 0);
    const colunas = erros.map((e) => e.coluna);
    assert.ok(colunas.includes('Fonte/Destino'));
    assert.ok(colunas.includes('Valor'));
  });

  test('aceita o formato exportado com coluna Tipo (7 colunas)', () => {
    const linhas = [
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Fonte/Destino', 'Parcela', 'Valor'],
      ['2026-11-20', 'Saída', 'Padaria', 'Mercado', 'Cartão Nubank', '', '25.50']
    ];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 1);
    assert.equal(validos[0].tipo, 'saida');
    assert.equal(validos[0].descricao, 'Padaria');
    assert.equal(validos[0].parcelas, 1);
  });

  test('Parcela no formato "k/N" (export) importa como lançamento único', () => {
    const linhas = [
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Fonte/Destino', 'Parcela', 'Valor'],
      ['2026-11-20', 'Saída', 'Notebook', 'Mercado', 'Cartão Nubank', '3/10', '300.00']
    ];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(erros.length, 0);
    assert.equal(validos.length, 1);
    assert.equal(validos[0].parcelas, 1);
  });

  test('cabeçalho sem coluna obrigatória → erro de cabeçalho', () => {
    const linhas = [
      ['Data', 'Descrição', 'Valor'],
      ['2026-11-20', 'Padaria', '25.50']
    ];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(validos.length, 0);
    assert.equal(erros[0].coluna, 'cabeçalho');
  });

  test('acumula múltiplos erros da mesma linha', () => {
    const linhas = [['xx', '', 'Mercado', 'Conta Corrente', '1', '0']];
    const { erros, validos } = validarLinhas(linhas, MAPAS_BASE);
    assert.equal(validos.length, 0);
    assert.ok(erros.length >= 3, `esperava >= 3 erros, obteve ${erros.length}`);
  });
});
