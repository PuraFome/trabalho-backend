const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  ehDataValida,
  paraUTC,
  ultimoDiaDoMes,
  dataSegura,
  hojeUTC,
  iso,
  somarDias,
  deslocarMes,
  periodoAnterior
} = require('../../utils/datas');

describe('utils/datas.js', () => {
  describe('ehDataValida', () => {
    test('2028-02-29 (ano bissexto) → true', () => {
      assert.equal(ehDataValida('2028-02-29'), true);
    });

    test('2026-02-29 (ano não bissexto) → false', () => {
      assert.equal(ehDataValida('2026-02-29'), false);
    });

    test('2026-13-01 (mês inválido) → false', () => {
      assert.equal(ehDataValida('2026-13-01'), false);
    });

    test('2026-1-01 (formato inválido - mês sem zero) → false', () => {
      assert.equal(ehDataValida('2026-1-01'), false);
    });

    test('2026-04-31 (dia inválido para abril) → false', () => {
      assert.equal(ehDataValida('2026-04-31'), false);
    });

    test('formato inválido (2026/01/01) → false', () => {
      assert.equal(ehDataValida('2026/01/01'), false);
    });

    test('string vazia → false', () => {
      assert.equal(ehDataValida(''), false);
    });

    test('null → false', () => {
      assert.equal(ehDataValida(null), false);
    });
  });

  describe('ultimoDiaDoMes', () => {
    test('Janeiro 2026 → 31', () => {
      assert.equal(ultimoDiaDoMes(2026, 0), 31);
    });

    test('Fevereiro 2026 (não bissexto) → 28', () => {
      assert.equal(ultimoDiaDoMes(2026, 1), 28);
    });

    test('Fevereiro 2028 (bissexto) → 29', () => {
      assert.equal(ultimoDiaDoMes(2028, 1), 29);
    });

    test('Abril 2026 → 30', () => {
      assert.equal(ultimoDiaDoMes(2026, 3), 30);
    });

    test('Dezembro 2026 → 31', () => {
      assert.equal(ultimoDiaDoMes(2026, 11), 31);
    });
  });

  describe('dataSegura', () => {
    test('dataSegura(2026, 1, 31) → 2026-02-28 (clamp dia)', () => {
      assert.equal(iso(dataSegura(2026, 1, 31)), '2026-02-28');
    });

    test('dataSegura(2026, 13, 5) → 2027-02-05 (mês > 11 wrap)', () => {
      assert.equal(iso(dataSegura(2026, 13, 5)), '2027-02-05');
    });

    test('dataSegura(2026, -1, 15) → 2025-12-15 (mês negativo wrap)', () => {
      assert.equal(iso(dataSegura(2026, -1, 15)), '2025-12-15');
    });

    test('dataSegura(2028, 1, 30) → 2028-02-29 (bissexto clamp)', () => {
      assert.equal(iso(dataSegura(2028, 1, 30)), '2028-02-29');
    });
  });

  describe('deslocarMes', () => {
    test('deslocarMes(2026-03-31, -1) → 2026-02-28 (clamp fim de mês)', () => {
      assert.equal(deslocarMes('2026-03-31', -1), '2026-02-28');
    });

    test('deslocarMes(2026-01-31, 1) → 2026-02-28', () => {
      assert.equal(deslocarMes('2026-01-31', 1), '2026-02-28');
    });

    test('deslocarMes(2026-05-15, 2) → 2026-07-15', () => {
      assert.equal(deslocarMes('2026-05-15', 2), '2026-07-15');
    });

    test('deslocarMes(2026-12-10, 1) → 2027-01-10 (virada de ano)', () => {
      assert.equal(deslocarMes('2026-12-10', 1), '2027-01-10');
    });
  });

  describe('periodoAnterior', () => {
    test('Outubro completo → Setembro completo (exemplo oficial)', () => {
      const r = periodoAnterior('2026-10-01', '2026-10-31');
      assert.deepEqual(r, { inicio: '2026-09-01', fim: '2026-09-30' });
    });

    test('Março completo → Fevereiro completo (não bissexto)', () => {
      const r = periodoAnterior('2026-03-01', '2026-03-31');
      assert.deepEqual(r, { inicio: '2026-02-01', fim: '2026-02-28' });
    });

    test('Janeiro completo → Dezembro anterior (virada de ano)', () => {
      const r = periodoAnterior('2026-01-01', '2026-01-31');
      assert.deepEqual(r, { inicio: '2025-12-01', fim: '2025-12-31' });
    });

    test('Intervalo não alinhado ao mês', () => {
      const r = periodoAnterior('2026-10-05', '2026-10-20');
      assert.deepEqual(r, { inicio: '2026-09-05', fim: '2026-09-20' });
    });

    test('Fevereiro bissexto → Janeiro completo (31 dias)', () => {
      const r = periodoAnterior('2028-02-01', '2028-02-29');
      assert.deepEqual(r, { inicio: '2028-01-01', fim: '2028-01-31' });
    });

    test('Novembro (30) → Outubro completo (31) — regressão F3', () => {
      const r = periodoAnterior('2026-11-01', '2026-11-30');
      assert.deepEqual(r, { inicio: '2026-10-01', fim: '2026-10-31' });
    });

    test('Junho (30) → Maio completo (31)', () => {
      const r = periodoAnterior('2026-06-01', '2026-06-30');
      assert.deepEqual(r, { inicio: '2026-05-01', fim: '2026-05-31' });
    });

    test('Julho (31) → Junho completo (30)', () => {
      const r = periodoAnterior('2026-07-01', '2026-07-31');
      assert.deepEqual(r, { inicio: '2026-06-01', fim: '2026-06-30' });
    });
  });

  describe('somarDias', () => {
    test('somarDias(2026-12-31, 1) → 2027-01-01 (virada de ano)', () => {
      assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
    });

    test('somarDias(2026-02-28, 1) → 2026-03-01', () => {
      assert.equal(somarDias('2026-02-28', 1), '2026-03-01');
    });

    test('somarDias(2028-02-28, 1) → 2028-02-29 (bissexto)', () => {
      assert.equal(somarDias('2028-02-28', 1), '2028-02-29');
    });

    test('somarDias(2026-01-10, -5) → 2026-01-05 (dias negativos)', () => {
      assert.equal(somarDias('2026-01-10', -5), '2026-01-05');
    });
  });

  describe('paraUTC', () => {
    test('paraUTC(2026-01-15) retorna Date em UTC', () => {
      const d = paraUTC('2026-01-15');
      assert.ok(d instanceof Date);
      assert.equal(d.getUTCFullYear(), 2026);
      assert.equal(d.getUTCMonth(), 0);
      assert.equal(d.getUTCDate(), 15);
    });
  });

  describe('iso', () => {
    test('iso(Date) retorna AAAA-MM-DD', () => {
      const d = new Date(Date.UTC(2026, 5, 15));
      assert.equal(iso(d), '2026-06-15');
    });
  });

  describe('hojeUTC', () => {
    test('hojeUTC retorna string AAAA-MM-DD', () => {
      const h = hojeUTC();
      assert.match(h, /^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // Adversarial probes
  test('ehDataValida rejeita 2026-00-10 (mês 00)', () => {
    assert.equal(ehDataValida('2026-00-10'), false);
  });

  test('ehDataValida rejeita 2026-02-00 (dia 00)', () => {
    assert.equal(ehDataValida('2026-02-00'), false);
  });

  test('deslocarMes clamp em ano bissexto', () => {
    assert.equal(deslocarMes('2028-03-31', -1), '2028-02-29');
  });

  test('dataSegura com dia 31 em mês de 30 dias', () => {
    assert.equal(iso(dataSegura(2026, 3, 31)), '2026-04-30'); // abril tem 30, dia 31 → clamp para 30
  });
});