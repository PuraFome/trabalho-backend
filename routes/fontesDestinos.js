const router = require('express').Router();
const FonteDestino = require('../models/FonteDestino');

const TIPOS_VALIDOS = ['renda', 'conta', 'cartao_credito'];

function validarCamposCartao(body, prefix = '') {
  const campos = {};
  const { dia_fechamento, dia_vencimento, limite } = body;

  if (dia_fechamento === undefined || dia_fechamento === null || dia_fechamento === '') {
    campos[prefix + 'dia_fechamento'] = 'Dia de fechamento é obrigatório para cartão de crédito.';
  } else if (!Number.isInteger(Number(dia_fechamento)) || Number(dia_fechamento) < 1 || Number(dia_fechamento) > 31) {
    campos[prefix + 'dia_fechamento'] = 'Dia de fechamento deve ser inteiro entre 1 e 31.';
  }

  if (dia_vencimento === undefined || dia_vencimento === null || dia_vencimento === '') {
    campos[prefix + 'dia_vencimento'] = 'Dia de vencimento é obrigatório para cartão de crédito.';
  } else if (!Number.isInteger(Number(dia_vencimento)) || Number(dia_vencimento) < 1 || Number(dia_vencimento) > 31) {
    campos[prefix + 'dia_vencimento'] = 'Dia de vencimento deve ser inteiro entre 1 e 31.';
  }

  if (limite === undefined || limite === null || limite === '') {
    campos[prefix + 'limite'] = 'Limite é obrigatório para cartão de crédito.';
  } else {
    const limiteNum = Number(limite);
    if (Number.isNaN(limiteNum) || limiteNum <= 0) {
      campos[prefix + 'limite'] = 'Limite deve ser número maior que zero.';
    }
  }

  return campos;
}

// GET /fontes-destinos
router.get('/', async (req, res) => {
  const { tipo } = req.query;
  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { tipo: 'Tipo deve ser renda, conta ou cartao_credito.' } });
  }
  const fontes = await FonteDestino.listar(req.auth.id, tipo);
  return res.status(200).json(fontes);
});

// POST /fontes-destinos
router.post('/', async (req, res) => {
  const { nome, tipo, dia_fechamento, dia_vencimento, limite, reserva } = req.body || {};
  const campos = {};

  if (!nome || !nome.trim()) {
    campos.nome = 'Nome é obrigatório.';
  } else if (nome.trim().length > 60) {
    campos.nome = 'Nome deve ter no máximo 60 caracteres.';
  }

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    campos.tipo = 'Tipo é obrigatório e deve ser renda, conta ou cartao_credito.';
  }

  if (tipo === 'cartao_credito') {
    Object.assign(campos, validarCamposCartao(req.body));
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  const nomeNorm = nome.trim();
  const ehCartao = tipo === 'cartao_credito';

  try {
    const fonte = await FonteDestino.criar({
      usuarioId: req.auth.id,
      nome: nomeNorm,
      tipo,
      dia_fechamento: ehCartao ? Number(dia_fechamento) : null,
      dia_vencimento: ehCartao ? Number(dia_vencimento) : null,
      limite: ehCartao ? Number(limite) : null,
      reserva: Boolean(reserva)
    });
    return res.status(201).json(fonte);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Fonte/destino já cadastrado.', campos: { nome: 'Já existe uma fonte/destino com este nome.' } });
    }
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// PUT /fontes-destinos/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { id: 'ID inválido.' } });
  }

  const { nome, tipo, dia_fechamento, dia_vencimento, limite, reserva } = req.body || {};
  const campos = {};

  if (nome !== undefined) {
    if (!nome || !nome.trim()) {
      campos.nome = 'Nome é obrigatório.';
    } else if (nome.trim().length > 60) {
      campos.nome = 'Nome deve ter no máximo 60 caracteres.';
    }
  }

  if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) {
    campos.tipo = 'Tipo deve ser renda, conta ou cartao_credito.';
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  if (nome === undefined && tipo === undefined && dia_fechamento === undefined && dia_vencimento === undefined && limite === undefined && reserva === undefined) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { geral: 'Informe ao menos um campo para atualizar.' } });
  }

  const fonteAtual = await FonteDestino.buscarPorId(id, req.auth.id);
  if (!fonteAtual) {
    return res.status(404).json({ erro: 'Fonte/destino não encontrado.' });
  }

  const novoTipo = tipo !== undefined ? tipo : fonteAtual.tipo;
  const ehCartaoNovo = novoTipo === 'cartao_credito';

  if (ehCartaoNovo) {
    const mergedBody = {
      dia_fechamento: dia_fechamento !== undefined ? dia_fechamento : fonteAtual.dia_fechamento,
      dia_vencimento: dia_vencimento !== undefined ? dia_vencimento : fonteAtual.dia_vencimento,
      limite: limite !== undefined ? limite : fonteAtual.limite
    };
    const camposCartao = validarCamposCartao(mergedBody);
    if (Object.keys(camposCartao).length > 0) {
      return res.status(400).json({ erro: 'Dados inválidos.', campos: camposCartao });
    }
  }

  if (tipo !== undefined && tipo !== fonteAtual.tipo) {
    const temLancamentos = await FonteDestino.contarLancamentos(id, req.auth.id);
    if (temLancamentos > 0) {
      return res.status(409).json({ erro: 'Não é possível alterar o tipo: existem lançamentos vinculados a esta fonte/destino.' });
    }
  }

  const payload = {};
  if (nome !== undefined) payload.nome = nome.trim();
  if (tipo !== undefined) payload.tipo = tipo;
  if (dia_fechamento !== undefined) payload.dia_fechamento = ehCartaoNovo ? Number(dia_fechamento) : null;
  if (dia_vencimento !== undefined) payload.dia_vencimento = ehCartaoNovo ? Number(dia_vencimento) : null;
  if (limite !== undefined) payload.limite = ehCartaoNovo ? Number(limite) : null;
  if (reserva !== undefined) payload.reserva = Boolean(reserva);

  if (!ehCartaoNovo) {
    payload.dia_fechamento = null;
    payload.dia_vencimento = null;
    payload.limite = null;
  }

  try {
    const affected = await FonteDestino.atualizar(id, req.auth.id, payload);
    if (affected === 0) {
      return res.status(404).json({ erro: 'Fonte/destino não encontrado.' });
    }
    const atualizada = await FonteDestino.buscarPorId(id, req.auth.id);
    return res.status(200).json(atualizada);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Fonte/destino já cadastrado.', campos: { nome: 'Já existe uma fonte/destino com este nome.' } });
    }
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// DELETE /fontes-destinos/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { id: 'ID inválido.' } });
  }

  const fonte = await FonteDestino.buscarPorId(id, req.auth.id);
  if (!fonte) {
    return res.status(404).json({ erro: 'Fonte/destino não encontrado.' });
  }

  const temLancamentos = await FonteDestino.contarLancamentos(id, req.auth.id);
  if (temLancamentos > 0) {
    return res.status(409).json({ erro: 'Não é possível excluir: existem lançamentos vinculados a esta fonte/destino.' });
  }

  const affected = await FonteDestino.excluir(id, req.auth.id);
  if (affected === 0) {
    return res.status(404).json({ erro: 'Fonte/destino não encontrado.' });
  }
  return res.status(204).send();
});

module.exports = router;