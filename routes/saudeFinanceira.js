const router = require('express').Router();
const Saude = require('../models/Saude');
const {
  taxaPoupanca,
  comprometimentoCartoes,
  mesesDeReserva,
  distribuicao503020,
  listarParcelasFuturas,
  projetarSaldo,
  gerarDicas
} = require('../utils/saude');

router.get('/', async (req, res) => {
  try {
    const usuarioId = req.auth.id;

    const [medias, saldoReserva, parcelasPorMes, gastosPorClassificacao, categoriaVsMedia, faturas3meses] = await Promise.all([
      Saude.medias(usuarioId),
      Saude.saldoReserva(usuarioId),
      Saude.parcelasPorMes(usuarioId, 12),
      Saude.gastosPorClassificacao(usuarioId, `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-01`, new Date().toISOString().slice(0, 10)),
      Saude.categoriaVsMedia(usuarioId),
      require('../models/Relatorio').faturas(usuarioId, 3)
    ]);

    const mediaEntradasMensal = medias.entradas / 3;
    const mediaSaidasMensal = medias.saidas / 3;

    let totalFaturas3meses = 0;
    for (const cartao of faturas3meses.cartoes) {
      for (const fatura of cartao.faturas) {
        totalFaturas3meses += Number(fatura.total || 0);
      }
    }

    const tp = taxaPoupanca(medias.entradas, medias.saidas);
    const cc = comprometimentoCartoes(totalFaturas3meses, mediaEntradasMensal);
    const mr = mesesDeReserva(saldoReserva, mediaSaidasMensal);
    const dist = distribuicao503020(gastosPorClassificacao, mediaEntradasMensal);
    const parcelasFuturas = listarParcelasFuturas(parcelasPorMes);
    const projecao = projetarSaldo(mediaEntradasMensal, mediaSaidasMensal, parcelasPorMes, 6);

    let categoriaForaDaCurva = null;
    for (const cat of categoriaVsMedia) {
      if (cat.mediaAnterior > 0 && cat.ratio > 1.30) {
        categoriaForaDaCurva = {
          nome: cat.nome,
          total: cat.totalAtual,
          mediaAnterior: cat.mediaAnterior,
          ratio: cat.ratio
        };
        break;
      }
    }

    const dicas = gerarDicas({
      taxaPoupanca: tp,
      comprometimentoCartoes: cc,
      mesesDeReserva: mr,
      projecao,
      categoriaForaDaCurva
    });

    const aviso = 'Informações educativas; não constituem recomendação financeira profissional.';

    const indicadores = {
      taxaPoupanca: tp,
      comprometimentoCartoes: cc,
      parcelasFuturas,
      distribuicao503020: dist,
      mesesDeReserva: mr
    };

    res.json({
      aviso,
      indicadores,
      projecao,
      dicas
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = router;