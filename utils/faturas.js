// [Critério 11] Regra de fechamento/vencimento de fatura (Tabela 11.3).
const { ultimoDiaDoMes, dataSegura } = require('./datas');

function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const m = mes - 1;
  const fechamentoDoMes = Math.min(cartao.diaFechamento, ultimoDiaDoMes(ano, m));
  let mesFechamento = dia < fechamentoDoMes ? m : m + 1;
  mesFechamento += numeroParcela - 1;
  const fechamento = dataSegura(ano, mesFechamento, cartao.diaFechamento);
  const mesVencimento = cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = dataSegura(ano, mesVencimento, cartao.diaVencimento);
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    referencia: iso(vencimento).slice(0, 7),
    fechamento: iso(fechamento),
    vencimento: iso(vencimento)
  };
}

module.exports = { calcularFatura };