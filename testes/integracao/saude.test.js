const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../database/connection');

const base = process.env.API_BASE || 'http://localhost:3000';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = null;
  if (text) body = JSON.parse(text);
  return { status: response.status, body };
}

async function login(email, senha) {
  const result = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha })
  });
  assert.equal(result.status, 200);
  return result.body.token;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

test.after(async () => {
  await pool.end();
});

const expectedIndicadoresKeys = [
  'categoriasForaDaCurva',
  'comprometimentoCartoes',
  'concentracaoGastos',
  'distribuicao503020',
  'indiceEndividamento',
  'mesesDeReserva',
  'parcelasFuturas',
  'runwayMeses',
  'scoreSaude',
  'taxaPoupanca',
  'tendenciaGastos'
].sort().join(',');

test('GET /saude-financeira returns 200 with full contract', async () => {
  const token = await login('ana@email.com', 'Ana@1234');

  const result = await request('/saude-financeira', {
    headers: authHeaders(token)
  });

  assert.equal(result.status, 200);
  const body = result.body;

  assert.equal(typeof body.aviso, 'string');
  assert.ok(body.aviso.length > 0);

  assert.equal(Object.keys(body.indicadores).sort().join(','), expectedIndicadoresKeys);

  assert.equal(body.projecao.length, 6);
  for (const entry of body.projecao) {
    assert.equal(typeof entry.mes, 'string');
    assert.equal(typeof entry.entradas, 'number');
    assert.equal(typeof entry.saidas, 'number');
    assert.equal(typeof entry.saldoPrevisto, 'number');
  }

  assert.ok(Array.isArray(body.dicas));
  for (const dica of body.dicas) {
    assert.equal(typeof dica, 'string');
    assert.ok(dica.length > 0);
  }

  const ind = body.indicadores;
  assert.equal(typeof ind.taxaPoupanca, 'number');
  assert.equal(typeof ind.comprometimentoCartoes, 'number');
  assert.equal(typeof ind.mesesDeReserva, 'number');
  assert.equal(typeof ind.indiceEndividamento, 'number');
  assert.equal(typeof ind.runwayMeses, 'number');
  assert.equal(typeof ind.scoreSaude, 'number');

  assert.ok(Array.isArray(ind.categoriasForaDaCurva));
  for (const cat of ind.categoriasForaDaCurva) {
    assert.equal(typeof cat.nome, 'string');
    assert.equal(typeof cat.total, 'number');
    assert.equal(typeof cat.mediaAnterior, 'number');
    assert.equal(typeof cat.ratio, 'number');
  }

  assert.ok(ind.concentracaoGastos && typeof ind.concentracaoGastos === 'object');
  assert.ok(Array.isArray(ind.concentracaoGastos.categorias));
  assert.equal(typeof ind.concentracaoGastos.totalGastos, 'number');
  assert.equal(typeof ind.concentracaoGastos.indiceConcentracao, 'number');

  const tend = ind.tendenciaGastos;
  assert.equal(typeof tend.mesAtual, 'string');
  assert.equal(typeof tend.saidasMesAtual, 'number');
  assert.equal(typeof tend.media3Meses, 'number');
  assert.equal(typeof tend.variacaoPercentual, 'number');
  assert.ok(['alta', 'baixa', 'estavel'].includes(tend.direcao));
});

test('GET /saude-financeira without token returns 401', async () => {
  const result = await request('/saude-financeira');
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { erro: 'Token ausente, inválido ou expirado.' });
});