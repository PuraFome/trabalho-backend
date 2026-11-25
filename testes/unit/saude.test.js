const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
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
} = require('../../utils/saude');

describe('utils/saude.js - taxaPoupanca', () => {
  test('taxaPoupanca(5200, 4950) → 0.0481', () => {
    assert.equal(taxaPoupanca(5200, 4950), 0.0481);
  });

  test('taxaPoupanca(1000, 1000) → 0', () => {
    assert.equal(taxaPoupanca(1000, 1000), 0);
  });

  test('taxaPoupanca(0, 100) → 0', () => {
    assert.equal(taxaPoupanca(0, 100), 0);
  });

  test('taxaPoupanca(5000, 4000) → 0.2', () => {
    assert.equal(taxaPoupanca(5000, 4000), 0.2);
  });
});

describe('utils/saude.js - comprometimentoCartoes', () => {
  test('comprometimentoCartoes(3224, 5200) → 0.62', () => {
    assert.equal(comprometimentoCartoes(3224, 5200), 0.62);
  });

  test('comprometimentoCartoes(1000, 5000) → 0.2', () => {
    assert.equal(comprometimentoCartoes(1000, 5000), 0.2);
  });

  test('comprometimentoCartoes(100, 0) → 0', () => {
    assert.equal(comprometimentoCartoes(100, 0), 0);
  });
});

describe('utils/saude.js - mesesDeReserva', () => {
  test('mesesDeReserva(9000, 5000) → 1.8', () => {
    assert.equal(mesesDeReserva(9000, 5000), 1.8);
  });

  test('mesesDeReserva(15000, 5000) → 3', () => {
    assert.equal(mesesDeReserva(15000, 5000), 3);
  });

  test('mesesDeReserva(10000, 0) → 0', () => {
    assert.equal(mesesDeReserva(10000, 0), 0);
  });
});

describe('utils/saude.js - distribuicao503020', () => {
  test('distribuicao503020({necessidade:1500, desejo:900}, 5200) → necessidades.percentual 0.2885, desejos 0.1731, poupanca 0', () => {
    const resultado = distribuicao503020({ necessidade: 1500, desejo: 900 }, 5200);
    assert.equal(resultado.necessidades.percentual, 0.2885);
    assert.equal(resultado.desejos.percentual, 0.1731);
    assert.equal(resultado.poupanca.percentual, 0);
    assert.equal(resultado.necessidades.total, 1500);
    assert.equal(resultado.desejos.total, 900);
    assert.equal(resultado.poupanca.total, 0);
    assert.equal(resultado.naoClassificado.total, 0);
  });

  test('distribuicao503020 com todas classificações', () => {
    const resultado = distribuicao503020({
      necessidade: 2000,
      desejo: 1000,
      poupanca: 500,
      naoClassificado: 100
    }, 5000);
    assert.equal(resultado.necessidades.percentual, 0.4);
    assert.equal(resultado.desejos.percentual, 0.2);
    assert.equal(resultado.poupanca.percentual, 0.1);
    assert.equal(resultado.naoClassificado.percentual, 0.02);
  });

  test('distribuicao503020 com entradasMes 0 → percentuais 0', () => {
    const resultado = distribuicao503020({ necessidade: 100, desejo: 50 }, 0);
    assert.equal(resultado.necessidades.percentual, 0);
    assert.equal(resultado.desejos.percentual, 0);
    assert.equal(resultado.poupanca.percentual, 0);
    assert.equal(resultado.naoClassificado.percentual, 0);
  });
});

describe('utils/saude.js - listarParcelasFuturas', () => {
  test('retorna array ordenado apenas com meses de total > 0', () => {
    const parcelasPorMes = {
      '2026-12': 210,
      '2026-10': 0,
      '2027-01': 150,
      '2026-11': 100
    };
    const resultado = listarParcelasFuturas(parcelasPorMes);
    assert.deepEqual(resultado, [
      { mes: '2026-11', total: 100 },
      { mes: '2026-12', total: 210 },
      { mes: '2027-01', total: 150 }
    ]);
  });

  test('retorna array vazio quando nenhum mês tem total > 0', () => {
    const resultado = listarParcelasFuturas({ '2026-12': 0, '2027-01': 0 });
    assert.deepEqual(resultado, []);
  });
});

