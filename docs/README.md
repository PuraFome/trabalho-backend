# Documentação e Demonstração — Finanças Pessoais

Site estático, zero-build e sem dependências, publicado pelo GitHub Pages a partir da pasta `/docs` deste repositório. A pasta `/docs` contém **duas partes**:

- **`docs/index.html`** — documentação da API (visão geral, autenticação JWT, referência de rotas, exemplos, formato de erro, CORS e credenciais de demonstração).
- **`docs/demo/`** — a aplicação financeira completa (login, cadastro, lançamentos, cadastro de fontes/destinos, relatórios) como demonstração ao vivo, conectada à API publicada.

## Servir localmente

Na raiz do repositório:

```bash
node tools/serve-front.mjs
```

O servidor embutido (Node puro, sem dependências) publica `docs/` em **http://localhost:4200**:

- Documentação: **http://localhost:4200/**
- Demonstração: **http://localhost:4200/demo/**

Alternativa com qualquer servidor estático:

```bash
npx serve docs -l 4200
```

> A API precisa estar de pé em `http://localhost:3000` (veja o README da raiz). O `docs/demo/config.js` resolve a base automaticamente: em `localhost`/porta `4200` usa `http://localhost:3000`; em qualquer outro host usa `PROD_API_BASE` — ajuste essa constante para a URL do Render antes do deploy.

## GitHub Pages

- **Source:** branch principal, pasta **`/docs`** (Settings → Pages → Build and deployment → Deploy from a branch → `/docs`).
- **URL:** `https://SEU_USUARIO.github.io/trabalho-backend/`
- `docs/.nojekyll` desativa o processamento Jekyll do GitHub Pages.
- No backend, inclua a origem do Pages em `CORS_ORIGIN` (ex.: `https://SEU_USUARIO.github.io` — apenas `scheme://host`, **sem** o path do repositório).

## Estrutura

```
docs/
├── index.html          # Documentação da API (visão geral, auth, rotas, exemplos, erros, CORS)
├── styles.css          # Reset mínimo + tipografia base (16px)
├── README.md           # Este arquivo
├── .nojekyll           # Desativa Jekyll no GitHub Pages
└── demo/               # Demonstração ao vivo (app financeira)
    ├── index.html      # Shell HTML com abas (Login, Lançamentos, Fontes/Destinos, Relatórios)
    ├── styles.css      # Estilos da aplicação
    ├── config.js       # Resolve a base da API (local x produção)
    └── app.js          # Auth, lançamentos e relatórios (scripts clássicos)
```

## Configuração de Produção

- **`docs/demo/config.js`** — edite a constante `PROD_API_BASE` para a URL da API no Render (ex.: `https://seu-app.onrender.com`).
- **Backend `.env` (produção)** — `CORS_ORIGIN=https://SEU_USUARIO.github.io` (host apenas, sem path).

## Login de demonstração

Use o usuário do seed: `ana@email.com` / `Ana@1234`.

## Autenticação e trade-off de segurança (localStorage/XSS)

O token JWT retornado por `POST /auth/login` é guardado em `localStorage` (`docs/demo/app.js`: `getToken`/`setToken`/`clearToken`).

**Trade-off conhecido:** qualquer script executado na página consegue ler `localStorage`; portanto, um XSS bem-sucedido pode exfiltrar o token. Isso é **aceitável para esta demonstração acadêmica** (front estático, sem backend próprio para cookies), mas **não** é a recomendação para produção. Em um sistema real, prefira cookie `HttpOnly` + `Secure` + `SameSite` (não legível por JavaScript) e/ou tokens de curta duração com refresh.

Mitigações já presentes: todo texto vindo da API é escapado antes de ir para o DOM (`escapeHtml`), e o token é removido no logout ou em respostas 401. Ainda assim, o risco residual de XSS existe e está documentado aqui como decisão consciente do projeto.
