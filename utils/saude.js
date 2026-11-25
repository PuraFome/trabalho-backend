function taxaPoupanca(entradas, saidas) {
  if (entradas <= 0) return 0;
  return Number(((entradas - saidas) / entradas).toFixed(4));
}

function comprometimentoCartoes(totalFaturas, mediaEntradas) {
  if (mediaEntradas <= 0) return 0;
  return Number((totalFaturas / mediaEntradas).toFixed(4));
}

function mesesDeReserva(saldoReserva, mediaSaidas) {
  if (mediaSaidas <= 0) return 0;
  return Number((saldoReserva / mediaSaidas).toFixed(2));
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function indiceEndividamento(totalParcelasFuturas, mediaEntradasMensal) {
  if (mediaEntradasMensal <= 0) return 0;
  return Number((totalParcelasFuturas / (mediaEntradasMensal * 12)).toFixed(4));
}

function runwayMeses(saldoContas, mediaSaidasMensal) {
  if (mediaSaidasMensal <= 0) return 0;
  return Number((saldoContas / mediaSaidasMensal).toFixed(2));
}

function distribuicao503020(saidasPorClassificacao, entradasMes) {
  const necessidade = Number(saidasPorClassificacao.necessidade || 0);
  const desejo = Number(saidasPorClassificacao.desejo || 0);
  const poupanca = Number(saidasPorClassificacao.poupanca || 0);
  const naoClassificado = Number(saidasPorClassificacao.naoClassificado || 0);

  if (entradasMes <= 0) {
    return {
      necessidades: { total: necessidade, percentual: 0 },
      desejos: { total: desejo, percentual: 0 },
      poupanca: { total: poupanca, percentual: 0 },
      naoClassificado: { total: naoClassificado, percentual: 0 }
    };
  }

  return {
    necessidades: {
      total: necessidade,
      percentual: Number((necessidade / entradasMes).toFixed(4))
    },
    desejos: {
      total: desejo,
      percentual: Number((desejo / entradasMes).toFixed(4))
    },
    poupanca: {
      total: poupanca,
      percentual: Number((poupanca / entradasMes).toFixed(4))
    },
    naoClassificado: {
      total: naoClassificado,
      percentual: Number((naoClassificado / entradasMes).toFixed(4))
    }
  };
}

function listarParcelasFuturas(parcelasPorMes) {
  const meses = Object.keys(parcelasPorMes).sort();
  const resultado = [];
  for (const mes of meses) {
    const total = Number(parcelasPorMes[mes]);
    if (total > 0) {
      resultado.push({ mes, total });
    }
  }
  return resultado;
}

function projetarSaldo(mediaEntradas, mediaSaidas, parcelasPorMes, meses = 6) {
  const hoje = new Date();
  const anoAtual = hoje.getUTCFullYear();
  const mesAtual = hoje.getUTCMonth() + 1;

  const resultado = [];
  for (let i = 0; i < meses; i++) {
    let mes = mesAtual + i;
    let ano = anoAtual;
    while (mes > 12) {
      mes -= 12;
      ano += 1;
    }
    const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const parcelasMes = Number(parcelasPorMes[mesStr] || 0);
    const saidasProjetadas = mediaSaidas + parcelasMes;
    const saldoPrevisto = Number((mediaEntradas - saidasProjetadas).toFixed(2));
    resultado.push({
      mes: mesStr,
      entradas: Number(mediaEntradas.toFixed(2)),
      saidas: Number(saidasProjetadas.toFixed(2)),
      saldoPrevisto
    });
  }
  return resultado;
}

function formatarNumero(num) {
  const negativo = num < 0;
  const abs = Math.abs(num);
  const partes = abs.toFixed(2).split('.');
  const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimal = partes[1];
  return (negativo ? '-' : '') + inteiro + '.' + decimal;
}

function gerarDicas({
  taxaPoupanca: tp,
  comprometimentoCartoes: cc,
  mesesDeReserva: mr,
  projecao,
  categoriaForaDaCurva
}) {
  const dicas = [];

  if (tp < 0.10) {
    dicas.push(`Sua taxa de poupança está em ${(tp * 100).toFixed(2)}%, abaixo do recomendado de 10%.`);
  }

  if (cc > 0.30) {
    dicas.push(`O comprometimento com cartões está em ${(cc * 100).toFixed(2)}%, acima do limite recomendado de 30%.`);
  }

  if (mr < 3) {
    dicas.push(`Você tem ${mr.toFixed(2)} meses de reserva, abaixo do recomendado de 3 meses.`);
  }

  if (categoriaForaDaCurva) {
    dicas.push(`A categoria "${categoriaForaDaCurva.nome}" gastou ${formatarNumero(categoriaForaDaCurva.total)}, ${formatarNumero(categoriaForaDaCurva.ratio * 100)}% acima da média de ${formatarNumero(categoriaForaDaCurva.mediaAnterior)} dos 3 meses anteriores.`);
  }

  const mesNegativo = projecao.find(p => p.saldoPrevisto < 0);
  if (mesNegativo) {
    dicas.push(`Projeção indica saldo negativo de ${formatarNumero(mesNegativo.saldoPrevisto)} em ${mesNegativo.mes}.`);
  }

  if (dicas.length === 0) {
    dicas.push('Sua taxa de poupança está acima de 10%, comprometimento com cartões abaixo de 30% e reserva superior a 3 meses. Parabéns!');
  }

  return dicas.slice(0, 5);
}

module.exports = {
  clamp,
  taxaPoupanca,
  comprometimentoCartoes,
  mesesDeReserva,
  indiceEndividamento,
  runwayMeses,
  distribuicao503020,
  listarParcelasFuturas,
  projetarSaldo,
  gerarDicas
};