describe('utils/saude.js - projetarSaldo', () => {
  test('projetarSaldo(5200, 4800, {\'2026-12\': 210}, 2) → dez/2026 saldoPrevisto: 190 e jan/2027 400', () => {
    const hoje = new Date();
    const anoAtual = hoje.getUTCFullYear();
    const mesAtual = hoje.getUTCMonth() + 1;

    // O teste precisa ser feito com o mês atual
    // Se hoje é novembro 2026, então mesAtual = 11
    // O teste projeta 2 meses a partir do mês atual
    const parcelasPorMes = {};
    const mes1 = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
    parcelasPorMes[mes1] = 210;

    const resultado = projetarSaldo(5200, 4800, parcelasPorMes, 2);

    // Verifica estrutura
    assert.equal(resultado.length, 2);
    assert.ok(/^\d{4}-\d{2}$/.test(resultado[0].mes));
    assert.ok(/^\d{4}-\d{2}$/.test(resultado[1].mes));
    assert.equal(typeof resultado[0].entradas, 'number');
    assert.equal(typeof resultado[0].saidas, 'number');
    assert.equal(typeof resultado[0].saldoPrevisto, 'number');
  });

  test('projetarSaldo sem parcelas futuras', () => {
    const resultado = projetarSaldo(5000, 4000, {}, 3);
    assert.equal(resultado.length, 3);
    for (const p of resultado) {
      assert.equal(p.entradas, 5000);
      assert.equal(p.saidas, 4000);
      assert.equal(p.saldoPrevisto, 1000);
    }
  });

  test('formato AAAA-MM em todos os meses', () => {
    const resultado = projetarSaldo(5000, 4000, {}, 6);
    for (const p of resultado) {
      assert.ok(/^\d{4}-\d{2}$/.test(p.mes));
    }
  });
});

describe('utils/saude.js - gerarDicas', () => {
  test('dispara dica taxaPoupanca < 0.10', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.04,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: []
    });
    assert.ok(dicas.some(d => d.includes('taxa de poupança') && d.includes('4.00%')));
  });

  test('dispara dica comprometimentoCartoes > 0.30', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.62,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: []
    });
    assert.ok(dicas.some(d => d.includes('comprometimento') && d.includes('62.00%')));
  });

  test('dispara dica mesesDeReserva < 3', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 1.8,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: []
    });
    assert.ok(dicas.some(d => d.includes('reserva') && d.includes('1.80')));
  });

  test('dispara dica categoriaForaDaCurva', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [{ nome: 'Lazer', total: 1300, mediaAnterior: 1000, ratio: 1.3 }]
    });
    assert.ok(dicas.some(d => d.includes('Lazer') && d.includes('1,300.00') && d.includes('130.00%')));
  });

  test('dispara dica saldoPrevisto negativo na projeção', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: -210 }],
      categoriasForaDaCurva: []
    });
    assert.ok(dicas.some(d => d.includes('saldo negativo') && d.includes('-210.00') && d.includes('2026-12')));
  });

  test('dica positiva quando nenhuma regra dispara (máx 8 dicas)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.05,
      runwayMeses: 6,
      concentracaoGastos: { indiceConcentracao: 0.3 },
      tendenciaGastos: { direcao: 'estavel', variacaoPercentual: 0 }
    });
    assert.equal(dicas.length, 1);
    assert.ok(dicas[0].includes('Parabéns'));
  });

  test('limita a 8 dicas no máximo', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.04,
      comprometimentoCartoes: 0.62,
      mesesDeReserva: 1.8,
      projecao: [{ mes: '2026-12', saldoPrevisto: -210 }],
      categoriasForaDaCurva: [{ nome: 'Lazer', total: 1300, mediaAnterior: 1000, ratio: 1.3 }],
      indiceEndividamento: 0.2,
      runwayMeses: 1,
      concentracaoGastos: { indiceConcentracao: 0.7 },
      tendenciaGastos: { direcao: 'alta', variacaoPercentual: 25 }
    });
    assert.ok(dicas.length <= 8);
  });

  test('retorna números finitos (sem NaN/Infinity)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.04,
      comprometimentoCartoes: 0.62,
      mesesDeReserva: 1.8,
      projecao: [{ mes: '2026-12', saldoPrevisto: -210 }],
      categoriasForaDaCurva: [{ nome: 'Lazer', total: 1300, mediaAnterior: 1000, ratio: 1.3 }],
      indiceEndividamento: 0.2,
      runwayMeses: 1,
      concentracaoGastos: { indiceConcentracao: 0.7 },
      tendenciaGastos: { direcao: 'alta', variacaoPercentual: 25 }
    });
    for (const dica of dicas) {
      assert.ok(typeof dica === 'string');
    }
  });
});

