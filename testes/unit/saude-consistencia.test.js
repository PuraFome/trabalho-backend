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

const CASAS_RATIO = 4;
const CASAS_MESES = 2;

function assertArredondado(valor, casas) {
  assert.equal(valor, Number(valor.toFixed(casas)));
}

function assertNumerosFinitos(valor) {
  if (typeof valor === 'number') {
    assert.ok(Number.isFinite(valor), `valor não finito: ${valor}`);
    return;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) assertNumerosFinitos(item);
    return;
  }
  if (valor !== null && typeof valor === 'object') {
    for (const item of Object.values(valor)) assertNumerosFinitos(item);
  }
}

function assertPuro(fn, args) {
  const snapshot = structuredClone(args);
  const primeira = fn(...args);
  const segunda = fn(...args);
  assert.deepEqual(segunda, primeira);
  assert.deepEqual(args, snapshot);
  return primeira;
}

describe('utils/saude.js - consistência: pureza e determinismo', () => {
  test('taxaPoupanca é determinística e não muta argumentos', () => {
    assertPuro(taxaPoupanca, [5200, 4950]);
  });

  test('comprometimentoCartoes é determinística e não muta argumentos', () => {
    assertPuro(comprometimentoCartoes, [3224, 5200]);
  });

  test('mesesDeReserva é determinística e não muta argumentos', () => {
    assertPuro(mesesDeReserva, [9000, 5000]);
  });

  test('distribuicao503020 é determinística e não muta a entrada', () => {
    assertPuro(distribuicao503020, [
      { necessidade: 1500, desejo: 900, poupanca: 300, naoClassificado: 100 },
      5200
    ]);
  });

  test('listarParcelasFuturas é determinística e não muta a entrada', () => {
    assertPuro(listarParcelasFuturas, [
      { '2026-12': 210, '2026-10': 0, '2027-01': 150, '2026-11': 100 }
    ]);
  });

  test('projetarSaldo é determinística e não muta a entrada', () => {
    assertPuro(projetarSaldo, [5200, 4800, { '2026-12': 210 }, 3]);
  });

  test('gerarDicas é determinística e não muta a entrada', () => {
    assertPuro(gerarDicas, [{
      taxaPoupanca: 0.04,
      comprometimentoCartoes: 0.62,
      mesesDeReserva: 1.8,
      projecao: [{ mes: '2026-12', saldoPrevisto: -210 }],
      categoriasForaDaCurva: [{ nome: 'Lazer', total: 1300, mediaAnterior: 1000, ratio: 1.3 }],
      indiceEndividamento: 0.2,
      runwayMeses: 1,
      concentracaoGastos: { indiceConcentracao: 0.7 },
      tendenciaGastos: { direcao: 'alta', variacaoPercentual: 25 }
    }]);
  });

  test('clamp é determinística e não muta argumentos', () => {
    assertPuro(clamp, [5, 0, 10]);
  });

  test('indiceEndividamento é determinística e não muta argumentos', () => {
    assertPuro(indiceEndividamento, [3000, 5200]);
  });

  test('runwayMeses é determinística e não muta argumentos', () => {
    assertPuro(runwayMeses, [12000, 5000]);
  });

  test('scoreSaude é determinística e não muta a entrada', () => {
    assertPuro(scoreSaude, [{ taxaPoupanca: 0.2, comprometimentoCartoes: 0.2, mesesDeReserva: 6 }]);
  });

  test('concentracaoGastos é determinística e não muta a entrada', () => {
    assertPuro(concentracaoGastos, [
      [
        { nome: 'Alimentação', total: 1000 },
        { nome: 'Transporte', total: 800 },
        { nome: 'Lazer', total: 500 },
        { nome: 'Saúde', total: 300 }
      ],
      2600
    ]);
  });

  test('tendenciaGastos é determinística e não muta argumentos', () => {
    assertPuro(tendenciaGastos, ['2026-11', 5500, 5000]);
  });
});

