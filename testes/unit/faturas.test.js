const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { calcularFatura } = require('../../utils/faturas');

describe('utils/faturas.js - calcularFatura', () => {
  // Tabela 11.3 do enunciado - casos obrigatórios
  test('Tabela 11.3: 2026-11-02, cartão {3,10}, parcela 1 → {2026-11, 2026-11-03, 2026-11-10}', () => {
    const r = calcularFatura('2026-11-02', { diaFechamento: 3, diaVencimento: 10 }, 1);
    assert.deepEqual(r, {
      referencia: '2026-11',
      fechamento: '2026-11-03',
      vencimento: '2026-11-10'
    });
  });

  test('Tabela 11.3: 2026-11-03, cartão {3,10}, parcela 1 → {2026-12, 2026-12-03, 2026-12-10}', () => {
    const r = calcularFatura('2026-11-03', { diaFechamento: 3, diaVencimento: 10 }, 1);
    assert.deepEqual(r, {
      referencia: '2026-12',
      fechamento: '2026-12-03',
      vencimento: '2026-12-10'
    });
  });

  test('Tabela 11.3: 2026-12-28, cartão {25,5}, parcela 1 → {2027-02, 2027-01-25, 2027-02-05}', () => {
    const r = calcularFatura('2026-12-28', { diaFechamento: 25, diaVencimento: 5 }, 1);
    assert.deepEqual(r, {
      referencia: '2027-02',
      fechamento: '2027-01-25',
      vencimento: '2027-02-05'
    });
  });

  test('Tabela 11.3: 2026-12-20, cartão {25,5}, parcela 3 → {2027-03, 2027-02-25, 2027-03-05}', () => {
    const r = calcularFatura('2026-12-20', { diaFechamento: 25, diaVencimento: 5 }, 3);
    assert.deepEqual(r, {
      referencia: '2027-03',
      fechamento: '2027-02-25',
      vencimento: '2027-03-05'
    });
  });

  // Casos de clamp (triplos exatos)
  test('Clamp: cartão {31,31}, compra 2026-02-10, parcela 1 → {2026-03, 2026-02-28, 2026-03-31}', () => {
    const r = calcularFatura('2026-02-10', { diaFechamento: 31, diaVencimento: 31 }, 1);
    assert.deepEqual(r, {
      referencia: '2026-03',
      fechamento: '2026-02-28',
      vencimento: '2026-03-31'
    });
  });

  test('Clamp: cartão {31,31}, compra 2026-02-28 (dia do fechamento clampado), parcela 1 → {2026-04, 2026-03-31, 2026-04-30}', () => {
    const r = calcularFatura('2026-02-28', { diaFechamento: 31, diaVencimento: 31 }, 1);
    assert.deepEqual(r, {
      referencia: '2026-04',
      fechamento: '2026-03-31',
      vencimento: '2026-04-30'
    });
  });

  test('Clamp: cartão {31,31}, compra 2028-02-10 (bissexto), parcela 1 → {2028-03, 2028-02-29, 2028-03-31}', () => {
    const r = calcularFatura('2028-02-10', { diaFechamento: 31, diaVencimento: 31 }, 1);
    assert.deepEqual(r, {
      referencia: '2028-03',
      fechamento: '2028-02-29',
      vencimento: '2028-03-31'
    });
  });

  // Adversarial probes
  test('Compra no dia do fechamento vai para mês seguinte', () => {
    const r = calcularFatura('2026-11-03', { diaFechamento: 3, diaVencimento: 10 }, 1);
    assert.equal(r.referencia, '2026-12');
  });

  test('diaVencimento <= diaFechamento → vencimento no mês seguinte ao fechamento', () => {
    const r = calcularFatura('2026-11-01', { diaFechamento: 15, diaVencimento: 10 }, 1);
    // fechamento em 2026-11-15, vencimento em 2026-12-10 (mês seguinte porque 10 <= 15)
    assert.equal(r.vencimento, '2026-12-10');
    assert.equal(r.referencia, '2026-12');
  });

  test('diaVencimento > diaFechamento → vencimento no mesmo mês do fechamento', () => {
    const r = calcularFatura('2026-11-01', { diaFechamento: 10, diaVencimento: 20 }, 1);
    // fechamento em 2026-11-10, vencimento em 2026-11-20 (mesmo mês porque 20 > 10)
    assert.equal(r.vencimento, '2026-11-20');
    assert.equal(r.referencia, '2026-11');
  });

  test('Parcela 2 desloca 1 mês do fechamento base', () => {
    const r1 = calcularFatura('2026-11-01', { diaFechamento: 10, diaVencimento: 20 }, 1);
    const r2 = calcularFatura('2026-11-01', { diaFechamento: 10, diaVencimento: 20 }, 2);
    // parcela 2: fechamento um mês depois
    assert.equal(r2.fechamento, '2026-12-10');
    assert.equal(r2.vencimento, '2026-12-20');
    assert.equal(r2.referencia, '2026-12');
  });

  test('Retorno tem todas as chaves obrigatórias', () => {
    const r = calcularFatura('2026-11-01', { diaFechamento: 10, diaVencimento: 20 }, 1);
    assert.ok('referencia' in r);
    assert.ok('fechamento' in r);
    assert.ok('vencimento' in r);
    assert.equal(typeof r.referencia, 'string');
    assert.equal(typeof r.fechamento, 'string');
    assert.equal(typeof r.vencimento, 'string');
  });

  test('Formato de data AAAA-MM-DD em todos os campos', () => {
    const r = calcularFatura('2026-11-01', { diaFechamento: 10, diaVencimento: 20 }, 1);
    assert.match(r.fechamento, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(r.vencimento, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(r.referencia, /^\d{4}-\d{2}$/);
  });
});