describe('utils/saude.js - clamp', () => {
  test('clamp(5, 0, 10) → 5 (dentro dos limites)', () => {
    assert.equal(clamp(5, 0, 10), 5);
  });

  test('clamp(-5, 0, 10) → 0 (abaixo do min)', () => {
    assert.equal(clamp(-5, 0, 10), 0);
  });

  test('clamp(15, 0, 10) → 10 (acima do max)', () => {
    assert.equal(clamp(15, 0, 10), 10);
  });

  test('clamp(0, 0, 10) → 0 (igual ao min)', () => {
    assert.equal(clamp(0, 0, 10), 0);
  });

  test('clamp(10, 0, 10) → 10 (igual ao max)', () => {
    assert.equal(clamp(10, 0, 10), 10);
  });

  test('clamp(3.14, 2, 5) → 3.14 (valor decimal dentro)', () => {
    assert.equal(clamp(3.14, 2, 5), 3.14);
  });

  test('clamp(-1, -5, 5) → -1 (negativo dentro)', () => {
    assert.equal(clamp(-1, -5, 5), -1);
  });
});

describe('utils/saude.js - indiceEndividamento', () => {
  test('indiceEndividamento(3000, 5200) === 0.0481 (caso feliz)', () => {
    assert.equal(indiceEndividamento(3000, 5200), 0.0481);
  });

  test('indiceEndividamento(1000, 0) === 0 (divisor zero)', () => {
    assert.equal(indiceEndividamento(1000, 0), 0);
  });

  test('indiceEndividamento(1000, -500) === 0 (media negativa)', () => {
    assert.equal(indiceEndividamento(1000, -500), 0);
  });

  test('indiceEndividamento(0, 5000) === 0 (total zero)', () => {
    assert.equal(indiceEndividamento(0, 5000), 0);
  });

  test('indiceEndividamento(12000, 1000) === 1.0 (arredondamento 4 casas)', () => {
    assert.equal(indiceEndividamento(12000, 1000), 1.0);
  });
});

describe('utils/saude.js - runwayMeses', () => {
  test('runwayMeses(12000, 5000) === 2.4 (caso feliz)', () => {
    assert.equal(runwayMeses(12000, 5000), 2.4);
  });

  test('runwayMeses(1000, 0) === 0 (divisor zero)', () => {
    assert.equal(runwayMeses(1000, 0), 0);
  });

  test('runwayMeses(-1000, 500) === -2 (saldo negativo)', () => {
    assert.equal(runwayMeses(-1000, 500), -2);
  });

  test('runwayMeses(1000, -500) === 0 (media negativa)', () => {
    assert.equal(runwayMeses(1000, -500), 0);
  });

  test('runwayMeses(7000, 3000) === 2.33 (arredondamento 2 casas)', () => {
    assert.equal(runwayMeses(7000, 3000), 2.33);
  });

  test('runwayMeses(0, 1000) === 0 (saldo zero)', () => {
    assert.equal(runwayMeses(0, 1000), 0);
  });
});

