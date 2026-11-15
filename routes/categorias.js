const router = require('express').Router();
const Categoria = require('../models/Categoria');

const TIPOS_VALIDOS = ['entrada', 'saida'];
const CLASSIFICACOES_VALIDAS = ['necessidade', 'desejo', 'poupanca'];

// GET /categorias
router.get('/', async (req, res) => {
  const { tipo } = req.query;
  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { tipo: 'Tipo deve ser entrada ou saida.' } });
  }
  const categorias = await Categoria.listar(req.auth.id, tipo);
  return res.status(200).json(categorias);
});

// POST /categorias
router.post('/', async (req, res) => {
  const { nome, tipo, classificacao } = req.body || {};
  const campos = {};

  if (!nome || !nome.trim()) {
    campos.nome = 'Nome é obrigatório.';
  } else if (nome.trim().length > 60) {
    campos.nome = 'Nome deve ter no máximo 60 caracteres.';
  }

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    campos.tipo = 'Tipo é obrigatório e deve ser entrada ou saida.';
  }

  if (classificacao !== undefined && classificacao !== null) {
    if (!CLASSIFICACOES_VALIDAS.includes(classificacao)) {
      campos.classificacao = 'Classificação deve ser necessidade, desejo ou poupanca.';
    }
    if (tipo === 'entrada' && classificacao !== null) {
      campos.classificacao = 'Entradas não podem ter classificação.';
    }
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  const nomeNorm = nome.trim();
  const classificacaoNorm = tipo === 'entrada' ? null : (classificacao || null);

  try {
    const categoria = await Categoria.criar({
      usuarioId: req.auth.id,
      nome: nomeNorm,
      tipo,
      classificacao: classificacaoNorm
    });
    return res.status(201).json(categoria);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Categoria já cadastrada.', campos: { nome: 'Já existe uma categoria com este nome e tipo.' } });
    }
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /categorias/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { id: 'ID inválido.' } });
  }

  const { nome, tipo, classificacao } = req.body || {};
  const campos = {};

  if (nome !== undefined) {
    if (!nome || !nome.trim()) {
      campos.nome = 'Nome é obrigatório.';
    } else if (nome.trim().length > 60) {
      campos.nome = 'Nome deve ter no máximo 60 caracteres.';
    }
  }

  if (tipo !== undefined) {
    if (!TIPOS_VALIDOS.includes(tipo)) {
      campos.tipo = 'Tipo deve ser entrada ou saida.';
    }
  }

  if (classificacao !== undefined) {
    if (classificacao !== null && !CLASSIFICACOES_VALIDAS.includes(classificacao)) {
      campos.classificacao = 'Classificação deve ser necessidade, desejo ou poupanca.';
    }
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  if (nome === undefined && tipo === undefined && classificacao === undefined) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { geral: 'Informe ao menos um campo para atualizar.' } });
  }

  const categoriaAtual = await Categoria.buscarPorId(id, req.auth.id);
  if (!categoriaAtual) {
    return res.status(404).json({ erro: 'Categoria não encontrada.' });
  }

  const novoTipo = tipo !== undefined ? tipo : categoriaAtual.tipo;
  const novaClassificacao = classificacao !== undefined ? (novoTipo === 'entrada' ? null : classificacao) : categoriaAtual.classificacao;

  if (novoTipo === 'entrada' && novaClassificacao !== null) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { classificacao: 'Entradas não podem ter classificação.' } });
  }

  if (tipo !== undefined && tipo !== categoriaAtual.tipo) {
    const temLancamentos = await Categoria.contarLancamentos(id, req.auth.id);
    if (temLancamentos > 0) {
      return res.status(409).json({ erro: 'Não é possível alterar o tipo: existem lançamentos vinculados a esta categoria.' });
    }
  }

  try {
    const payload = {};
    if (nome !== undefined) payload.nome = nome.trim();
    if (tipo !== undefined) payload.tipo = tipo;
    if (classificacao !== undefined) payload.classificacao = novaClassificacao;

    const affected = await Categoria.atualizar(id, req.auth.id, payload);
    if (affected === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }
    const atualizada = await Categoria.buscarPorId(id, req.auth.id);
    return res.status(200).json(atualizada);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Categoria já cadastrada.', campos: { nome: 'Já existe uma categoria com este nome e tipo.' } });
    }
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /categorias/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { id: 'ID inválido.' } });
  }

  const categoria = await Categoria.buscarPorId(id, req.auth.id);
  if (!categoria) {
    return res.status(404).json({ erro: 'Categoria não encontrada.' });
  }

  const temLancamentos = await Categoria.contarLancamentos(id, req.auth.id);
  if (temLancamentos > 0) {
    return res.status(409).json({ erro: 'Não é possível excluir: existem lançamentos vinculados a esta categoria.' });
  }

  const affected = await Categoria.excluir(id, req.auth.id);
  if (affected === 0) {
    return res.status(404).json({ erro: 'Categoria não encontrada.' });
  }
  return res.status(204).send();
});

module.exports = router;