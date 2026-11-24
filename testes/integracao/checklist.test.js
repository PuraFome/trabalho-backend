const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const jwt = require('jsonwebtoken');
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

test('health and README setup files are available', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { status: 'ok', banco: 'ok' });
  assert.ok(fs.existsSync('database/schema.sql'));
  assert.ok(fs.existsSync('database/seed.sql'));
  assert.ok(fs.existsSync('.env.example'));
  assert.ok(fs.existsSync('README.md'));
  execFileSync('docker', ['compose', 'config', '--quiet'], { stdio: 'ignore' });
});

test('duplicate email differing only by case returns 409', async () => {
  const result = await request('/auth/cadastro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: 'Duplicado',
      email: '  ANA@EMAIL.COM  ',
      cpf: '86429753182',
      senha: 'Teste@1234'
    })
  });
  assert.equal(result.status, 409);
  assert.ok(result.body.campos.email);
});

test('duplicate CPF with punctuation returns 409', async () => {
  const result = await request('/auth/cadastro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: 'Duplicado',
      email: 'duplicado.integracao@email.com',
      cpf: '529.982.247-25',
      senha: 'Teste@1234'
    })
  });
  assert.equal(result.status, 409);
  assert.ok(result.body.campos.cpf);
});

test('MySQL UNIQUE constraint rejects duplicate email directly', async () => {
  await assert.rejects(
    pool.query(
      'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES (?, ?, ?, ?)',
      ['Duplicado direto', 'ana@email.com', '99999999999', 'hash']
    ),
    error => error.code === 'ER_DUP_ENTRY'
  );
});

test('login and /me never expose senha_hash', async () => {
  const token = await login('ana@email.com', 'Ana@1234');
  const loginResult = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ana@email.com', senha: 'Ana@1234' })
  });
  const me = await request('/auth/me', { headers: authHeaders(token) });
  assert.equal(me.status, 200);
  assert.equal(Object.hasOwn(me.body, 'senha_hash'), false);
  assert.equal(Object.hasOwn(loginResult.body.usuario, 'senha_hash'), false);
});

test('missing and expired tokens return JSON 401', async () => {
  const missing = await request('/categorias');
  assert.equal(missing.status, 401);
  assert.equal(typeof missing.body.erro, 'string');

  const expired = jwt.sign(
    { id: 1, nome: 'Ana', email: 'ana@email.com' },
    process.env.JWT_SECRET,
    { expiresIn: '-1s' }
  );
  const result = await request('/categorias', {
    headers: { Authorization: `Bearer ${expired}` }
  });
  assert.equal(result.status, 401);
  assert.equal(typeof result.body.erro, 'string');
});

test('cross-user category and launch IDs return 404', async () => {
  const tokenAna = await login('ana@email.com', 'Ana@1234');
  const tokenBruno = await login('bruno@email.com', 'Bruno@1234');

  const category = await request('/categorias/3', {
    method: 'PUT',
    headers: authHeaders(tokenBruno),
    body: JSON.stringify({ nome: 'Tentativa' })
  });
  assert.equal(category.status, 404);

  const anaLaunches = await request(
    '/lancamentos?inicio=2000-01-01&fim=2099-12-31',
    { headers: authHeaders(tokenAna) }
  );
  const launchId = anaLaunches.body.itens[0]?.id;
  assert.ok(launchId);

  const launch = await request(`/lancamentos/${launchId}`, {
    headers: authHeaders(tokenBruno)
  });
  assert.equal(launch.status, 404);
});

test('saida rejects entrada category', async () => {
  const token = await login('ana@email.com', 'Ana@1234');
  const result = await request('/lancamentos', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      tipo: 'saida',
      descricao: 'Erro tipo',
      valor: 100,
      data: '2026-11-18',
      categoriaId: 1,
      fonteDestinoId: 1
    })
  });
  assert.equal(result.status, 400);
  assert.match(result.body.campos.categoriaId, /entrada.*saída|entrada.*saida/i);
});

test('R$100 in 3 installments divides exactly in centavos', async () => {
  const token = await login('ana@email.com', 'Ana@1234');
  const created = await request('/lancamentos', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      tipo: 'saida',
      descricao: 'Checklist 100 em 3',
      valor: 100,
      data: '2026-11-18',
      categoriaId: 9,
      fonteDestinoId: 3,
      parcelas: 3
    })
  });
  assert.equal(created.status, 201);
  assert.ok(created.body.grupo);

  const rows = await request(
    '/lancamentos?inicio=2000-01-01&fim=2099-12-31&fonteDestinoId=3',
    { headers: authHeaders(token) }
  );
  const parcelas = rows.body.itens
    .filter(item => item.descricao === 'Checklist 100 em 3')
    .map(item => item.valor)
    .sort((a, b) => b - a);
  assert.deepEqual(parcelas, [33.34, 33.33, 33.33]);
  assert.equal(
    parcelas.reduce((total, valor) => total + Math.round(valor * 100), 0),
    10000
  );

  await request(`/lancamentos/${created.body.id}?todasParcelas=true`, {
    method: 'DELETE',
    headers: authHeaders(token)
  });
});

test('purchase on closing day goes to next invoice', async () => {
  const token = await login('ana@email.com', 'Ana@1234');
  const created = await request('/lancamentos', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      tipo: 'saida',
      descricao: 'Checklist fechamento dia 3',
      valor: 50,
      data: '2026-11-03',
      categoriaId: 9,
      fonteDestinoId: 3,
      parcelas: 1
    })
  });
  assert.equal(created.status, 201);

  const faturas = await request('/relatorios/faturas?meses=12', {
    headers: authHeaders(token)
  });
  assert.equal(faturas.status, 200);
  const card = faturas.body.cartoes.find(item => item.id === 3);
  const invoice = card.faturas.find(item =>
    item.lancamentos.some(lancamento =>
      lancamento.descricao === 'Checklist fechamento dia 3'
    )
  );
  assert.equal(invoice.referencia, '2026-12');
  assert.equal(invoice.fechamento, '2026-12-03');

  await request(`/lancamentos/${created.body.id}`, {
    method: 'DELETE',
    headers: authHeaders(token)
  });
});

test('category reports return JSON numbers', async () => {
  const token = await login('ana@email.com', 'Ana@1234');
  const result = await request(
    '/relatorios/categorias?inicio=2026-11-01&fim=2026-11-30',
    { headers: authHeaders(token) }
  );
  assert.equal(result.status, 200);
  assert.equal(typeof result.body.saidas.total, 'number');
  for (const category of result.body.saidas.categorias) {
    assert.equal(typeof category.total, 'number');
  }
});

test('.env is ignored and .env.example is tracked', () => {
  let envTracked = true;
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '.env'], { stdio: 'ignore' });
  } catch {
    envTracked = false;
  }
  assert.equal(envTracked, false);

  execFileSync('git', ['ls-files', '--error-unmatch', '.env.example'], {
    stdio: 'ignore'
  });
});