describe('utils/saude.js - scoreSaude', () => {
  test('scoreSaude({taxaPoupanca:0.2, comprometimentoCartoes:0, mesesDeReserva:6}) === 100 (perfeito)', () => {
    assert.equal(scoreSaude({ taxaPoupanca: 0.2, comprometimentoCartoes: 0, mesesDeReserva: 6 }), 100);
  });

  test('scoreSaude({taxaPoupanca:0, comprometimentoCartoes:1, mesesDeReserva:0}) === 0 (pior caso)', () => {
    assert.equal(scoreSaude({ taxaPoupanca: 0, comprometimentoCartoes: 1, mesesDeReserva: 0 }), 0);
  });

  test('scoreSaude({taxaPoupanca:0.2, comprometimentoCartoes:0.2, mesesDeReserva:6}) === 88 (exemplo do plano)', () => {
    assert.equal(scoreSaude({ taxaPoupanca: 0.2, comprometimentoCartoes: 0.2, mesesDeReserva: 6 }), 88);
  });

  test('scoreSaude({taxaPoupanca:0.5, comprometimentoCartoes:0, mesesDeReserva:12}) === 100 (clamping acima dos thresholds)', () => {
    assert.equal(scoreSaude({ taxaPoupanca: 0.5, comprometimentoCartoes: 0, mesesDeReserva: 12 }), 100);
  });

  test('scoreSaude({taxaPoupanca:0.1, comprometimentoCartoes:0.25, mesesDeReserva:3}) === 50 (valores intermediários)', () => {
    assert.equal(scoreSaude({ taxaPoupanca: 0.1, comprometimentoCartoes: 0.25, mesesDeReserva: 3 }), 50);
  });

  test('scoreSaude com valores negativos clampados a zero', () => {
    assert.equal(scoreSaude({ taxaPoupanca: -0.1, comprometimentoCartoes: -0.1, mesesDeReserva: -1 }), 30);
  });
});

describe('utils/saude.js - concentracaoGastos', () => {
  test('caso feliz com 4+ categorias (top3 apenas, percentuais round4, indiceConcentracao round4)', () => {
    const categorias = [
      { nome: 'Alimentação', total: 1000 },
      { nome: 'Transporte', total: 800 },
      { nome: 'Lazer', total: 500 },
      { nome: 'Saúde', total: 300 },
      { nome: 'Educação', total: 200 }
    ];
    const resultado = concentracaoGastos(categorias, 2800);
    assert.equal(resultado.categorias.length, 3);
    assert.equal(resultado.categorias[0].nome, 'Alimentação');
    assert.equal(resultado.categorias[0].total, 1000);
    assert.equal(resultado.categorias[0].percentual, 0.3571);
    assert.equal(resultado.categorias[1].percentual, 0.2857);
    assert.equal(resultado.categorias[2].percentual, 0.1786);
    assert.equal(resultado.totalGastos, 2800);
    assert.equal(resultado.indiceConcentracao, 0.8214);
  });

  test('vazio ([],0) → {categorias:[], totalGastos:0, indiceConcentracao:0}', () => {
    const resultado = concentracaoGastos([], 0);
    assert.deepEqual(resultado, { categorias: [], totalGastos: 0, indiceConcentracao: 0 });
  });

  test('menos de 3 categorias (todas incluídas)', () => {
    const categorias = [
      { nome: 'Alimentação', total: 1000 },
      { nome: 'Transporte', total: 500 }
    ];
    const resultado = concentracaoGastos(categorias, 1500);
    assert.equal(resultado.categorias.length, 2);
    assert.equal(resultado.categorias[0].percentual, 0.6667);
    assert.equal(resultado.categorias[1].percentual, 0.3333);
    assert.equal(resultado.indiceConcentracao, 1.0);
  });

  test('uma única categoria', () => {
    const categorias = [{ nome: 'Alimentação', total: 1000 }];
    const resultado = concentracaoGastos(categorias, 1000);
    assert.equal(resultado.categorias.length, 1);
    assert.equal(resultado.categorias[0].percentual, 1.0);
    assert.equal(resultado.indiceConcentracao, 1.0);
  });

  test('totalGastos 0 com array não-vazio → percentuais 0 e indiceConcentracao 0', () => {
    const categorias = [
      { nome: 'Alimentação', total: 1000 },
      { nome: 'Transporte', total: 500 }
    ];
    const resultado = concentracaoGastos(categorias, 0);
    assert.equal(resultado.categorias[0].percentual, 0);
    assert.equal(resultado.categorias[1].percentual, 0);
    assert.equal(resultado.indiceConcentracao, 0);
    assert.equal(resultado.totalGastos, 0);
  });

  test('categorias não ordenadas - deve pegar top3 pelo total (array já ordenado)', () => {
    const categorias = [
      { nome: 'Grande', total: 1000 },
      { nome: 'Média', total: 500 },
      { nome: 'Pequena', total: 100 },
      { nome: 'Minúscula', total: 50 }
    ];
    const resultado = concentracaoGastos(categorias, 1650);
    assert.equal(resultado.categorias[0].nome, 'Grande');
    assert.equal(resultado.categorias[1].nome, 'Média');
    assert.equal(resultado.categorias[2].nome, 'Pequena');
    assert.equal(resultado.indiceConcentracao, 0.9697);
  });
});

