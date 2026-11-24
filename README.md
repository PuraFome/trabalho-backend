# API Finanças — Controle Financeiro Pessoal

> API REST completa para controle financeiro pessoal: autenticação JWT, CRUDs de categorias/fontes-destinos/lancamentos com parcelamento no cartão, três relatórios (por categoria, por fonte/destino, faturas futuras) e rota extra de saúde financeira (desafio). Executável via **Docker Compose** ou **npm** local.

---

## Sumário

1. [Visão Rápida](#visão-rápida)
2. [Requisitos](#requisitos)
3. [Setup com Docker (Recomendado)](#setup-com-docker-recomendado)
4. [Setup Local (sem Docker)](#setup-local-sem-docker)
5. [Comandos Úteis](#comandos-úteis)
6. [Variáveis de Ambiente (`.env`)](#variáveis-de-ambiente-env)
6. [Credenciais de Demonstração (Seed)](#credenciais-de-demonstração-seed)
7. [Estrutura de Pastas](#estrutura-de-pastas)
8. [Tabela de Rotas](#tabela-de-rotas)
9. [Regras de Negócio](#regras-de-negócio)
10. [Desafio: Saúde Financeira](#desafio-saúde-financeira)
11. [Checklist de Aceite (§11.12)](#checklist-de-aceite-§1112)
12. [Roteiro de Apresentação (≤10 min)](#roteiro-de-apresentação-≤10-min)

---

## Visão Rápida

Esta API foi desenvolvida para a disciplina de **Backend** com as seguintes características:

- **Sem ORM** — SQL cru com `mysql2` e prepared statements (`?`)
- **Autenticação stateless** — JWT (HS256, 1h) + middleware `express-jwt`
- **Isolamento total** — todo SQL filtra `usuario_id = req.auth.id`; acesso cruzado → **404**
- **Parcelamento real** — divisão em centavos, resto na 1ª parcela, `grupo_parcelamento` UUID
- **Faturas de cartão** — regra de fechamento/vencimento fiel ao enunciado (Tabela 11.3)
- **Relatórios agregados** — `SUM/GROUP BY` no banco, período anterior = mês de calendário anterior
- **Desafio +10** — 5 indicadores, projeção 6 meses, dicas com limiares fixos, aviso educativo
- **Docker-first** — `docker compose up -d --build` sobe DB + API com healthchecks

---

## Requisitos

| Ferramenta | Versão Mínima | Observação |
|------------|---------------|------------|
| Docker Desktop | 4.x | Com integração WSL2 ativa no Windows |
| Docker Compose | v2 (`docker compose`) | Plugin `docker-compose-plugin` no Linux |
| Node.js | 20+ | Para modo local (`npm run dev`) |
| MySQL | 8.0.16+ | Requer `CHECK` constraints (modo local) |

> **Windows:** Ative *Settings → General → Use the WSL 2 based engine* e *Resources → WSL Integration* para sua distro.

---

## Setup com Docker (Recomendado)

```bash
# 1. Clone e entre no diretório
git clone <repo-url>
cd trabalho-backend

# 2. Copie o exemplo de ambiente e edite o JWT_SECRET
cp .env.example .env
# EDITAR .env → defina JWT_SECRET com 32+ caracteres aleatórios

# 3. Suba tudo (banco + API)
docker compose up -d --build

# 4. Aguarde healthchecks (db → healthy, api → healthy)
docker compose ps
# NAME                STATUS
# api                 Up (healthy)
# db                  Up (healthy)

# 5. Teste
curl -s http://localhost:3000/health
# {"status":"ok","banco":"ok"}
```

**O que acontece:**  
- `db`: MySQL 8.4, volume `db_data` persiste dados, roda `schema.sql` + `seed.sql` no primeiro boot
- `api`: Imagem multi-stage Node 24 slim, roda na porta 3000 (host) / 3000 (rede interna)

> **Importante:** Não rode `docker compose down -v` a menos que queira apagar o banco. Para resetar mantendo a imagem: `npm run db:reset` (derrota o volume e recria só o banco).

---

## Setup Local (sem Docker)

> Requer MySQL 8.0.16+ instalado e rodando na porta 3306.

```bash
# 1. Banco
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql

# 2. Dependências
npm install

# 3. Variáveis de ambiente
cp .env.example .env
# EDITAR .env → DB_HOST=127.0.0.1, JWT_SECRET=...

# 4. Desenvolvimento (hot reload com nodemon)
npm run dev
# API em http://localhost:3000

# 5. Produção
npm start
```

**Teste rápido:**
```bash
curl -s http://localhost:3000/health
# {"status":"ok","banco":"ok"}
```

> **Nota:** O `package-lock.json` **é** versionado (builds reprodutíveis com `npm ci`). Use `npm install` apenas para atualizar dependências.

---

## Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Produção (`node server.js`) |
| `npm run dev` | Desenvolvimento (`nodemon server.js`, hot reload) |
| `npm test` | Testes unitários (`node --test testes/unit`) |
| `npm run test:integration` | Checklist HTTP ponta a ponta (`testes/integracao`, API + MySQL em execução) |
| `npm run docker:up` | `docker compose up -d --build` |
| `npm run docker:down` | `docker compose down` |
| `npm run db:reset` | `docker compose down -v && docker compose up -d db` (reset total do banco) |
| `npm run db:shell` | `docker compose exec db sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'` |

---

## Variáveis de Ambiente (`.env`)

Copie de `.env.example` e preencha. **Nunca commite o `.env` real.**

| Variável | Significado | Exemplo Fictício |
|----------|-------------|------------------|
| `PORT` | Porta da API | `3000` |
| `NODE_ENV` | Ambiente | `development` / `production` |
| `DB_HOST` | Host do MySQL | `localhost` (local) / `db` (Docker) |
| `DB_PORT` | Porta do MySQL | `3306` |
| `DB_USER` | Usuário do banco | `financas` |
| `DB_PASSWORD` | Senha do banco | `troque_esta_senha` |
| `DB_ROOT_PASSWORD` | Senha root (Docker) | `troque_esta_senha_root` |
| `DB_NAME` | Nome do banco | `api_financas` |
| `JWT_SECRET` | Segredo HS256 (32+ chars) | `frase_longa_e_dificil_de_adivinhar_com_32_ou_mais_caracteres` |
| `BCRYPT_ROUNDS` | Cost do bcrypt | `10` |
| `CORS_ORIGIN` | Origens permitidas (CSV). **Em produção (Render)** deve ser `https://SEU_USUARIO.github.io`. **Regra:** o Origin header tem apenas `scheme://host` (sem path), então `https://user.github.io/repo` **não** corresponde. Em desenvolvimento local: `http://localhost:4200,https://SEU_USUARIO.github.io` |

> **Por que `JWT_SECRET` no `.env`?** Segurança: nunca hardcode secrets. O middleware `express-jwt` falha rápido se ausente.
> **Em produção:** `PORT`, `DB_*`, e `JWT_SECRET` vêm do ambiente (Render). `CORS_ORIGIN` deve ser `https://SEU_USUARIO.github.io` (o host `<user>.github.io`, sem o nome do repositório).

---

## Credenciais de Demonstração (Seed)

O `seed.sql` cria dois usuários com hashes bcrypt reais (cost 10). Use para testar imediatamente:

| Usuário | E-mail | Senha | CPF (somente dígitos) |
|---------|--------|-------|----------------------|
| Ana Souza | `ana@email.com` | `Ana@1234` | `52998224725` |
| Bruno Lima | `bruno@email.com` | `Bruno@1234` | `11144477735` |

> **⚠️ Dados de demonstração apenas.** Não use em produção. O seed inclui 3 meses de lançamentos relativos a `CURDATE()` + compra parcelada 10× (Notebook R$ 3.000,00 no Cartão Nubank).

---

## Estrutura de Pastas

```
trabalho-backend/
├── .env.example          # Template de variáveis (versionado)
├── .gitignore            # Ignora .env, node_modules, .omo/, logs
├── package.json          # Scripts + 7 dependências permitidas
├── server.js             # Bootstrap Express, CORS, health, routers
├── middleware/
│   ├── cors.js           # CORS próprio (allowlist CORS_ORIGIN)
│   └── auth.js           # express-jwt (HS256, requestProperty: 'auth')
├── routes/
│   ├── auth.js           # POST /cadastro, POST /login, GET /me
│   ├── categorias.js     # CRUD /categorias
│   ├── fontesDestinos.js # CRUD /fontes-destinos
│   ├── lancamentos.js    # CRUD /lancamentos (+ parcelamento)
│   ├── relatorios.js     # GET /categorias, /fontes-destinos, /faturas
│   └── saudeFinanceira.js# GET /saude-financeira (desafio)
├── models/
│   ├── Usuario.js        # Cadastro transacional + buscas
│   ├── Categoria.js      # Listar/criar/atualizar/excluir + contagem
│   ├── FonteDestino.js   # CRUD + listarCartoes + contagem
│   ├── Lancamento.js     # Transação parcelada + listar/detalhar/atualizar/excluir
│   ├── Relatorio.js      # Agregações por categoria/fonte/faturas
│   └── Saude.js          # Agregações do desafio
├── utils/
│   ├── cpf.js            # Validação CPF com dígitos verificadores
│   ├── datas.js          # Datas UTC, período anterior, clamp
│   ├── parcelas.js       # Divisão em centavos (resto na 1ª)
│   ├── faturas.js        # Regra de fechamento/vencimento (Tabela 11.3)
│   ├── csv.js            # Parser CSV sem dependências
│   ├── xlsx.js           # Leitura/escrita de .xlsx (ZIP + SpreadsheetML) sem dependências
│   ├── importacaoLancamentos.js # Modelo e validação da importação por linha/célula
│   └── saude.js          # 5 indicadores + projeção + dicas
├── database/
│   ├── connection.js     # Pool mysql2/promise (UTC, dateStrings)
│   ├── schema.sql        # 4 tabelas, FKs, UNIQUE/CHECK nomeados
│   └── seed.sql          # 2 usuários + 3 meses + 10× parcelado
├── testes/
│   ├── unit/             # node:test (CPF, datas, parcelas, faturas, saúde, importação, xlsx)
│   └── requisicoes.md    # Roteiro curl TODAS as rotas (A–L)
├── docker/
│   └── api-entrypoint.sh # Entrypoint dev (npm install + npm run dev)
├── Dockerfile            # Multi-stage (deps → runtime)
├── docker-compose.yml    # db (MySQL 8.4) + api + healthchecks
├── docker-compose.override.yml # Dev: bind mount + hot reload
├── docs/                 # Site estático (GitHub Pages source)
│   ├── index.html        # Documentação da API (visão geral, auth, rotas, exemplos, erros, CORS)
│   ├── styles.css        # Reset mínimo + tipografia base (16px)
│   ├── README.md         # Documentação do site (docs + demo)
│   ├── .nojekyll         # Desativa Jekyll no GitHub Pages
│   └── demo/             # Demonstração ao vivo (app financeira)
│       ├── index.html    # Shell HTML com abas (Login, Lançamentos, Fontes/Destinos, Relatórios)
│       ├── styles.css    # Estilos da aplicação
│       ├── config.js     # Resolve a base da API (local x produção)
│       └── app.js        # Auth, lançamentos e relatórios (scripts clássicos)
├── tools/
│   └── serve-front.mjs   # Servidor estático Node puro (porta 4200)
└── README.md             # Este arquivo
```

---

## Documentação e Demonstração (docs/)

A pasta `/docs` é um site estático, zero-build e sem dependências, publicado pelo **GitHub Pages**, com duas partes:

- **`docs/index.html`** — **documentação da API** (visão geral, autenticação JWT, referência de rotas, exemplos, formato de erro, CORS e credenciais de demonstração).
- **`docs/demo/`** — **demonstração ao vivo** da aplicação financeira (login, cadastro, lançamentos, cadastro de fontes/destinos, relatórios), conectada à API publicada.

### Servir localmente

Na raiz do repositório:

```bash
node tools/serve-front.mjs
```

O servidor embutido (Node puro, sem dependências) publica `docs/` em **http://localhost:4200**:

- Documentação: **http://localhost:4200/**
- Demonstração: **http://localhost:4200/demo/**

> A API precisa estar de pé em `http://localhost:3000` (veja Setup acima). O `docs/demo/config.js` resolve a base automaticamente: em `localhost`/porta `4200` usa `http://localhost:3000`; em qualquer outro host usa `PROD_API_BASE` — ajuste essa constante para a URL do Render antes do deploy.

### GitHub Pages

- **Source:** branch principal, pasta **`/docs`** (Settings → Pages → Build and deployment → Deploy from a branch → `/docs`).
- **URL:** `https://SEU_USUARIO.github.io/trabalho-backend/`
- `docs/.nojekyll` desativa o processamento Jekyll do GitHub Pages.
- No backend, inclua a origem do Pages em `CORS_ORIGIN` (ex.: `https://SEU_USUARIO.github.io` — apenas `scheme://host`, **sem** o path do repositório).

### Configuração de Produção

- **`docs/demo/config.js`** — edite a constante `PROD_API_BASE` para a URL da API no Render (ex.: `https://seu-app.onrender.com`).
- **Backend `.env` (produção)** — `CORS_ORIGIN=https://SEU_USUARIO.github.io` (host apenas, sem path).

### Login de demonstração

Use o usuário do seed: `ana@email.com` / `Ana@1234`.

---

## Tabela de Rotas

| Método | Caminho | Protegida | Corpo / Query | Status Possíveis |
|--------|---------|-----------|---------------|------------------|
| GET | `/health` | **Não** | — | 200, 503 |
| POST | `/auth/cadastro` | Não | `{nome,email,cpf,senha}` | 201, 400, 409, 500 |
| POST | `/auth/login` | Não | `{email,senha}` | 200, 401, 500 |
| GET | `/auth/me` | **Sim** | — | 200, 401, 404 |
| GET | `/categorias` | Sim | `?tipo=entrada\|saida` | 200, 400, 401 |
| POST | `/categorias` | Sim | `{nome,tipo,classificacao?}` | 201, 400, 409, 401 |
| PUT | `/categorias/:id` | Sim | `{nome?,tipo?,classificacao?}` | 200, 400, 404, 409, 401 |
| DELETE | `/categorias/:id` | Sim | — | 204, 400, 404, 409, 401 |
| GET | `/fontes-destinos` | Sim | `?tipo=renda\|conta\|cartao_credito` | 200, 400, 401 |
| POST | `/fontes-destinos` | Sim | `{nome,tipo,dia_fechamento?,dia_vencimento?,limite?,reserva?}` | 201, 400, 409, 401 |
| PUT | `/fontes-destinos/:id` | Sim | `{nome?,tipo?,dia_fechamento?,dia_vencimento?,limite?,reserva?}` | 200, 400, 404, 409, 401 |
| DELETE | `/fontes-destinos/:id` | Sim | — | 204, 400, 404, 409, 401 |
| GET | `/lancamentos` | Sim | `?inicio&fim&tipo&categoriaId&fonteDestinoId&pagina` | 200, 400, 401 |
| GET | `/lancamentos/:id` | Sim | — | 200, 400, 404, 401 |
| POST | `/lancamentos` | Sim | `{tipo,descricao,valor,data,categoriaId,fonteDestinoId,parcelas?}` | 201, 400, 404, 401 |
| PUT | `/lancamentos/:id` | Sim | `{tipo?,descricao?,valor?,data?,categoriaId?,fonteDestinoId?}` | 200, 400, 404, 401 |
| DELETE | `/lancamentos/:id` | Sim | `?todasParcelas=true` | 204, 400, 404, 401 |
| GET | `/lancamentos/importar/modelo` | Sim | `?formato=csv` (padrão `.xlsx`) | 200, 401 |
| POST | `/lancamentos/importar` | Sim | CSV (`text/csv`) ou `.xlsx` | 201, 400, 401, 500 |
| GET | `/lancamentos/exportar` | Sim | `?inicio&fim&tipo` (opcionais) | 200, 400, 401 |
| GET | `/relatorios/categorias` | Sim | `inicio,fim` (obrigatórios) | 200, 400, 401 |
| GET | `/relatorios/fontes-destinos` | Sim | `inicio,fim` (obrigatórios) | 200, 400, 401 |
| GET | `/relatorios/faturas` | Sim | `?meses=3` (1–12) | 200, 400, 401 |
| GET | `/saude-financeira` | Sim | — | 200, 401 |

### Justificativa do `/health`

Rota **pública** de infraestrutura: usada pelo Docker (`healthcheck`) e por balanceadores/monitoramento para saber se a API e o banco respondem. Não expõe **nenhum dado de negócio** (sem usuário, sem token). A regra *"todas as rotas exceto cadastro/login exigem token"* aplica-se às rotas de **dados**; `/health` é rota de **infraestrutura** e não conflita com essa política.

---

## Regras de Negócio

### 1. Isolamento por `req.auth.id`
Toda query SQL inclui `WHERE usuario_id = ?` bindado com `req.auth.id`. Registros de outro usuário **não existem** para o solicitante → **404** (nunca 403).

### 2. Normalização
- **E-mail:** `trim()` + `toLowerCase()` antes de gravar/buscar
- **CPF:** `replace(/\D/g,'')` (só dígitos) antes de gravar/validar
- **Nome:** `trim()`

### 3. Unicidade garantida no banco
Constraints `UNIQUE` nomeadas (`uq_usuarios_email`, `uq_usuarios_cpf`, `uq_categorias_nome`, `uq_fontes_nome`). `ER_DUP_ENTRY` → HTTP **409** com campo violado identificado via `sqlMessage`.

### 4. Parcelamento (centavos)
`valorTotal * 100 → centavos`; `base = floor(centavos/qtd)`; `resto = centavos - base*qtd`; 1ª parcela = `base + resto`, demais = `base`. Soma exata garantida.

### 5. Regra de Fechamento de Fatura (cartão de crédito)

> Implementação fiel à referência do enunciado (`utils/faturas.js`).

```js
function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const m = mes - 1;                              // mês 0-index
  const fechamentoDoMes = Math.min(cartao.diaFechamento, ultimoDiaDoMes(ano, m));
  let mesFechamento = dia < fechamentoDoMes ? m : m + 1;   // ANTES do fechamento → mês atual
  mesFechamento += numeroParcela - 1;             // cada parcela desloca 1 mês
  const fechamento = dataSegura(ano, mesFechamento, cartao.diaFechamento);
  const mesVencimento = cartao.diaVencimento > cartao.diaFechamento
    ? mesFechamento
    : mesFechamento + 1;
  const vencimento = dataSegura(ano, mesVencimento, cartao.diaVencimento);
  return {
    referencia: iso(vencimento).slice(0, 7),      // AAAA-MM do vencimento
    fechamento: iso(fechamento),
    vencimento: iso(vencimento)
  };
}
```

**Regras derivadas:**
- Compra **antes** do dia de fechamento → fatura do **mesmo mês** (referência = mês do vencimento)
- Compra **no dia ou depois** do fechamento → fatura do **mês seguinte**
- Parcela `k` desloca `k-1` meses a partir da fatura da 1ª parcela
- Vencimento: se `dia_vencimento > dia_fechamento` → **mesmo mês** do fechamento; senão → **mês seguinte**
- Dia inexistente no mês (ex.: 31/02) → **último dia do mês** (`clamp` via `dataSegura`)

**Exemplos (Tabela 11.3):**
| Compra | Cartão (fech/venc) | Parcela | Referência | Fechamento | Vencimento |
|--------|-------------------|---------|------------|------------|------------|
| 2026-11-02 | 3 / 10 | 1 | 2026-11 | 2026-11-03 | 2026-11-10 |
| 2026-11-03 | 3 / 10 | 1 | 2026-12 | 2026-12-03 | 2026-12-10 |
| 2026-12-28 | 25 / 5 | 1 | 2027-02 | 2027-01-25 | 2027-02-05 |
| 2026-12-20 | 25 / 5 | 3 | 2027-03 | 2027-02-25 | 2027-03-05 |

### 6. `faturaAtual` (definição adotada)
> `calcularFatura(hojeUTC(), cartao, 1).referencia` — a fatura em que uma compra feita **hoje** cairia. No dia do fechamento, a atual já é a **seguinte** (coerente com a regra de corte).

### 7. `limiteUtilizado`
Soma das parcelas **daquele cartão** cujo `vencimento >= hojeUTC()`. `limiteDisponivel = limite - limiteUtilizado` (pode ficar negativo = estouro real).

### 8. Período Anterior (relatórios)
**Mês de calendário anterior** (não "mesmo número de dias"), conforme exemplo oficial do enunciado:
- `inicio='2026-10-01', fim='2026-10-31'` → `periodoAnterior: {inicio:'2026-09-01', fim:'2026-09-30'}`
- Implementado em `utils/datas.periodoAnterior()` via `deslocarMes(..., -1)` com clamp de fim de mês.

### 9. Números em JSON (não strings)
Todos os `DECIMAL`/`SUM` convertidos com `Number()` uma única vez no model. Relatórios, lançamentos e faturas devolvem `number` (ex.: `33.34`, não `"33.34"`).

### 10. Formato único de erro
```json
// 400
{ "erro": "Dados inválidos.", "campos": { "campo": "mensagem" } }

// 409
{ "erro": "Conflito.", "campos": { "campo": "mensagem" } }

// 401
{ "erro": "Token ausente, inválido ou expirado." }

// 404
{ "erro": "Recurso não encontrado." }

// 500
{ "erro": "Erro interno do servidor." }
```

### 11. Importação de lançamentos (Excel `.xlsx` ou CSV)
- **Modelo:** `GET /lancamentos/importar/modelo` devolve um `.xlsx` cujas colunas **Categoria** e **Fonte/Destino** têm lista suspensa (validação de dados) preenchida com as categorias/fontes do usuário, e a coluna **Data** tem **validação de data** (calendário, só aceita datas, exibida como `AAAA-MM-DD`). Colunas: `Data, Descrição, Categoria, Fonte/Destino, Parcela, Valor` (+ linha de exemplo, ignorada). `?formato=csv` baixa o modelo em CSV (UTF-8 com BOM).
- **Formato:** no CSV, separador vírgula e decimal com ponto (`150.90`). As colunas são reconhecidas **pelo cabeçalho**, então a importação aceita tanto o modelo quanto o arquivo gerado por `GET /lancamentos/exportar` (que tem a coluna extra `Tipo`, ignorada — o `tipo` é inferido da categoria). `Categoria` e `Fonte/Destino` são referenciados **pelo nome**. `Parcela` aceita um inteiro (total de parcelas; 1 se vazio) ou o formato `k/N` do export (importado como lançamento único). Parcelamento só para saída em cartão de crédito.
- **Importação:** `POST /lancamentos/importar` aceita `text/csv` ou `.xlsx` (binário) e valida todas as linhas **antes** de gravar. Se qualquer célula for inválida, **nada** é importado e o retorno lista cada erro com `linha`, `coluna` e `mensagem`. Caso contrário, tudo é gravado em uma única transação. Categorias e fontes/destinos citados **pelo nome** que não existirem na conta são **criados automaticamente** (categoria com o tipo da coluna `Tipo`, ou `saida`; fonte/destino como `conta`) — o retorno informa `categoriasCriadas`/`fontesCriadas`. A leitura/escrita de `.xlsx` é feita **sem dependências** (ZIP + SpreadsheetML com `node:zlib`, em `utils/xlsx.js`).

### 12. Exportação de lançamentos (`.xlsx`)
`GET /lancamentos/exportar` devolve um `.xlsx` com **todos** os lançamentos do usuário (sem paginação), respeitando os filtros opcionais `inicio`, `fim`, `tipo`, `categoriaId` e `fonteDestinoId`. Colunas: `Data, Tipo, Descrição, Categoria, Fonte/Destino, Parcela, Valor` (Data como data, Valor numérico). Gerado sem dependências pelo mesmo `utils/xlsx.js`.

---

## Desafio: Saúde Financeira

### Colunas Adicionais (Migração no `schema.sql`)
| Tabela | Coluna | Tipo | Finalidade |
|--------|--------|------|------------|
| `categorias` | `classificacao` | `ENUM('necessidade','desejo','poupanca')` | Regra 50/30/20 |
| `fontes_destinos` | `reserva` | `TINYINT(1) DEFAULT 0` | Contas de reserva (meses de reserva) |

### 5 Indicadores (fórmulas em `utils/saude.js`)

| # | Indicador | Fórmula | Saída |
|---|-----------|---------|-------|
| 1 | **Taxa de Poupança** | `entradas > 0 ? (entradas - saidas) / entradas : 0` | 4 casas (ex.: `0.1803`) |
| 2 | **Comprometimento Cartões** | `mediaEntradas > 0 ? totalFaturas3m / mediaEntradas : 0` | 4 casas (ex.: `0.2205`) |
| 3 | **Meses de Reserva** | `mediaSaidas > 0 ? saldoReserva / mediaSaidas : 0` | 2 casas (ex.: `0.00`) |
| 4 | **Distribuição 50/30/20** | `% = totalCategoria / entradasMes` (4 casas) | Objeto com 4 chaves |
| 5 | **Parcelas Futuras** | Agrupa `valor` por `referencia` (AAAA-MM) dos cartões | `[{mes,total}]` |

> **Entradas/Saídas base:** últimos 3 meses completos (mês corrente + 2 anteriores). `saldoReserva` = soma entradas-saídas em fontes com `reserva=1` (todas datas).

### Projeção (6 meses)
```js
// projetarSaldo(mediaEntradas, mediaSaidas, parcelasPorMes, 6)
for cada mês futuro:
  saidasProjetadas = mediaSaidas + parcelasDoMes
  saldoPrevisto = mediaEntradas - saidasProjetadas
```

### 5 Limiares de Dicas (regra oficial do grupo)

| # | Condição | Texto da Dica |
|---|----------|---------------|
| 1 | `taxaPoupanca < 0.10` | `"Sua taxa de poupança está em X.XX%, abaixo do recomendado de 10%."` |
| 2 | `comprometimentoCartoes > 0.30` | `"O comprometimento com cartões está em X.XX%, acima do limite recomendado de 30%."` |
| 3 | `mesesDeReserva < 3` | `"Você tem X.XX meses de reserva, abaixo do recomendado de 3 meses."` |
| 4 | Alguma categoria do mês corrente `> 1.30 × média 3m anteriores` (média > 0) | `"A categoria 'X' gastou R$ Y, Z.ZZ% acima da média de R$ W dos 3 meses anteriores."` |
| 5 | Algum mês da projeção com `saldoPrevisto < 0` | `"Projeção indica saldo negativo de R$ X em AAAA-MM."` |

- Máximo **5 dicas**. Se nenhuma dispara → **1 dica positiva**: `"Sua taxa de poupança está acima de 10%, comprometimento com cartões abaixo de 30% e reserva superior a 3 meses. Parabéns!"`

### Aviso Educativo (sempre presente)
```json
"aviso": "Informações educativas; não constituem recomendação financeira profissional."
```

### Exemplo de Resposta (`GET /saude-financeira`)
```json
{
  "aviso": "Informações educativas; não constituem recomendação financeira profissional.",
  "indicadores": {
    "taxaPoupanca": 0.1803,
    "comprometimentoCartoes": 0.2205,
    "parcelasFuturas": [{ "mes": "2026-12", "total": 513.34 }, ...],
    "distribuicao503020": {
      "necessidades": { "total": 3126.67, "percentual": 0.6013 },
      "desejos": { "total": 3180, "percentual": 0.6115 },
      "poupanca": { "total": 0, "percentual": 0 },
      "naoClassificado": { "total": 0, "percentual": 0 }
    },
    "mesesDeReserva": 0
  },
  "projecao": [
    { "mes": "2026-11", "entradas": 5200, "saidas": 4262.22, "saldoPrevisto": 937.78 },
    ...
  ],
  "dicas": ["Você tem 0.00 meses de reserva, abaixo do recomendado de 3 meses."]
}
```

---

## Checklist de Aceite (§11.12)

| # | Item do Enunciado | Como Verificar (comando/rota) | Status |
|---|-------------------|-------------------------------|--------|
| 1 | **409 e-mail duplicado** (case-insensitive) | `curl -X POST /auth/cadastro -d '{"email":"ANA@EMAIL.COM",...}'` → 409 `campos.email` | ✅ |
| 2 | **409 CPF duplicado** (com/sem pontuação) | `curl -X POST /auth/cadastro -d '{"cpf":"529.982.247-25",...}'` → 409 `campos.cpf` | ✅ |
| 3 | **Banco impede duplicata** (constraint) | `mysql> INSERT INTO usuarios ... duplicate email;` → `ERROR 1062 (uq_usuarios_email)` | ✅ |
| 4 | **Nunca `senha_hash` em resposta** | `grep -r senha_hash routes/ models/` → 0 ocorrências em SELECTs de resposta; login/me sem campo | ✅ |
| 5 | **401 JSON** (sem token + token expirado) | `curl /categorias` → 401 JSON; `curl -H "Authorization: Bearer $EXPIRED" /categorias` → 401 JSON | ✅ |
| 6 | **Trocar ID → 404** (lançamento/categoria/fonte alheio) | Com `TOKEN2` (Bruno), `GET/PUT/DELETE /lancamentos/<id-Ana>` → 404; idem `/categorias`, `/fontes-destinos` | ✅ |
| 7 | **Saída com categoria de entrada → 400** | `POST /lancamentos tipo=saida categoriaId=1(Salário)` → 400 `"A categoria informada é de entrada..."` | ✅ |
| 8 | **100/3 = 33,34 + 33,33 + 33,33** (centavos) | `POST /lancamentos valor=100 parcelas=3` → itens `33.34, 33.33, 33.33`; soma = 10000 centavos | ✅ |
| 9 | **Fechamento no dia → fatura seguinte** | Seed: Notebook em 19/11 (Cartão Nubank fech=3) → parcela 1 referência **2026-12** (não 11) | ✅ |
| 10 | **Números, não strings** (relatórios/lancamentos/faturas) | `typeof item.valor === 'number'` em todos; `totalPaginas` inteiro; `limiteUtilizado` number | ✅ |
| 11 | **`.env` fora, `.env.example` dentro** | `git check-ignore .env` → 0 (ignorado); `git check-ignore .env.example` → 1 (não ignorado) | ✅ |
| 12 | **README reproduzível do zero** | `docker compose down -v && cp .env.example .env && docker compose up -d --build` → `/health` 200; modo local idem | ✅ |

> Os 12 itens são verificáveis pelo roteiro executável [`testes/requisicoes.md`](testes/requisicoes.md). Os testes unitários automatizados cobrem independentemente CPF, datas, parcelas, faturas e saúde financeira.

---

## Roteiro de Apresentação (≤10 min)

> **Regra da disciplina:** os **dois integrantes** devem ser capazes de explicar qualquer trecho do código. Dividam a fala, ensaiem com cronômetro.

| Bloco | Tempo | Conteúdo | Quem Fala |
|-------|-------|----------|-----------|
| **1. Visão Geral & Arquitetura** | 1:00 | "API de finanças: autenticação JWT, 4 CRUDs, 3 relatórios, desafio saúde financeira. Stack: Node 24, Express 4, mysql2, bcrypt, jsonwebtoken, express-jwt, dotenv. **Sem ORM** — SQL em `models/`, rotas só delegam. Isolamento por `req.auth.id`." | Integrante A |
| **2. Subida do Ambiente** | 1:30 | `cp .env.example .env` → edita `JWT_SECRET` → `docker compose up -d --build`. Mostra `docker compose ps` healthy. Comenta `docker-compose.override.yml` para hot reload (`npm run dev`). Testa `GET /health`. | Integrante B |
| **3. Autenticação & Isolamento** | 1:30 | Cadastro (normalização, 409 banco), Login (JWT 1h, 401 genérico), `/auth/me`. **Demo isolamento:** token Ana cria categoria; token Bruno tenta `PUT` na categoria de Ana → **404** (não 403). Explica middleware `express-jwt` + error handler 401. | Integrante A |
| **4. CRUDs + Parcelamento** | 1:30 | Categorias (classificação 50/30/20), Fontes/Destinos (cartão exige 3 campos). **Lançamentos:** POST único, POST **parcelado 10×** (resto na 1ª), GET com filtros/paginação/resumo, `DELETE ?todasParcelas=true`. Mostra `valor` numérico, `parcela:"k/N"`. | Integrante B |
| **5. Relatórios** | 1:30 | `/relatorios/categorias` (SUM/GROUP BY, % anterior, variação), `/relatorios/fontes-destinos` (entradas/saidas/saldo contas), `/relatorios/faturas` (fatura atual + futuras, limite usado/disponível). Passa compra 10× aparecendo em 10 faturas distintas. | Integrante A |
| **6. Desafio: Saúde Financeira** | 1:30 | Colunas extras (`classificacao`, `reserva`). 5 indicadores + projeção 6m + dicas (limiares fixos: 10%, 30%, 3m, 1.30×, saldo<0). Aviso educativo. Mostra resposta real com dados do seed. | Integrante B |
| **7. Qualidade & Entregáveis** | 0:30 | `npm test` verde (CPF, datas, parcelas, faturas, saúde). `testes/requisicoes.md` executa A–L sem 500. Checklist §11.12 tudo ✅. Guardrails: 7 deps, 0 SQL em rotas, 0 `senha_hash`, 0 cross-user, `.env` no gitignore. | Integrante A |

### Dicas de Apresentação
- **Tenha o terminal pronto** com `TOKEN` exportado e seed carregado.
- **Não leia o código**; explique a *decisão* (por que 404 e não 403? por que mês anterior de calendário?).
- **Mostre o banco** se perguntarem: `docker compose run --rm db ... mysql -e "SELECT ..."`.
- **Tempo total alvo:** 9:30 (margem de 30s para transições).

---

## Licença

MIT — Projeto acadêmico para disciplina de Backend.