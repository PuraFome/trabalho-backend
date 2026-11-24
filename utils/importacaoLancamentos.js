const { ehDataValida } = require('./datas');

const MODELO_CABECALHO = ['Data', 'Descrição', 'Categoria', 'Fonte/Destino', 'Parcela', 'Valor'];
const MODELO_EXEMPLO = ['2026-11-15', 'Supermercado', 'Mercado', 'Cartão Nubank', '1', '150.90'];

const MSG_VALOR = 'Valor deve ser número maior que zero (use ponto decimal, ex.: 150.90).';

function normalizarNome(s) {
  return String(s === undefined || s === null ? '' : s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function gerarModelo() {
  return MODELO_CABECALHO.join(',') + '\n' + MODELO_EXEMPLO.join(',') + '\n';
}

const COLUNAS = {
  data: ['data'],
  tipo: ['tipo'],
  descricao: ['descricao'],
  categoria: ['categoria'],
  fonte: ['fonte/destino', 'fonte', 'fonte destino', 'fonte_destino'],
  parcela: ['parcela', 'parcelas'],
  valor: ['valor']
};

function mapearColunas(cabecalho) {
  const mapa = {};
  for (let i = 0; i < cabecalho.length; i++) {
    const norm = normalizarNome(cabecalho[i]);
    for (const chave of Object.keys(COLUNAS)) {
      if (mapa[chave] === undefined && COLUNAS[chave].includes(norm)) {
        mapa[chave] = i;
      }
    }
  }
  return mapa;
}

function ehLinhaExemplo(row) {
  if (row.length !== MODELO_EXEMPLO.length) {
    return false;
  }
  return row.every((celula, i) => normalizarNome(celula) === normalizarNome(MODELO_EXEMPLO[i]));
}

function validarLinhas(linhas, { categoriasPorNome, fontesPorNome }) {
  const erros = [];
  const validos = [];

  if (!Array.isArray(linhas)) {
    return { erros, validos };
  }

  let headerIdx = -1;
  let mapa = null;
  for (let i = 0; i < linhas.length; i++) {
    const row = linhas[i];
    if (!Array.isArray(row)) {
      continue;
    }
    const candidato = mapearColunas(row);
    if (candidato.data !== undefined && candidato.descricao !== undefined && candidato.valor !== undefined) {
      headerIdx = i;
      mapa = candidato;
      break;
    }
  }

  if (headerIdx === -1) {
    mapa = { data: 0, descricao: 1, categoria: 2, fonte: 3, parcela: 4, valor: 5 };
  } else {
    const faltando = ['data', 'descricao', 'categoria', 'fonte', 'valor'].filter((chave) => mapa[chave] === undefined);
    if (faltando.length > 0) {
      erros.push({
        linha: headerIdx + 1,
        coluna: 'cabeçalho',
        mensagem: `Cabeçalho inválido: faltando coluna(s): ${faltando.join(', ')}.`
      });
      return { erros, validos };
    }
  }

  const valorEm = (row, chave) => {
    const idx = mapa[chave];
    return idx !== undefined && row[idx] !== undefined ? String(row[idx]).trim() : '';
  };

  const inicioDados = headerIdx === -1 ? 0 : headerIdx + 1;

  for (let i = inicioDados; i < linhas.length; i++) {
    const row = linhas[i];
    if (!Array.isArray(row)) {
      continue;
    }
    if (ehLinhaExemplo(row)) {
      continue;
    }
    if (row.every(celula => String(celula).trim() === '')) {
      continue;
    }

    const linha = i + 1;
    const data = valorEm(row, 'data');
    const descricao = valorEm(row, 'descricao');
    const categoriaNome = valorEm(row, 'categoria');
    const fonteNome = valorEm(row, 'fonte');
    const parcelaTexto = valorEm(row, 'parcela');
    const valorTexto = valorEm(row, 'valor');

    const errosLinha = [];

    if (!ehDataValida(data)) {
      errosLinha.push({ linha, coluna: 'Data', mensagem: 'Data inválida. Use AAAA-MM-DD.' });
    }

    if (!descricao) {
      errosLinha.push({ linha, coluna: 'Descrição', mensagem: 'Descrição é obrigatória.' });
    } else if (descricao.length > 120) {
      errosLinha.push({
        linha,
        coluna: 'Descrição',
        mensagem: 'Descrição deve ter no máximo 120 caracteres.'
      });
    }

    const tipoDaLinha = normalizarNome(valorEm(row, 'tipo')) === 'entrada'
      ? 'entrada'
      : (normalizarNome(valorEm(row, 'tipo')) === 'saida' ? 'saida' : null);

    let categoria;
    if (!categoriaNome) {
      errosLinha.push({ linha, coluna: 'Categoria', mensagem: 'Categoria é obrigatória.' });
    } else {
      let encontradas = categoriasPorNome.get(normalizarNome(categoriaNome));
      if (encontradas && encontradas.length > 1 && tipoDaLinha) {
        const filtradas = encontradas.filter((c) => c.tipo === tipoDaLinha);
        if (filtradas.length === 1) {
          encontradas = filtradas;
        }
      }
      if (!encontradas || encontradas.length === 0) {
        categoria = null;
      } else if (encontradas.length > 1) {
        errosLinha.push({
          linha,
          coluna: 'Categoria',
          mensagem: `Categoria "${categoriaNome}" é ambígua (existe como entrada e como saída).`
        });
      } else {
        categoria = encontradas[0];
      }
    }

    let fonte;
    if (!fonteNome) {
      errosLinha.push({ linha, coluna: 'Fonte/Destino', mensagem: 'Fonte/Destino é obrigatória.' });
    } else {
      fonte = fontesPorNome.get(normalizarNome(fonteNome)) || null;
    }

    let valor;
    if (!valorTexto) {
      errosLinha.push({ linha, coluna: 'Valor', mensagem: MSG_VALOR });
    } else {
      valor = Number(valorTexto);
      if (!Number.isFinite(valor) || valor <= 0) {
        errosLinha.push({ linha, coluna: 'Valor', mensagem: MSG_VALOR });
      }
    }

    let parcelas = 1;
    let parcelasValidas = true;
    if (parcelaTexto !== '') {
      if (/^\d+\s*\/\s*\d+$/.test(parcelaTexto)) {
        parcelas = 1;
      } else {
        const parcelaNum = Number(parcelaTexto);
        if (!Number.isInteger(parcelaNum) || parcelaNum < 1 || parcelaNum > 48) {
          parcelasValidas = false;
          errosLinha.push({
            linha,
            coluna: 'Parcela',
            mensagem: 'Parcela deve ser inteiro entre 1 e 48 (ou "k/N").'
          });
        } else {
          parcelas = parcelaNum;
        }
      }
    }

    const tipoEfetivo = categoria ? categoria.tipo : (tipoDaLinha || 'saida');
    const fonteTipoEfetivo = fonte ? fonte.tipo : 'conta';

    if (parcelasValidas && parcelas > 1) {
      if (tipoEfetivo !== 'saida') {
        errosLinha.push({
          linha,
          coluna: 'Parcela',
          mensagem: 'Parcelamento só é permitido para lançamentos do tipo saída.'
        });
      }
      if (fonteTipoEfetivo !== 'cartao_credito') {
        errosLinha.push({
          linha,
          coluna: 'Parcela',
          mensagem: 'Parcelamento só é permitido para fontes do tipo cartão de crédito.'
        });
      }
    }

    if (errosLinha.length > 0) {
      erros.push(...errosLinha);
      continue;
    }

    validos.push({
      linha,
      tipo: tipoEfetivo,
      descricao,
      valor,
      data,
      categoriaId: categoria ? categoria.id : null,
      categoriaNome,
      fonteDestinoId: fonte ? fonte.id : null,
      fonteNome,
      parcelas
    });
  }

  return { erros, validos };
}

module.exports = {
  MODELO_CABECALHO,
  MODELO_EXEMPLO,
  normalizarNome,
  gerarModelo,
  validarLinhas
};