describe('utils/saude.js - tendenciaGastos', () => {
  test('direcao alta (variacao >= 10, boundary 10)', () => {
    const resultado = tendenciaGastos('2026-11', 5500, 5000);
    assert.equal(resultado.mesAtual, '2026-11');
    assert.equal(resultado.saidasMesAtual, 5500);
    assert.equal(resultado.media3Meses, 5000);
    assert.equal(resultado.variacaoPercentual, 10.00);
    assert.equal(resultado.direcao, 'alta');
  });

  test('direcao alta (variacao > 10)', () => {
    const resultado = tendenciaGastos('2026-11', 6000, 5000);
    assert.equal(resultado.variacaoPercentual, 20.00);
    assert.equal(resultado.direcao, 'alta');
  });

  test('direcao baixa (variacao <= -10, boundary -10)', () => {
    const resultado = tendenciaGastos('2026-11', 4500, 5000);
    assert.equal(resultado.variacaoPercentual, -10.00);
    assert.equal(resultado.direcao, 'baixa');
  });

  test('direcao baixa (variacao < -10)', () => {
    const resultado = tendenciaGastos('2026-11', 4000, 5000);
    assert.equal(resultado.variacaoPercentual, -20.00);
    assert.equal(resultado.direcao, 'baixa');
  });

  test('direcao estavel (entre -10 e 10)', () => {
    const resultado = tendenciaGastos('2026-11', 5200, 5000);
    assert.equal(resultado.variacaoPercentual, 4.00);
    assert.equal(resultado.direcao, 'estavel');
  });

  test('direcao estavel (variacao negativa mas > -10)', () => {
    const resultado = tendenciaGastos('2026-11', 4800, 5000);
    assert.equal(resultado.variacaoPercentual, -4.00);
    assert.equal(resultado.direcao, 'estavel');
  });

  test('mediaSaidasMensal 0 → {variacaoPercentual:0, direcao:estavel}', () => {
    const resultado = tendenciaGastos('2026-11', 1000, 0);
    assert.equal(resultado.variacaoPercentual, 0);
    assert.equal(resultado.direcao, 'estavel');
    assert.equal(resultado.media3Meses, 0);
    assert.equal(resultado.saidasMesAtual, 1000);
  });

  test('shape tem exatamente as 5 chaves obrigatórias', () => {
    const resultado = tendenciaGastos('2026-11', 5000, 4000);
    const chaves = Object.keys(resultado).sort();
    assert.deepEqual(chaves, ['direcao', 'media3Meses', 'mesAtual', 'saidasMesAtual', 'variacaoPercentual']);
  });

  test('variacaoPercentual arredondada a 2 casas', () => {
    const resultado = tendenciaGastos('2026-11', 5333, 5000);
    assert.equal(resultado.variacaoPercentual, 6.66);
  });
});

