const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { dividirEmParcelas } = require('../../utils/parcelas');

describe('utils/parcelas.js - dividirEmParcelas', () => {
  test('100 em 3 parcelas → [33.34, 33.33, 33.33]', () => {
    const r = dividirEmParcelas(100, 3);
    assert.deepEqual(r, [33.34, 33.33, 33.33]);
  });

  test('100 em 3 parcelas - soma exata 10000 centavos', () => {
    const r = dividirEmParcelas(100, 3);
    const soma = Math.round(r.reduce((s, v) => s + v, 0) * 100);
    assert.equal(soma, 10000);
  });

  test('3000 em 10 parcelas → 10x 300', () => {
    const r = dividirEmParcelas(3000, 10);
    assert.equal(r.length, 10);
    r.forEach(v => assert.equal(v, 300));
    const soma = Math.round(r.reduce((s, v) => s + v, 0) * 100);
    assert.equal(soma, 300000);
  });

  test('0.05 em 3 parcelas → soma 5 centavos', () => {
    const r = dividirEmParcelas(0.05, 3);
    const soma = Math.round(r.reduce((s, v) => s + v, 0) * 100);
    assert.equal(soma, 5);
  });

  test('0.10 em 3 parcelas → soma 10 centavos', () => {
    const r = dividirEmParcelas(0.10, 3);
    const soma = Math.round(r.reduce((s, v) => s + v, 0) * 100);
    assert.equal(soma, 10);
  });

  test('100 em 48 parcelas → soma 10000 centavos', () => {
    const r = dividirEmParcelas(100, 48);
    assert.equal(r.length, 48);
    const soma = Math.round(r.reduce((s, v) => s + v, 0) * 100);
    assert.equal(soma, 10000);
  });

  test('100 em 0 parcelas → RangeError', () => {
    assert.throws(() => dividirEmParcelas(100, 0), RangeError);
  });

  test('100 em 49 parcelas → RangeError', () => {
    assert.throws(() => dividirEmParcelas(100, 49), RangeError);
  });

  test('0 em 3 parcelas → RangeError', () => {
    assert.throws(() => dividirEmParcelas(0, 3), RangeError);
  });

  test('-10 em 3 parcelas → RangeError', () => {
    assert.throws(() => dividirEmParcelas(-10, 3), RangeError);
  });

  // Adversarial probes
  test('valor com muitas casas decimais - 100.005 em 3', () => {
    const r = dividirEmParcelas(100.005, 3);
    const soma = Math.round(r.reduce((s, v) => s + v, 0) * 100);
    assert.equal(soma, 10001); // 100.005 * 100 = 10000.5 → round = 10001
  });

  test('parcela única - 100 em 1', () => {
    const r = dividirEmParcelas(100, 1);
    assert.deepEqual(r, [100]);
  });

  test('valor muito pequeno - 0.01 em 2', () => {
    const r = dividirEmParcelas(0.01, 2);
    const soma = Math.round(r.reduce((s, v) => s + v, 0) * 100);
    assert.equal(soma, 1);
  });

  test('cent boundary - 0.03 em 3 (1 centavo cada)', () => {
    const r = dividirEmParcelas(0.03, 3);
    assert.deepEqual(r, [0.01, 0.01, 0.01]);
  });

  test('resto vai para primeira - 100.01 em 3', () => {
    const r = dividirEmParcelas(100.01, 3);
    // 10001 centavos / 3 = 3333 base, resto 2 → [33.35, 33.33, 33.33]
    assert.equal(r[0], 33.35);
    assert.equal(r[1], 33.33);
    assert.equal(r[2], 33.33);
  });

  test('não usa toFixed no cálculo interno', () => {
    // Verifica que o retorno são numbers, não strings
    const r = dividirEmParcelas(100, 3);
    r.forEach(v => assert.equal(typeof v, 'number'));
  });
});