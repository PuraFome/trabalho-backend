const router = require('express').Router();
const Saude = require('../models/Saude');
const { hojeUTC, deslocarMes, somarDias } = require('../utils/datas');
const {
  taxaPoupanca,
  comprometimentoCartoes,
  mesesDeReserva,
  distribuicao503020,
  listarParcelasFuturas,
  projetarSaldo,
  gerarDicas,
  clamp,
  indiceEndividamento,
  runwayMeses,
  scoreSaude,
  concentracaoGastos,
  tendenciaGastos
} = require('../utils/saude');

router.get('/', async (req, res) => {
  try {
    const usuarioId = req.auth.id;

    const mesAtual = hojeUTC().slice(0, 7);
    const inicioMesAtual = `${mesAtual}-01`;
    const fimMesAtual = hojeUTC();
    const inicio = deslocarMes(inicioMesAtual, -2);
    const fim = hojeUTC();
    const inicioAnterior = deslocarMes(inicioMesAtual, -3);
    const fimAnterior = somarDias(inicioMesAtual, -1);

    const [medias, saldoReserva, parcelasPorMes, gastosPorClassificacao, categoriaVsMedia, faturas3meses, saldoContas, gastosPorCategoria] = await Promise.all([
      Saude.medias(usuarioId),
      Saude.saldoReserva(usuarioId),
      Saude.parcelasPorMes(usuarioId, 12),
      Saude.gastosPorClassificacao(usuarioId, inicioMesAtual, fimMesAtual),
      Saude.categoriaVsMedia(usuarioId),
      require('../models/Relatorio').faturas(usuarioId, 3),
      Saude.saldoContas(usuarioId),
      Saude.gastosPorCategoriaMes(usuarioId, inicioMesAtual, fimMesAtual)
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

    const totalParcelasFuturas = parcelasFuturas.reduce((s, p) => s + p.total, 0);

    const categoriasForaDaCurva = categoriaVsMedia
      .filter(c => c.mediaAnterior > 0 && c.ratio > 1.30)
      .map(c => ({ nome: c.nome, total: c.totalAtual, mediaAnterior: c.mediaAnterior, ratio: c.ratio }));

    const ie = indiceEndividamento(totalParcelasFuturas, mediaEntradasMensal);
    const rm = runwayMeses(saldoContas, mediaSaidasMensal);
    const sc = scoreSaude({ taxaPoupanca: tp, comprometimentoCartoes: cc, mesesDeReserva: mr });
    const cg = concentracaoGastos(gastosPorCategoria.categorias, gastosPorCategoria.totalGastos);
    const tg = tendenciaGastos(mesAtual, gastosPorCategoria.totalGastos, mediaSaidasMensal);

    const indicadores = {
      taxaPoupanca: tp,
      comprometimentoCartoes: cc,
      parcelasFuturas,
      distribuicao503020: dist,
      mesesDeReserva: mr,
      categoriasForaDaCurva,
      indiceEndividamento: ie,
      runwayMeses: rm,
      scoreSaude: sc,
      concentracaoGastos: cg,
      tendenciaGastos: tg
    };

    const dicas = gerarDicas({
      taxaPoupanca: tp,
      comprometimentoCartoes: cc,
      mesesDeReserva: mr,
      projecao,
      categoriasForaDaCurva,
      indiceEndividamento: ie,
      runwayMeses: rm,
      concentracaoGastos: cg,
      tendenciaGastos: tg
    });

    const aviso = 'Informações educativas; não constituem recomendação financeira profissional.';

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