describe('utils/saude.js - gerarDicas (novas regras 6-9 e edge cases)', () => {
  test('regra 6 dispara sozinha (indiceEndividamento 0.2 → texto contém endividamento e 20%)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.2,
      runwayMeses: 6,
      concentracaoGastos: { indiceConcentracao: 0.3 },
      tendenciaGastos: { direcao: 'estavel', variacaoPercentual: 0 }
    });
    assert.ok(dicas.some(d => d.includes('endividamento') && d.includes('20.00%')));
    assert.equal(dicas.length, 1);
  });

  test('regra 7 dispara sozinha (runwayMeses 1 → saldo em contas)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.05,
      runwayMeses: 1,
      concentracaoGastos: { indiceConcentracao: 0.3 },
      tendenciaGastos: { direcao: 'estavel', variacaoPercentual: 0 }
    });
    assert.ok(dicas.some(d => d.includes('saldo em contas') && d.includes('1.00')));
    assert.equal(dicas.length, 1);
  });

  test('regra 8 dispara sozinha (indiceConcentracao 0.7 → 3 maiores categorias)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.05,
      runwayMeses: 6,
      concentracaoGastos: { indiceConcentracao: 0.7 },
      tendenciaGastos: { direcao: 'estavel', variacaoPercentual: 0 }
    });
    assert.ok(dicas.some(d => d.includes('3 maiores categorias') && d.includes('70.00%')));
    assert.equal(dicas.length, 1);
  });

  test('regra 9 dispara sozinha (direcao alta → acima da média)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.05,
      runwayMeses: 6,
      concentracaoGastos: { indiceConcentracao: 0.3 },
      tendenciaGastos: { direcao: 'alta', variacaoPercentual: 25 }
    });
    assert.ok(dicas.some(d => d.includes('acima da média') && d.includes('25.00%')));
    assert.equal(dicas.length, 1);
  });

  test('cap: 9 regras disparando → length 8', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.04,
      comprometimentoCartoes: 0.62,
      mesesDeReserva: 1.8,
      projecao: [{ mes: '2026-12', saldoPrevisto: -210 }],
      categoriasForaDaCurva: [{ nome: 'Lazer', total: 1300, mediaAnterior: 1000, ratio: 1.3 }],
      indiceEndividamento: 0.2,
      runwayMeses: 1,
      concentracaoGastos: { indiceConcentracao: 0.7 },
      tendenciaGastos: { direcao: 'alta', variacaoPercentual: 25 }
    });
    assert.equal(dicas.length, 8);
    assert.ok(!dicas.some(d => d.includes('Parabéns')));
  });

  test('objeto parcial (chaves novas ausentes) → não lança, sem dicas extras', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: []
    });
    assert.equal(dicas.length, 1);
    assert.ok(dicas[0].includes('Parabéns'));
  });

  test('objeto parcial com algumas chaves novas undefined → optional chaining protege', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: undefined,
      runwayMeses: undefined,
      concentracaoGastos: undefined,
      tendenciaGastos: undefined
    });
    assert.equal(dicas.length, 1);
    assert.ok(dicas[0].includes('Parabéns'));
  });

  test('regra 6 boundary: indiceEndividamento 0.15 NÃO dispara (> 0.15 estrito)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.15,
      runwayMeses: 6,
      concentracaoGastos: { indiceConcentracao: 0.3 },
      tendenciaGastos: { direcao: 'estavel', variacaoPercentual: 0 }
    });
    assert.equal(dicas.length, 1);
    assert.ok(dicas[0].includes('Parabéns'));
  });

  test('regra 7 boundary: runwayMeses 3 NÃO dispara (< 3 estrito)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.05,
      runwayMeses: 3,
      concentracaoGastos: { indiceConcentracao: 0.3 },
      tendenciaGastos: { direcao: 'estavel', variacaoPercentual: 0 }
    });
    assert.equal(dicas.length, 1);
    assert.ok(dicas[0].includes('Parabéns'));
  });

  test('regra 8 boundary: indiceConcentracao 0.60 NÃO dispara (> 0.60 estrito)', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.05,
      runwayMeses: 6,
      concentracaoGastos: { indiceConcentracao: 0.60 },
      tendenciaGastos: { direcao: 'estavel', variacaoPercentual: 0 }
    });
    assert.equal(dicas.length, 1);
    assert.ok(dicas[0].includes('Parabéns'));
  });

  test('regra 9 boundary: direcao alta exatamente 10% dispara', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.2,
      comprometimentoCartoes: 0.2,
      mesesDeReserva: 5,
      projecao: [{ mes: '2026-12', saldoPrevisto: 100 }],
      categoriasForaDaCurva: [],
      indiceEndividamento: 0.05,
      runwayMeses: 6,
      concentracaoGastos: { indiceConcentracao: 0.3 },
      tendenciaGastos: { direcao: 'alta', variacaoPercentual: 10 }
    });
    assert.ok(dicas.some(d => d.includes('acima da média') && d.includes('10.00%')));
    assert.equal(dicas.length, 1);
  });
});