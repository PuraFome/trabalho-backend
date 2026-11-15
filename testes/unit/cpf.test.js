const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { cpfValido } = require('../../utils/cpf');

describe('utils/cpf.js - cpfValido', () => {
  test('CPF válido com pontuação (529.982.247-25)', () => {
    assert.equal(cpfValido('529.982.247-25'), true);
  });

  test('CPF válido sem pontuação (52998224725)', () => {
    assert.equal(cpfValido('52998224725'), true);
  });

  test('CPF inválido - dígito verificador errado (529.982.247-24)', () => {
    assert.equal(cpfValido('529.982.247-24'), false);
  });

  test('CPF inválido - todos dígitos iguais (111.111.111-11)', () => {
    assert.equal(cpfValido('111.111.111-11'), false);
  });

  test('CPF inválido - string vazia', () => {
    assert.equal(cpfValido(''), false);
  });

  test('CPF inválido - null', () => {
    assert.equal(cpfValido(null), false);
  });

  test('CPF inválido - apenas 3 dígitos', () => {
    assert.equal(cpfValido('123'), false);
  });

  test('CPF inválido - 10 dígitos', () => {
    assert.equal(cpfValido('5299822472'), false);
  });

  // Adversarial probes
  test('CPF inválido - 11 dígitos repetidos (22222222222)', () => {
    assert.equal(cpfValido('22222222222'), false);
  });

  test('CPF inválido - caracteres não numéricos misturados', () => {
    assert.equal(cpfValido('52a9.9b8.2c4-7d5'), false);
  });

  test('CPF inválido - número como entrada (sem normalizar string)', () => {
    assert.equal(cpfValido(52998224725), false);
  });

  test('CPF válido - outro CPF conhecido (11144477735)', () => {
    assert.equal(cpfValido('111.444.777-35'), true);
  });

  test('CPF inválido - length 12', () => {
    assert.equal(cpfValido('123456789012'), false);
  });
});