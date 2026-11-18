#!/usr/bin/env node
// Smoke test zero-dependency do frontend (docs/).
//
// Uso:
//   node testes/front-smoke.mjs
//   API_BASE=http://localhost:3000 node testes/front-smoke.mjs
//
// Sucesso: imprime "SMOKE OK" no stdout e sai com código 0.
// Divergência: imprime "SMOKE FAIL: ..." no stderr e sai com código != 0.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolverApiBase } = require('../docs/config.js');

const API_BASE = (process.env.API_BASE || 'http://localhost:3000').replace(/\/+$/, '');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertStatus(res, expected, label) {
  if (res.status !== expected) {
    throw new Error(
      `${label}: esperado HTTP ${expected}, recebido ${res.status} — ${JSON.stringify(res.body)}`
    );
  }
}

async function request(path, { method = 'GET', token, body } = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (e) {
    throw new Error(`Falha de rede em ${method} ${url}: ${e.message}`);
  }

  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

// Mês corrente em UTC (mesma referência de hojeUTC() no backend).
function mesCorrente() {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = agora.getUTCMonth();
  const mm = String(mes + 1).padStart(2, '0');
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return {
    inicio: `${ano}-${mm}-01`,
    fim: `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
    hoje: `${ano}-${mm}-${String(agora.getUTCDate()).padStart(2, '0')}`
  };
}

async function main() {
  // (a) resolverApiBase — local e público
  assert(
    resolverApiBase('localhost', '4200') === 'http://localhost:3000',
    "resolverApiBase('localhost','4200') deveria retornar http://localhost:3000"
  );
  const basePublica = resolverApiBase('usuario.github.io', '');
  assert(
    typeof basePublica === 'string' && basePublica.startsWith('https:'),
    `resolverApiBase para host público deveria retornar base https:, recebido: ${basePublica}`
  );

  const { inicio, fim, hoje } = mesCorrente();

  // (b) Login com o seed
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: 'ana@email.com', senha: 'Ana@1234' }
  });
  assertStatus(login, 200, 'POST /auth/login');
  assert(
    login.body && typeof login.body.token === 'string' && login.body.token.length > 0,
    'POST /auth/login: token ausente na resposta'
  );
  const token = login.body.token;

  // Rota protegida sem token → 401
  const semToken = await request('/categorias');
  assertStatus(semToken, 401, 'GET /categorias sem token');

  // /health
  const health = await request('/health');
  assertStatus(health, 200, 'GET /health');
  assert(
    health.body && health.body.status === 'ok' && health.body.banco === 'ok',
    `GET /health: corpo inesperado — ${JSON.stringify(health.body)}`
  );

  // /auth/me
  const me = await request('/auth/me', { token });
  assertStatus(me, 200, 'GET /auth/me');
  assert(me.body && typeof me.body === 'object', 'GET /auth/me: corpo inválido');
  assert(
    typeof me.body.nome === 'string' && me.body.nome.length > 0,
    'GET /auth/me: campo nome ausente'
  );
  assert(!('senha_hash' in me.body), 'GET /auth/me: resposta não deve conter senha_hash');

  // /categorias
  const categorias = await request('/categorias', { token });
  assertStatus(categorias, 200, 'GET /categorias');
  assert(Array.isArray(categorias.body), 'GET /categorias: esperado array');

  // /fontes-destinos
  const fontes = await request('/fontes-destinos', { token });
  assertStatus(fontes, 200, 'GET /fontes-destinos');
  assert(Array.isArray(fontes.body), 'GET /fontes-destinos: esperado array');

  // /lancamentos do mês corrente
  const lancamentos = await request(`/lancamentos?inicio=${inicio}&fim=${fim}`, { token });
  assertStatus(lancamentos, 200, 'GET /lancamentos');
  const lista = lancamentos.body;
  assert(lista && typeof lista === 'object', 'GET /lancamentos: corpo inválido');
  assert(
    lista.resumo &&
      typeof lista.resumo.entradas === 'number' &&
      typeof lista.resumo.saidas === 'number' &&
      typeof lista.resumo.saldo === 'number',
    'GET /lancamentos: resumo.entradas/saidas/saldo devem ser number'
  );
  assert(
    typeof lista.pagina === 'number' &&
      typeof lista.totalPaginas === 'number' &&
      Array.isArray(lista.itens),
    'GET /lancamentos: pagina/totalPaginas/itens ausentes'
  );

  // /relatorios/categorias
  const relCat = await request(`/relatorios/categorias?inicio=${inicio}&fim=${fim}`, { token });
  assertStatus(relCat, 200, 'GET /relatorios/categorias');
  assert(relCat.body && typeof relCat.body === 'object', 'GET /relatorios/categorias: corpo inválido');
  assert(
    relCat.body.saidas && Array.isArray(relCat.body.saidas.categorias),
    'GET /relatorios/categorias: saidas.categorias ausente'
  );
  assert(
    relCat.body.periodoAnterior && typeof relCat.body.periodoAnterior.inicio === 'string',
    'GET /relatorios/categorias: periodoAnterior ausente'
  );

  // /relatorios/fontes-destinos
  const relFontes = await request(`/relatorios/fontes-destinos?inicio=${inicio}&fim=${fim}`, { token });
  assertStatus(relFontes, 200, 'GET /relatorios/fontes-destinos');
  assert(
    relFontes.body && typeof relFontes.body === 'object',
    'GET /relatorios/fontes-destinos: corpo inválido'
  );
  assert(
    Array.isArray(relFontes.body.entradas) &&
      Array.isArray(relFontes.body.saidas) &&
      Array.isArray(relFontes.body.contas),
    'GET /relatorios/fontes-destinos: entradas/saidas/contas ausentes'
  );
  assert(
    relFontes.body.contas.every((c) => typeof c.saldo === 'number'),
    'GET /relatorios/fontes-destinos: contas[].saldo deve ser number'
  );

  // /relatorios/faturas
  const relFaturas = await request('/relatorios/faturas?meses=3', { token });
  assertStatus(relFaturas, 200, 'GET /relatorios/faturas');
  assert(
    relFaturas.body && Array.isArray(relFaturas.body.cartoes),
    'GET /relatorios/faturas: cartoes ausente'
  );
  assert(
    relFaturas.body.cartoes.every((c) => Array.isArray(c.faturas)),
    'GET /relatorios/faturas: cartoes[].faturas ausente'
  );

  // (c) Parcelado 100/3 — categoria e cartão escolhidos dinamicamente
  const categoriaSaida = categorias.body.find((c) => c.tipo === 'saida');
  assert(categoriaSaida, 'GET /categorias: nenhuma categoria de saída encontrada');
  const cartao = fontes.body.find((f) => f.tipo === 'cartao_credito');
  assert(cartao, 'GET /fontes-destinos: nenhum cartão de crédito encontrado');

  const descricao = `SMOKE parcelado ${Date.now()}`;
  let criado = null;
  try {
    const post = await request('/lancamentos', {
      method: 'POST',
      token,
      body: {
        tipo: 'saida',
        descricao,
        valor: 100,
        data: hoje,
        categoriaId: categoriaSaida.id,
        fonteDestinoId: cartao.id,
        parcelas: 3
      }
    });
    assertStatus(post, 201, 'POST /lancamentos');
    criado = post.body;
    assert(
      criado &&
        criado.quantidade === 3 &&
        typeof criado.grupo === 'string' &&
        criado.grupo.length > 0,
      'POST /lancamentos: quantidade/grupo inesperados'
    );

    const aposCriar = await request(`/lancamentos?inicio=${inicio}&fim=${fim}`, { token });
    assertStatus(aposCriar, 200, 'GET /lancamentos (após criar)');
    const itens = aposCriar.body.itens.filter((i) => i.descricao === descricao);
    assert(
      itens.length === 3,
      `GET /lancamentos: esperados 3 itens do grupo, encontrados ${itens.length}`
    );

    const centavos = itens.map((i) => Math.round(i.valor * 100)).sort((a, b) => b - a);
    assert(
      JSON.stringify(centavos) === JSON.stringify([3334, 3333, 3333]),
      `parcelas inesperadas: ${JSON.stringify(itens.map((i) => i.valor))}`
    );
    assert(
      centavos.reduce((soma, v) => soma + v, 0) === 10000,
      'soma das parcelas deve ser 100.00'
    );
    assert(
      itens.every((i) => /^[1-3]\/3$/.test(i.parcela || '')),
      'parcela deve estar no formato k/3'
    );
  } finally {
    // Limpa o grupo inteiro mesmo se alguma asserção acima falhar.
    if (criado && criado.id) {
      const del = await request(`/lancamentos/${criado.id}?todasParcelas=true`, {
        method: 'DELETE',
        token
      });
      assertStatus(del, 204, 'DELETE /lancamentos/:id?todasParcelas=true');
    }
  }

  // Confirma que nada do smoke sobrou no banco.
  const depois = await request(`/lancamentos?inicio=${inicio}&fim=${fim}`, { token });
  assertStatus(depois, 200, 'GET /lancamentos (após limpar)');
  assert(
    !depois.body.itens.some((i) => i.descricao === descricao),
    'limpeza falhou: lançamento do smoke ainda presente'
  );
}

try {
  await main();
  console.log('SMOKE OK');
} catch (e) {
  console.error(`SMOKE FAIL: ${e.message}`);
  process.exitCode = 1;
}
