const router = require('express').Router();
const Lancamento = require('../models/Lancamento');
const Categoria = require('../models/Categoria');
const FonteDestino = require('../models/FonteDestino');
const { ehDataValida, hojeUTC, ultimoDiaDoMes } = require('../utils/datas');

const TIPOS_VALIDOS = ['entrada', 'saida'];

function getDefaultPeriod() {
  const hoje = hojeUTC();
  const [ano, mes] = hoje.split('-').map(Number);
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${ultimoDiaDoMes(ano, mes - 1)}`;
  return { inicio, fim };
}

// GET /lancamentos
router.get('/', async (req, res) => {
  const { inicio, fim, tipo, categoriaId, fonteDestinoId, pagina } = req.query;
  const campos = {};

  const { inicio: inicioDefault, fim: fimDefault } = getDefaultPeriod();
  const inicioFinal = inicio || inicioDefault;
  const fimFinal = fim || fimDefault;

  if (inicio && !ehDataValida(inicio)) {
    campos.inicio = 'Data de início inválida. Use AAAA-MM-DD.';
  }
  if (fim && !ehDataValida(fim)) {
    campos.fim = 'Data de fim inválida. Use AAAA-MM-DD.';
  }
  if (inicioFinal > fimFinal) {
    campos.periodo = 'Data de início deve ser anterior ou igual à data de fim.';
  }
  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    campos.tipo = 'Tipo deve ser entrada ou saida.';
  }
  if (categoriaId !== undefined) {
    const catId = parseInt(categoriaId, 10);
    if (!Number.isInteger(catId) || catId <= 0) {
      campos.categoriaId = 'categoriaId deve ser inteiro positivo.';
    }
  }
  if (fonteDestinoId !== undefined) {
    const fonteId = parseInt(fonteDestinoId, 10);
    if (!Number.isInteger(fonteId) || fonteId <= 0) {
      campos.fonteDestinoId = 'fonteDestinoId deve ser inteiro positivo.';
    }
  }
  if (pagina !== undefined) {
    const pag = parseInt(pagina, 10);
    if (!Number.isInteger(pag) || pag < 1) {
      campos.pagina = 'pagina deve ser inteiro >= 1.';
    }
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  const paginaFinal = pagina ? parseInt(pagina, 10) : 1;
  const resultado = await Lancamento.listar(req.auth.id, {
    inicio: inicioFinal,
    fim: fimFinal,
    tipo,
    categoriaId: categoriaId ? parseInt(categoriaId, 10) : undefined,
    fonteDestinoId: fonteDestinoId ? parseInt(fonteDestinoId, 10) : undefined,
    pagina: paginaFinal
  });

  const totalPaginas = resultado.total === 0 ? 0 : Math.ceil(resultado.total / 20);

  return res.status(200).json({
    periodo: { inicio: inicioFinal, fim: fimFinal },
    resumo: resultado.resumo,
    pagina: paginaFinal,
    totalPaginas,
    itens: resultado.itens
  });
});

// GET /lancamentos/:id
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { id: 'ID inválido.' } });
  }

  const lancamento = await Lancamento.buscarPorId(id, req.auth.id);
  if (!lancamento) {
    return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  }

  return res.status(200).json(lancamento);
});

// POST /lancamentos
router.post('/', async (req, res) => {
  const { tipo, descricao, valor, data, categoriaId, fonteDestinoId, parcelas } = req.body || {};
  const campos = {};

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    campos.tipo = 'Tipo é obrigatório e deve ser entrada ou saida.';
  }

  if (!descricao || !descricao.trim()) {
    campos.descricao = 'Descrição é obrigatória.';
  } else if (descricao.trim().length > 120) {
    campos.descricao = 'Descrição deve ter no máximo 120 caracteres.';
  }

  if (valor === undefined || valor === null || valor === '') {
    campos.valor = 'Valor é obrigatório.';
  } else {
    const valorNum = Number(valor);
    if (Number.isNaN(valorNum) || valorNum <= 0) {
      campos.valor = 'Valor deve ser número maior que zero.';
    }
  }

  if (!data || !ehDataValida(data)) {
    campos.data = 'Data é obrigatória e deve ser uma data válida no formato AAAA-MM-DD.';
  }

  if (categoriaId === undefined || categoriaId === null || categoriaId === '') {
    campos.categoriaId = 'categoriaId é obrigatório.';
  } else {
    const catId = parseInt(categoriaId, 10);
    if (!Number.isInteger(catId) || catId <= 0) {
      campos.categoriaId = 'categoriaId deve ser inteiro positivo.';
    }
  }

  if (fonteDestinoId === undefined || fonteDestinoId === null || fonteDestinoId === '') {
    campos.fonteDestinoId = 'fonteDestinoId é obrigatório.';
  } else {
    const fonteId = parseInt(fonteDestinoId, 10);
    if (!Number.isInteger(fonteId) || fonteId <= 0) {
      campos.fonteDestinoId = 'fonteDestinoId deve ser inteiro positivo.';
    }
  }

  let parcelasFinal = 1;
  if (parcelas !== undefined && parcelas !== null && parcelas !== '') {
    const par = parseInt(parcelas, 10);
    if (!Number.isInteger(par) || par < 1 || par > 48) {
      campos.parcelas = 'parcelas deve ser inteiro entre 1 e 48.';
    } else {
      parcelasFinal = par;
    }
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  const categoria = await Categoria.buscarPorId(parseInt(categoriaId, 10), req.auth.id);
  if (!categoria) {
    return res.status(404).json({ erro: 'Categoria não encontrada.' });
  }
  if (categoria.tipo !== tipo) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: {
        categoriaId: tipo === 'saida'
          ? 'A categoria informada é de entrada, mas o lançamento é de saída.'
          : 'A categoria informada é de saída, mas o lançamento é de entrada.'
      }
    });
  }

  const fonte = await FonteDestino.buscarPorId(parseInt(fonteDestinoId, 10), req.auth.id);
  if (!fonte) {
    return res.status(404).json({ erro: 'Fonte/destino não encontrado.' });
  }
  if (parcelasFinal > 1 && fonte.tipo !== 'cartao_credito') {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: { parcelas: 'Parcelamento só é permitido para fontes do tipo cartao_credito.' }
    });
  }

  try {
    const resultado = await Lancamento.criar({
      usuarioId: req.auth.id,
      tipo,
      descricao: descricao.trim(),
      valor: Number(valor),
      data,
      categoriaId: parseInt(categoriaId, 10),
      fonteDestinoId: parseInt(fonteDestinoId, 10),
      parcelas: parcelasFinal
    });
    return res.status(201).json(resultado);
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(404).json({ erro: 'Categoria ou fonte/destino não encontrado.' });
    }
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /lancamentos/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { id: 'ID inválido.' } });
  }

  const { tipo, descricao, valor, data, categoriaId, fonteDestinoId } = req.body || {};
  const campos = {};

  if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) {
    campos.tipo = 'Tipo deve ser entrada ou saida.';
  }

  if (descricao !== undefined) {
    if (!descricao || !descricao.trim()) {
      campos.descricao = 'Descrição é obrigatória.';
    } else if (descricao.trim().length > 120) {
      campos.descricao = 'Descrição deve ter no máximo 120 caracteres.';
    }
  }

  if (valor !== undefined) {
    if (valor === null || valor === '') {
      campos.valor = 'Valor é obrigatório.';
    } else {
      const valorNum = Number(valor);
      if (Number.isNaN(valorNum) || valorNum <= 0) {
        campos.valor = 'Valor deve ser número maior que zero.';
      }
    }
  }

  if (data !== undefined && !ehDataValida(data)) {
    campos.data = 'Data deve ser uma data válida no formato AAAA-MM-DD.';
  }

  if (categoriaId !== undefined) {
    if (categoriaId === null || categoriaId === '') {
      campos.categoriaId = 'categoriaId é obrigatório.';
    } else {
      const catId = parseInt(categoriaId, 10);
      if (!Number.isInteger(catId) || catId <= 0) {
        campos.categoriaId = 'categoriaId deve ser inteiro positivo.';
      }
    }
  }

  if (fonteDestinoId !== undefined) {
    if (fonteDestinoId === null || fonteDestinoId === '') {
      campos.fonteDestinoId = 'fonteDestinoId é obrigatório.';
    } else {
      const fonteId = parseInt(fonteDestinoId, 10);
      if (!Number.isInteger(fonteId) || fonteId <= 0) {
        campos.fonteDestinoId = 'fonteDestinoId deve ser inteiro positivo.';
      }
    }
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  const lancamentoAtual = await Lancamento.buscarPorId(id, req.auth.id);
  if (!lancamentoAtual) {
    return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  }

  const novoTipo = tipo !== undefined ? tipo : lancamentoAtual.tipo;
  const novaCategoriaId = categoriaId !== undefined ? parseInt(categoriaId, 10) : lancamentoAtual.categoria.id;
  const novaFonteId = fonteDestinoId !== undefined ? parseInt(fonteDestinoId, 10) : lancamentoAtual.fonteDestino.id;

  const categoria = await Categoria.buscarPorId(novaCategoriaId, req.auth.id);
  if (!categoria) {
    return res.status(404).json({ erro: 'Categoria não encontrada.' });
  }
  if (categoria.tipo !== novoTipo) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: {
        categoriaId: novoTipo === 'saida'
          ? 'A categoria informada é de entrada, mas o lançamento é de saída.'
          : 'A categoria informada é de saída, mas o lançamento é de entrada.'
      }
    });
  }

  const fonte = await FonteDestino.buscarPorId(novaFonteId, req.auth.id);
  if (!fonte) {
    return res.status(404).json({ erro: 'Fonte/destino não encontrado.' });
  }
  if (lancamentoAtual.parcela && lancamentoAtual.parcela.includes('/')) {
    const [, totalParcelas] = lancamentoAtual.parcela.split('/');
    if (parseInt(totalParcelas, 10) > 1 && fonte.tipo !== 'cartao_credito') {
      return res.status(400).json({
        erro: 'Dados inválidos.',
        campos: { fonteDestinoId: 'Parcelamento só é permitido para fontes do tipo cartao_credito.' }
      });
    }
  }

  const payload = {};
  if (tipo !== undefined) payload.tipo = tipo;
  if (descricao !== undefined) payload.descricao = descricao.trim();
  if (valor !== undefined) payload.valor = Number(valor);
  if (data !== undefined) payload.data = data;
  if (categoriaId !== undefined) payload.categoria_id = parseInt(categoriaId, 10);
  if (fonteDestinoId !== undefined) payload.fonte_destino_id = parseInt(fonteDestinoId, 10);

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { geral: 'Informe ao menos um campo para atualizar.' } });
  }

  try {
    const affected = await Lancamento.atualizar(id, req.auth.id, payload);
    if (affected === 0) {
      return res.status(404).json({ erro: 'Lançamento não encontrado.' });
    }
    const atualizado = await Lancamento.buscarPorId(id, req.auth.id);
    return res.status(200).json(atualizado);
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(404).json({ erro: 'Categoria ou fonte/destino não encontrado.' });
    }
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /lancamentos/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { id: 'ID inválido.' } });
  }

  const todasParcelas = req.query.todasParcelas === 'true';

  const affected = await Lancamento.excluir(id, req.auth.id, todasParcelas);
  if (affected === 0) {
    return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  }

  return res.status(204).send();
});

module.exports = router;