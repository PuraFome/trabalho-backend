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

function scoreSaude({ taxaPoupanca, comprometimentoCartoes, mesesDeReserva }) {
  return Math.round(
    clamp(taxaPoupanca / 0.20, 0, 1) * 40 +
      clamp(1 - comprometimentoCartoes / 0.50, 0, 1) * 30 +
      clamp(mesesDeReserva / 6, 0, 1) * 30
  );
}

function concentracaoGastos(categorias, totalGastos) {
  const top3 = categorias.slice(0, 3);
  const categoriasTop3 = top3.map(categoria => ({
    nome: categoria.nome,
    total: categoria.total,
    percentual: totalGastos > 0 ? Number((categoria.total / totalGastos).toFixed(4)) : 0
  }));
  const somaTop3 = top3.reduce((soma, categoria) => soma + categoria.total, 0);
  const indiceConcentracao = totalGastos > 0 ? Number((somaTop3 / totalGastos).toFixed(4)) : 0;
  return {
    categorias: categoriasTop3,
    totalGastos,
    indiceConcentracao
  };
}

function tendenciaGastos(mesAtual, saidasMesAtual, mediaSaidasMensal) {
  const variacaoPercentual = mediaSaidasMensal > 0 ? Number((((saidasMesAtual - mediaSaidasMensal) / mediaSaidasMensal) * 100).toFixed(2)) : 0;
  const direcao = variacaoPercentual >= 10 ? 'alta' : variacaoPercentual <= -10 ? 'baixa' : 'estavel';
  return {
    mesAtual,
    saidasMesAtual,
    media3Meses: mediaSaidasMensal,
    variacaoPercentual,
    direcao
  };
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
    // Fórmula documentada do grupo: saidas = mediaSaidas + parcelasDoMes.
    // As parcelas do cartão já podem estar contidas na janela-base (aproximação aceita).
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
  categoriasForaDaCurva,
  indiceEndividamento,
  runwayMeses,
  concentracaoGastos,
  tendenciaGastos
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

  if (Array.isArray(categoriasForaDaCurva)) {
    for (const cat of categoriasForaDaCurva) {
      dicas.push(`A categoria "${cat.nome}" gastou ${formatarNumero(cat.total)}, ${formatarNumero(cat.ratio * 100)}% acima da média de ${formatarNumero(cat.mediaAnterior)} dos 3 meses anteriores.`);
    }
  }

  const mesNegativo = projecao?.find(p => p.saldoPrevisto < 0);
  if (mesNegativo) {
    dicas.push(`Projeção indica saldo negativo de ${formatarNumero(mesNegativo.saldoPrevisto)} em ${mesNegativo.mes}.`);
  }

  if (indiceEndividamento > 0.15) {
    dicas.push(`Seu endividamento compromete ${(indiceEndividamento * 100).toFixed(2)}% da renda dos próximos 12 meses, acima do recomendado de 15%.`);
  }

  if (runwayMeses < 3) {
    dicas.push(`Seu saldo em contas cobre ${runwayMeses.toFixed(2)} meses de despesas (referência: 3 a 6 meses).`);
  }

  if (concentracaoGastos?.indiceConcentracao > 0.60) {
    dicas.push(`Suas 3 maiores categorias representam ${(concentracaoGastos.indiceConcentracao * 100).toFixed(2)}% das despesas do mês; considere diversificar.`);
  }

  if (tendenciaGastos?.direcao === 'alta') {
    dicas.push(`Suas despesas do mês estão ${tendenciaGastos.variacaoPercentual.toFixed(2)}% acima da média dos últimos 3 meses.`);
  }

  if (dicas.length === 0) {
    dicas.push('Sua taxa de poupança está acima de 10%, comprometimento com cartões abaixo de 30% e reserva superior a 3 meses. Parabéns!');
  }

  return dicas.slice(0, 8);
}

module.exports = {
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
};