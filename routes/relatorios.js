const router = require('express').Router();
const Relatorio = require('../models/Relatorio');
const { ehDataValida, periodoAnterior } = require('../utils/datas');

router.get('/categorias', async (req, res) => {
  const { inicio, fim } = req.query;
  const usuarioId = req.auth.id;

  if (!inicio || !fim) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { inicio: !inicio ? 'Obrigatório.' : undefined, fim: !fim ? 'Obrigatório.' : undefined } });
  }

  if (!ehDataValida(inicio) || !ehDataValida(fim)) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { inicio: !ehDataValida(inicio) ? 'Data inválida.' : undefined, fim: !ehDataValida(fim) ? 'Data inválida.' : undefined } });
  }

  if (inicio > fim) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { inicio: 'inicio não pode ser maior que fim.' } });
  }

  const periodoAnt = periodoAnterior(inicio, fim);

  try {
    const relatorio = await Relatorio.porCategoria(usuarioId, inicio, fim, periodoAnt.inicio, periodoAnt.fim);
    res.json({
      periodo: { inicio, fim },
      periodoAnterior: { inicio: periodoAnt.inicio, fim: periodoAnt.fim },
      saidas: relatorio.saidas,
      entradas: relatorio.entradas
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

router.get('/fontes-destinos', async (req, res) => {
  const { inicio, fim } = req.query;
  const usuarioId = req.auth.id;

  if (!inicio || !fim) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { inicio: !inicio ? 'Obrigatório.' : undefined, fim: !fim ? 'Obrigatório.' : undefined } });
  }

  if (!ehDataValida(inicio) || !ehDataValida(fim)) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { inicio: !ehDataValida(inicio) ? 'Data inválida.' : undefined, fim: !ehDataValida(fim) ? 'Data inválida.' : undefined } });
  }

  if (inicio > fim) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { inicio: 'inicio não pode ser maior que fim.' } });
  }

  try {
    const relatorio = await Relatorio.porFonteDestino(usuarioId, inicio, fim);
    res.json({
      periodo: { inicio, fim },
      entradas: relatorio.entradas,
      saidas: relatorio.saidas,
      contas: relatorio.contas
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

router.get('/faturas', async (req, res) => {
  const { meses } = req.query;
  const usuarioId = req.auth.id;

  const mesesNum = meses === undefined ? 3 : Number(meses);
  if (!Number.isInteger(mesesNum) || mesesNum < 1 || mesesNum > 12) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: { meses: 'Deve ser inteiro entre 1 e 12.' } });
  }

  try {
    const relatorio = await Relatorio.faturas(usuarioId, mesesNum);
    res.json(relatorio);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;