describe('utils/saude.js - consistência: finitude (sem NaN/Infinity)', () => {
  const VALORES = [0, -1, -1000, 0.0001, 123.456, 1e15];

  test('taxaPoupanca permanece finita na matriz de entradas', () => {
    for (const entradas of VALORES) {
      for (const saidas of VALORES) {
        assertNumerosFinitos(taxaPoupanca(entradas, saidas));
      }
    }
  });

  test('comprometimentoCartoes permanece finito na matriz de entradas', () => {
    for (const totalFaturas of VALORES) {
      for (const mediaEntradas of VALORES) {
        assertNumerosFinitos(comprometimentoCartoes(totalFaturas, mediaEntradas));
      }
    }
  });

  test('mesesDeReserva permanece finito na matriz de entradas', () => {
    for (const saldoReserva of VALORES) {
      for (const mediaSaidas of VALORES) {
        assertNumerosFinitos(mesesDeReserva(saldoReserva, mediaSaidas));
      }
    }
  });

  test('indiceEndividamento permanece finito na matriz de entradas', () => {
    for (const totalParcelasFuturas of VALORES) {
      for (const mediaEntradasMensal of VALORES) {
        assertNumerosFinitos(indiceEndividamento(totalParcelasFuturas, mediaEntradasMensal));
      }
    }
  });

  test('runwayMeses permanece finito na matriz de entradas', () => {
    for (const saldoContas of VALORES) {
      for (const mediaSaidasMensal of VALORES) {
        assertNumerosFinitos(runwayMeses(saldoContas, mediaSaidasMensal));
      }
    }
  });

  test('clamp permanece finito na matriz de entradas', () => {
    for (const n of VALORES) {
      assertNumerosFinitos(clamp(n, -1e15, 1e15));
    }
  });

  test('scoreSaude permanece finito e inteiro na matriz de entradas', () => {
    for (const tp of VALORES) {
      for (const cc of VALORES) {
        for (const mr of VALORES) {
          const score = scoreSaude({
            taxaPoupanca: tp,
            comprometimentoCartoes: cc,
            mesesDeReserva: mr
          });
          assertNumerosFinitos(score);
          assert.ok(Number.isInteger(score));
        }
      }
    }
  });

  test('distribuicao503020 permanece finita na matriz de entradas', () => {
    for (const entradasMes of VALORES) {
      for (const valor of VALORES) {
        const resultado = distribuicao503020({
          necessidade: valor,
          desejo: -valor,
          poupanca: valor / 2,
          naoClassificado: 0
        }, entradasMes);
        assertNumerosFinitos(resultado);
      }
    }
  });

  test('listarParcelasFuturas permanece finito na matriz de entradas', () => {
    for (const valor of VALORES) {
      assertNumerosFinitos(listarParcelasFuturas({
        '2026-11': valor,
        '2026-12': -valor
      }));
    }
  });

  test('projetarSaldo permanece finito na matriz de entradas', () => {
    const hoje = new Date();
    const chaveMesAtual = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`;
    for (const entradas of VALORES) {
      for (const saidas of VALORES) {
        assertNumerosFinitos(projetarSaldo(entradas, saidas, { [chaveMesAtual]: entradas }, 3));
      }
    }
  });

  test('gerarDicas permanece finito e retorna apenas strings não vazias na matriz de entradas', () => {
    for (const valor of VALORES) {
      const dicas = gerarDicas({
        taxaPoupanca: valor,
        comprometimentoCartoes: valor,
        mesesDeReserva: valor,
        projecao: [{ mes: '2026-12', saldoPrevisto: valor }],
        categoriasForaDaCurva: [{ nome: 'Teste', total: valor, mediaAnterior: valor, ratio: valor }],
        indiceEndividamento: valor,
        runwayMeses: valor,
        concentracaoGastos: { indiceConcentracao: valor },
        tendenciaGastos: { direcao: 'alta', variacaoPercentual: valor }
      });
      for (const dica of dicas) {
        assert.equal(typeof dica, 'string');
        assert.ok(dica.length > 0);
      }
    }
  });

  test('concentracaoGastos permanece finita na matriz de entradas', () => {
    for (const totalGastos of VALORES) {
      for (const valor of VALORES) {
        assertNumerosFinitos(concentracaoGastos([
          { nome: 'A', total: valor },
          { nome: 'B', total: -valor },
          { nome: 'C', total: valor / 2 },
          { nome: 'D', total: 0 }
        ], totalGastos));
      }
    }
  });

  test('tendenciaGastos permanece finita na matriz de entradas', () => {
    for (const saidasMesAtual of VALORES) {
      for (const mediaSaidasMensal of VALORES) {
        assertNumerosFinitos(tendenciaGastos('2026-11', saidasMesAtual, mediaSaidasMensal));
      }
    }
  });

  test('estruturas vazias permanecem finitas e bem formadas', () => {
    assertNumerosFinitos(distribuicao503020({}, 0));
    assert.deepEqual(listarParcelasFuturas({}), []);
    assertNumerosFinitos(concentracaoGastos([], 0));
    assert.deepEqual(projetarSaldo(0, 0, {}, 0), []);
    assertNumerosFinitos(projetarSaldo(0, 0, {}, 3));
    assertNumerosFinitos(scoreSaude({ taxaPoupanca: 0, comprometimentoCartoes: 0, mesesDeReserva: 0 }));
  });
});

describe('utils/saude.js - consistência: arredondamento', () => {
  test('taxaPoupanca arredonda para 4 casas', () => {
    const resultado = taxaPoupanca(3, 1);
    assert.equal(resultado, 0.6667);
    assertArredondado(resultado, CASAS_RATIO);
  });

  test('comprometimentoCartoes arredonda para 4 casas', () => {
    const resultado = comprometimentoCartoes(1, 3);
    assert.equal(resultado, 0.3333);
    assertArredondado(resultado, CASAS_RATIO);
  });

  test('indiceEndividamento arredonda para 4 casas', () => {
    const resultado = indiceEndividamento(1, 3);
    assert.equal(resultado, 0.0278);
    assertArredondado(resultado, CASAS_RATIO);
  });

  test('mesesDeReserva arredonda para 2 casas', () => {
    const resultado = mesesDeReserva(1, 3);
    assert.equal(resultado, 0.33);
    assertArredondado(resultado, CASAS_MESES);
  });

  test('runwayMeses arredonda para 2 casas', () => {
    const resultado = runwayMeses(1, 3);
    assert.equal(resultado, 0.33);
    assertArredondado(resultado, CASAS_MESES);
  });

  test('distribuicao503020 arredonda percentuais para 4 casas', () => {
    const resultado = distribuicao503020({
      necessidade: 1,
      desejo: 2,
      poupanca: 3,
      naoClassificado: 4
    }, 7);
    assert.equal(resultado.necessidades.percentual, 0.1429);
    assert.equal(resultado.desejos.percentual, 0.2857);
    assert.equal(resultado.poupanca.percentual, 0.4286);
    assert.equal(resultado.naoClassificado.percentual, 0.5714);
    for (const chave of ['necessidades', 'desejos', 'poupanca', 'naoClassificado']) {
      assertArredondado(resultado[chave].percentual, CASAS_RATIO);
    }
  });

  test('concentracaoGastos arredonda percentuais e índice para 4 casas', () => {
    const resultado = concentracaoGastos([
      { nome: 'A', total: 1 },
      { nome: 'B', total: 2 },
      { nome: 'C', total: 3 }
    ], 7);
    assert.equal(resultado.categorias[0].percentual, 0.1429);
    assert.equal(resultado.categorias[1].percentual, 0.2857);
    assert.equal(resultado.categorias[2].percentual, 0.4286);
    assert.equal(resultado.indiceConcentracao, 0.8571);
    for (const categoria of resultado.categorias) {
      assertArredondado(categoria.percentual, CASAS_RATIO);
    }
    assertArredondado(resultado.indiceConcentracao, CASAS_RATIO);
  });

  test('projetarSaldo arredonda valores monetários para 2 casas', () => {
    const resultado = projetarSaldo(1, 2 / 3, {}, 1);
    assert.equal(resultado[0].entradas, 1);
    assert.equal(resultado[0].saidas, 0.67);
    assert.equal(resultado[0].saldoPrevisto, 0.33);
    assertArredondado(resultado[0].entradas, CASAS_MESES);
    assertArredondado(resultado[0].saidas, CASAS_MESES);
    assertArredondado(resultado[0].saldoPrevisto, CASAS_MESES);
  });

  test('tendenciaGastos arredonda variacaoPercentual para 2 casas', () => {
    const resultado = tendenciaGastos('2026-11', 5333, 5000);
    assert.equal(resultado.variacaoPercentual, 6.66);
    assertArredondado(resultado.variacaoPercentual, CASAS_MESES);
  });
});

describe('utils/saude.js - consistência: coerência entre indicadores', () => {
  test('scoreSaude é inteiro em [0,100] e igual à recomposição a partir dos indicadores', () => {
    const cenarios = [
      { entradas: 5200, saidas: 4950, totalFaturas: 3224, mediaEntradas: 5200, saldoReserva: 9000, mediaSaidas: 5000 },
      { entradas: 10000, saidas: 12000, totalFaturas: 1000, mediaEntradas: 10000, saldoReserva: 0, mediaSaidas: 4000 },
      { entradas: 0, saidas: 100, totalFaturas: 500, mediaEntradas: 0, saldoReserva: 1000, mediaSaidas: 0 },
      { entradas: 1e9, saidas: 1e9 - 1, totalFaturas: 1e8, mediaEntradas: 1e9, saldoReserva: 1e10, mediaSaidas: 1e9 }
    ];

    for (const cenario of cenarios) {
      const tp = taxaPoupanca(cenario.entradas, cenario.saidas);
      const cc = comprometimentoCartoes(cenario.totalFaturas, cenario.mediaEntradas);
      const mr = mesesDeReserva(cenario.saldoReserva, cenario.mediaSaidas);
      const score = scoreSaude({
        taxaPoupanca: tp,
        comprometimentoCartoes: cc,
        mesesDeReserva: mr
      });
      const esperado = Math.round(
        clamp(tp / 0.20, 0, 1) * 40 +
        clamp(1 - cc / 0.50, 0, 1) * 30 +
        clamp(mr / 6, 0, 1) * 30
      );

      assert.ok(Number.isInteger(score));
      assert.ok(score >= 0 && score <= 100);
      assert.equal(score, esperado);
    }
  });

  test('distribuicao503020: percentuais = total/entradasMes e soma dos totais preservada', () => {
    const entrada = { necessidade: 1500, desejo: 900, poupanca: 300, naoClassificado: 100 };
    const entradasMes = 5200;
    const resultado = distribuicao503020(entrada, entradasMes);
    const chaves = [
      ['necessidades', 'necessidade'],
      ['desejos', 'desejo'],
      ['poupanca', 'poupanca'],
      ['naoClassificado', 'naoClassificado']
    ];

    let somaTotais = 0;
    let somaEntrada = 0;
    for (const [saida, origem] of chaves) {
      assert.equal(resultado[saida].total, entrada[origem]);
      assert.equal(resultado[saida].percentual, Number((entrada[origem] / entradasMes).toFixed(4)));
      somaTotais += resultado[saida].total;
      somaEntrada += entrada[origem];
    }
    assert.equal(somaTotais, somaEntrada);
  });

  test('listarParcelasFuturas: ordenado, apenas total > 0 e valores iguais ao mapa', () => {
    const parcelas = {
      '2027-01': 150,
      '2026-10': 0,
      '2026-12': 210,
      '2026-11': 100,
      '2027-02': -50
    };
    const resultado = listarParcelasFuturas(parcelas);

    assert.deepEqual(resultado.map(p => p.mes), ['2026-11', '2026-12', '2027-01']);
    for (const item of resultado) {
      assert.ok(item.total > 0);
      assert.equal(item.total, Number(parcelas[item.mes]));
    }
    for (let i = 1; i < resultado.length; i++) {
      assert.ok(resultado[i - 1].mes < resultado[i].mes);
    }
  });

  test('concentracaoGastos: top3 é prefixo, percentuais e índice coerentes', () => {
    const categorias = [
      { nome: 'A', total: 1000 },
      { nome: 'B', total: 800 },
      { nome: 'C', total: 500 },
      { nome: 'D', total: 300 },
      { nome: 'E', total: 200 }
    ];
    const totalGastos = 2800;
    const resultado = concentracaoGastos(categorias, totalGastos);

    assert.equal(resultado.categorias.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.equal(resultado.categorias[i].nome, categorias[i].nome);
      assert.equal(resultado.categorias[i].total, categorias[i].total);
      assert.equal(
        resultado.categorias[i].percentual,
        Number((categorias[i].total / totalGastos).toFixed(4))
      );
    }

    const somaTop3 = categorias.slice(0, 3).reduce((soma, categoria) => soma + categoria.total, 0);
    assert.equal(resultado.indiceConcentracao, Number((somaTop3 / totalGastos).toFixed(4)));
  });

  test('tendenciaGastos: direção é função exata dos limites de variação', () => {
    const media = 5000;
    const casos = [
      { saidas: 5500, variacao: 10, direcao: 'alta' },
      { saidas: 5501, variacao: 10.02, direcao: 'alta' },
      { saidas: 5499, variacao: 9.98, direcao: 'estavel' },
      { saidas: 4500, variacao: -10, direcao: 'baixa' },
      { saidas: 4499, variacao: -10.02, direcao: 'baixa' },
      { saidas: 4501, variacao: -9.98, direcao: 'estavel' },
      { saidas: 5000, variacao: 0, direcao: 'estavel' }
    ];

    for (const caso of casos) {
      const resultado = tendenciaGastos('2026-11', caso.saidas, media);
      assert.equal(resultado.variacaoPercentual, caso.variacao);
      assert.equal(resultado.direcao, caso.direcao);
      const esperado = resultado.variacaoPercentual >= 10
        ? 'alta'
        : resultado.variacaoPercentual <= -10
          ? 'baixa'
          : 'estavel';
      assert.equal(resultado.direcao, esperado);
    }
  });
});

describe('utils/saude.js - consistência: gerarDicas', () => {
  test('nunca retorna mais de 8 dicas e todas são strings não vazias', () => {
    const dicas = gerarDicas({
      taxaPoupanca: 0.04,
      comprometimentoCartoes: 0.62,
      mesesDeReserva: 1.8,
      projecao: [{ mes: '2026-12', saldoPrevisto: -210 }],
      categoriasForaDaCurva: Array.from({ length: 10 }, (_, i) => ({
        nome: `Categoria ${i}`,
        total: 1300,
        mediaAnterior: 1000,
        ratio: 1.3
      })),
      indiceEndividamento: 0.2,
      runwayMeses: 1,
      concentracaoGastos: { indiceConcentracao: 0.7 },
      tendenciaGastos: { direcao: 'alta', variacaoPercentual: 25 }
    });

    assert.ok(dicas.length <= 8);
    for (const dica of dicas) {
      assert.equal(typeof dica, 'string');
      assert.ok(dica.length > 0);
    }
  });

  test('é determinística para a mesma entrada', () => {
    const entrada = {
      taxaPoupanca: 0.04,
      comprometimentoCartoes: 0.62,
      mesesDeReserva: 1.8,
      projecao: [{ mes: '2026-12', saldoPrevisto: -210 }],
      categoriasForaDaCurva: [{ nome: 'Lazer', total: 1300, mediaAnterior: 1000, ratio: 1.3 }],
      indiceEndividamento: 0.2,
      runwayMeses: 1,
      concentracaoGastos: { indiceConcentracao: 0.7 },
      tendenciaGastos: { direcao: 'alta', variacaoPercentual: 25 }
    };

    assert.deepEqual(gerarDicas(entrada), gerarDicas(entrada));
  });

  test('sem limiares disparados retorna exatamente a mensagem positiva', () => {
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

    assert.deepEqual(dicas, [
      'Sua taxa de poupança está acima de 10%, comprometimento com cartões abaixo de 30% e reserva superior a 3 meses. Parabéns!'
    ]);
  });
});

describe('utils/saude.js - consistência: casos extremos', () => {
  test('divisores zero retornam 0 sem lançar', () => {
    assert.equal(taxaPoupanca(0, 0), 0);
    assert.equal(comprometimentoCartoes(0, 0), 0);
    assert.equal(mesesDeReserva(0, 0), 0);
    assert.equal(indiceEndividamento(0, 0), 0);
    assert.equal(runwayMeses(0, 0), 0);

    const tendencia = tendenciaGastos('2026-11', 0, 0);
    assert.equal(tendencia.variacaoPercentual, 0);
    assert.equal(tendencia.direcao, 'estavel');
  });

  test('estruturas vazias retornam estruturas bem formadas e finitas', () => {
    const distribuicao = distribuicao503020({}, 0);
    assert.deepEqual(distribuicao, {
      necessidades: { total: 0, percentual: 0 },
      desejos: { total: 0, percentual: 0 },
      poupanca: { total: 0, percentual: 0 },
      naoClassificado: { total: 0, percentual: 0 }
    });
    assertNumerosFinitos(distribuicao);

    assert.deepEqual(listarParcelasFuturas({}), []);
    assert.deepEqual(concentracaoGastos([], 0), {
      categorias: [],
      totalGastos: 0,
      indiceConcentracao: 0
    });
    assert.deepEqual(projetarSaldo(0, 0, {}, 0), []);
    assertNumerosFinitos(projetarSaldo(0, 0, {}, 3));
  });

  test('distribuicao503020 com entradasMes 0 preserva totais e zera percentuais', () => {
    const resultado = distribuicao503020({
      necessidade: 100,
      desejo: 50,
      poupanca: 25,
      naoClassificado: 10
    }, 0);

    assert.equal(resultado.necessidades.total, 100);
    assert.equal(resultado.desejos.total, 50);
    assert.equal(resultado.poupanca.total, 25);
    assert.equal(resultado.naoClassificado.total, 10);
    for (const chave of ['necessidades', 'desejos', 'poupanca', 'naoClassificado']) {
      assert.equal(resultado[chave].percentual, 0);
    }
  });

  test('gerarDicas({}) não lança e retorna a mensagem positiva', () => {
    const dicas = gerarDicas({});
    assert.equal(dicas.length, 1);
    assert.ok(dicas[0].includes('Parabéns'));
  });
});
