// App bootstrap — fetch wrapper e helpers de auth
// Classic script (no ES modules), depende de window.API_BASE definido por config.js

/**
 * Wrapper fetch para a API com tratamento de erro padronizado.
 * @param {string} path - Caminho da rota (ex.: "/auth/login")
 * @param {Object} options - Opções da requisição
 * @param {string} [options.method="GET"] - Método HTTP
 * @param {Object} [options.body] - Corpo da requisição (será JSON.stringified)
 * @param {string} [options.token] - JWT para Authorization Bearer
 * @returns {Promise<any>} JSON parseado (ou null para 204)
 * @throws {Error} Com .status e .body anexados em caso de erro HTTP
 */
async function api(path, { method = "GET", body, token } = {}) {
  const url = API_BASE + path;
  const headers = {
    "Content-Type": "application/json"
  };
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    const origem = typeof location !== "undefined" && location.origin ? location.origin : "?";
    const err = new Error(
      "Não foi possível conectar à API em " + API_BASE + " (" + e.message + "). " +
      "Verifique se a API está no ar e se a origem " + origem + " está incluída em CORS_ORIGIN."
    );
    err.network = true;
    throw err;
  }

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else if (res.status !== 204) {
    data = await res.text();
  }

  if (!res.ok) {
    const detalhe = data && data.erro ? data.erro : (res.statusText || "erro");
    const campos = data && data.campos
      ? " " + Object.entries(data.campos).filter(function (par) { return par[1]; }).map(function (par) { return par[0] + ": " + par[1]; }).join(" ")
      : "";
    const err = new Error("HTTP " + res.status + " — " + detalhe + campos);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return res.status === 204 ? null : data;
}

/** Obtém o token JWT do localStorage */
function getToken() {
  return localStorage.getItem("token");
}

/** Salva o token JWT no localStorage */
function setToken(token) {
  localStorage.setItem("token", token);
}

/** Remove o token JWT do localStorage */
function clearToken() {
  localStorage.removeItem("token");
}

// --- State ---
let currentUser = null;

// --- Escape helper ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ajuda(descricao) {
  const safe = escapeHtml(descricao);
  return `<span class="ajuda" tabindex="0" role="img" aria-label="${safe}">?<span class="ajuda-tooltip" role="tooltip">${safe}</span></span>`;
}

// --- Tab navigation ---
function showTab(name) {
  // Panels
  document.querySelectorAll(".panel").forEach(panel => {
    panel.classList.remove("active");
    panel.hidden = true;
  });
  const activePanel = document.getElementById("panel-" + name);
  if (activePanel) {
    activePanel.classList.add("active");
    activePanel.hidden = false;
  }

  // Tab buttons
  document.querySelectorAll(".tabs button[role=\"tab\"]").forEach(btn => {
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("tabindex", "-1");
  });
  const activeTab = document.getElementById("tab-" + name);
  if (activeTab) {
    activeTab.setAttribute("aria-selected", "true");
    activeTab.setAttribute("tabindex", "0");
  }

  if (name === "lancamentos" && getToken()) {
    renderLancamentos();
  }
  if (name === "fontes") {
    renderFontes();
  }
  if (name === "categorias" && getToken()) {
    renderCategorias();
  }
  if (name === "relatorios" && getToken()) {
    renderRelatorios();
  }
  if (name === "saude" && getToken()) {
    renderSaudeFinanceira();
  }
}

// --- Login view ---
function renderLogin() {
  const panel = document.getElementById("panel-login");
  if (!panel) return;

  panel.innerHTML = `
    <h1>Entrar</h1>
    <form id="login-form" novalidate>
      <div class="form-group">
        <label for="login-email">E-mail</label>
        <input type="email" id="login-email" name="email" required autocomplete="email" placeholder="ana@email.com">
      </div>
      <div class="form-group">
        <label for="login-senha">Senha</label>
        <input type="password" id="login-senha" name="senha" required autocomplete="current-password" placeholder="••••••••">
      </div>
      <div id="login-error" class="alert alert-error" hidden></div>
      <button type="submit" class="primary btn-full-width">Entrar</button>
    </form>
    <p class="mt-3 text-center">Não tem conta? <a href="#" id="link-cadastro">Criar conta</a></p>
  `;

  const form = document.getElementById("login-form");
  if (form) {
    form.addEventListener("submit", handleLogin);
  }
  const link = document.getElementById("link-cadastro");
  if (link) {
    link.addEventListener("click", (e) => { e.preventDefault(); renderCadastro(); });
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = form.querySelector("button[type=\"submit\"]");
  const errorEl = document.getElementById("login-error");

  // Reset error
  errorEl.hidden = true;
  errorEl.textContent = "";

  const email = form.elements.email.value.trim().toLowerCase();
  const senha = form.elements.senha.value;

  if (!email || !senha) {
    errorEl.textContent = "Preencha e-mail e senha.";
    errorEl.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Entrando...";

  try {
    const res = await api("/auth/login", {
      method: "POST",
      body: { email, senha }
    });

    // Success
    setToken(res.token);
    currentUser = res.usuario;
    showLoggedInState();
  } catch (err) {
    clearToken();
    currentUser = null;
    errorEl.textContent = escapeHtml(err.message || "Erro ao fazer login.");
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
}

// --- Cadastro view ---
function renderCadastro() {
  const panel = document.getElementById("panel-login");
  if (!panel) return;

  panel.innerHTML = `
    <h1>Criar conta</h1>
    <form id="cadastro-form" novalidate>
      <div class="form-group">
        <label for="cad-nome">Nome</label>
        <input type="text" id="cad-nome" name="nome" required maxlength="120" autocomplete="name">
      </div>
      <div class="form-group">
        <label for="cad-email">E-mail</label>
        <input type="email" id="cad-email" name="email" required autocomplete="email">
      </div>
      <div class="form-group">
        <label for="cad-cpf">CPF</label>
        <input type="text" id="cad-cpf" name="cpf" required inputmode="numeric" placeholder="Somente dígitos" autocomplete="off">
      </div>
      <div class="form-group">
        <label for="cad-senha">Senha</label>
        <input type="password" id="cad-senha" name="senha" required minlength="8" autocomplete="new-password">
        <small class="form-hint">Mínimo 8 caracteres, com letra e número.</small>
      </div>
      <div id="cadastro-error" class="alert alert-error" hidden></div>
      <button type="submit" class="primary btn-full-width">Criar conta</button>
    </form>
    <p class="mt-3 text-center"><a href="#" id="link-login">Já tenho conta</a></p>
  `;

  const form = document.getElementById("cadastro-form");
  if (form) form.addEventListener("submit", handleCadastro);
  const link = document.getElementById("link-login");
  if (link) link.addEventListener("click", (e) => { e.preventDefault(); renderLogin(); });
}

async function handleCadastro(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector("button[type=\"submit\"]");
  const errorEl = document.getElementById("cadastro-error");

  errorEl.hidden = true;
  errorEl.textContent = "";

  const nome = form.elements.nome.value.trim();
  const email = form.elements.email.value.trim().toLowerCase();
  const cpf = form.elements.cpf.value.replace(/\D/g, "");
  const senha = form.elements.senha.value;

  submitBtn.disabled = true;
  submitBtn.textContent = "Criando...";

  try {
    await api("/auth/cadastro", { method: "POST", body: { nome, email, cpf, senha } });
    const res = await api("/auth/login", { method: "POST", body: { email, senha } });
    setToken(res.token);
    currentUser = res.usuario;
    showLoggedInState();
  } catch (err) {
    errorEl.textContent = escapeHtml(err.message || "Erro ao criar conta.");
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Criar conta";
  }
}

function showLoggedInState() {
  // Update login panel to show user info + logout button
  const panel = document.getElementById("panel-login");
  if (!panel) return;

  const nome = currentUser ? escapeHtml(currentUser.nome) : "Usuário";

  panel.innerHTML = `
    <div class="card card-constrained">
      <h1>Bem-vindo, ${nome}</h1>
      <p class="mb-3">Você está logado.</p>
      <div class="flex gap-3">
        <button id="btn-logout" class="secondary">Sair</button>
      </div>
    </div>
  `;

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Enable app tabs
  const tabLancamentos = document.getElementById("tab-lancamentos");
  const tabRelatorios = document.getElementById("tab-relatorios");
  if (tabLancamentos) tabLancamentos.disabled = false;
  if (tabRelatorios) tabRelatorios.disabled = false;
}

async function hydrateSession() {
  const token = getToken();
  if (!token) {
    renderLogin();
    return;
  }

  try {
    const usuario = await api("/auth/me", { token });
    currentUser = usuario;
    showLoggedInState();
  } catch (err) {
    // Token inválido/expirado
    clearToken();
    currentUser = null;
    renderLogin();
  }
}

function logout() {
  clearToken();
  currentUser = null;

  // Disable app tabs
  const tabLancamentos = document.getElementById("tab-lancamentos");
  const tabRelatorios = document.getElementById("tab-relatorios");
  if (tabLancamentos) tabLancamentos.disabled = true;
  if (tabRelatorios) tabRelatorios.disabled = true;

  // Return to login form
  renderLogin();
  showTab("login");
}

function formatCurrency(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "R$ 0,00";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getCurrentMonthRange() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${new Date(ano, mes, 0).getDate()}`;
  return { inicio, fim };
}

function renderLancamentos() {
  const panel = document.getElementById("panel-lancamentos");
  if (!panel) return;

  const { inicio, fim } = getCurrentMonthRange();

  panel.innerHTML = `
    <h1>Lançamentos</h1>

    <div class="card" id="lancamentos-form">
      <!-- Form will be rendered by renderLancamentosForm() -->
    </div>

    <div class="card" id="lancamentos-importar">
      <h2>Importar lançamentos</h2>
      <p class="form-hint">Baixe o modelo em Excel (<code>.xlsx</code>) — a coluna <strong>Data</strong> tem <strong>calendário</strong> (só aceita datas) e as colunas <strong>Categoria</strong> e <strong>Fonte/Destino</strong> têm lista suspensa com as suas opções. Colunas: <code>Data, Descrição, Categoria, Fonte/Destino, Parcela, Valor</code>. O tipo (entrada/saída) é definido pela categoria; a linha de exemplo é ignorada. Também aceita <code>.csv</code> (vírgula, valor com ponto, ex.: <code>150.90</code>) e o arquivo exportado pela própria tela. Categorias/Fontes citadas que não existirem são criadas automaticamente.</p>
      <div class="form-actions">
        <button type="button" id="btn-baixar-modelo" class="secondary">Baixar modelo (.xlsx)</button>
      </div>
      <div class="form-group">
        <label for="import-arquivo">Arquivo (.xlsx ou .csv)</label>
        <input type="file" id="import-arquivo" name="arquivo" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv">
      </div>
      <div class="form-actions">
        <button type="button" id="btn-importar" class="primary">Importar</button>
      </div>
      <div id="import-resultado" hidden></div>
    </div>

    <div class="card" id="lancamentos-filtros">
      <div class="filtros-row">
        <div class="form-group">
          <label for="filtro-inicio">Início</label>
          <input type="date" id="filtro-inicio" name="inicio" value="${escapeHtml(inicio)}">
        </div>
        <div class="form-group">
          <label for="filtro-fim">Fim</label>
          <input type="date" id="filtro-fim" name="fim" value="${escapeHtml(fim)}">
        </div>
        <div class="form-group">
          <label for="filtro-tipo">Tipo</label>
          <select id="filtro-tipo" name="tipo">
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </div>
        <div class="form-group filtro-submit">
          <button type="button" id="btn-filtrar" class="primary">Filtrar</button>
        </div>
        <div class="form-group filtro-submit">
          <button type="button" id="btn-exportar" class="secondary">Exportar Excel</button>
        </div>
      </div>
    </div>

    <div class="card" id="lancamentos-resumo">
      <div class="resumo-grid">
        <div class="resumo-item">
          <span class="resumo-label">Entradas</span>
          <span class="resumo-valor positivo" id="resumo-entradas">R$ 0,00</span>
        </div>
        <div class="resumo-item">
          <span class="resumo-label">Saídas</span>
          <span class="resumo-valor negativo" id="resumo-saidas">R$ 0,00</span>
        </div>
        <div class="resumo-item">
          <span class="resumo-label">Saldo</span>
          <span class="resumo-valor" id="resumo-saldo">R$ 0,00</span>
        </div>
      </div>
    </div>

    <div class="card" id="lancamentos-tabela-wrap">
      <table id="lancamentos-tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Fonte/Destino</th>
            <th>Parcela</th>
            <th class="text-right">Valor</th>
            <th class="text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="lancamentos-tbody">
          <tr><td colspan="7" class="text-center">Carregando…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card" id="lancamentos-paginacao">
      <div class="paginacao-info" id="paginacao-info">Página 1 de 1</div>
      <div class="paginacao-botoes">
        <button type="button" id="btn-pagina-anterior" class="secondary" disabled>Anterior</button>
        <button type="button" id="btn-pagina-proxima" class="secondary" disabled>Próxima</button>
      </div>
    </div>

    <div id="lancamentos-erro" class="alert alert-error" hidden></div>
  `;

  const btnFiltrar = document.getElementById("btn-filtrar");
  if (btnFiltrar) {
    btnFiltrar.addEventListener("click", () => {
      carregarLancamentos(1);
    });
  }

  const btnExportar = document.getElementById("btn-exportar");
  if (btnExportar) {
    btnExportar.addEventListener("click", exportarLancamentos);
  }

  const btnAnterior = document.getElementById("btn-pagina-anterior");
  const btnProxima = document.getElementById("btn-pagina-proxima");
  if (btnAnterior) {
    btnAnterior.addEventListener("click", () => {
      const paginaAtual = parseInt(btnAnterior.dataset.pagina || "1", 10);
      if (paginaAtual > 1) carregarLancamentos(paginaAtual - 1);
    });
  }
  if (btnProxima) {
    btnProxima.addEventListener("click", () => {
      const paginaAtual = parseInt(btnProxima.dataset.pagina || "1", 10);
      const totalPaginas = parseInt(btnProxima.dataset.total || "1", 10);
      if (paginaAtual < totalPaginas) carregarLancamentos(paginaAtual + 1);
    });
  }

  ["filtro-inicio", "filtro-fim", "filtro-tipo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("keydown", e => {
        if (e.key === "Enter") carregarLancamentos(1);
      });
    }
  });

  const btnBaixarModelo = document.getElementById("btn-baixar-modelo");
  if (btnBaixarModelo) {
    btnBaixarModelo.addEventListener("click", baixarModeloImportacao);
  }
  const btnImportar = document.getElementById("btn-importar");
  if (btnImportar) {
    btnImportar.addEventListener("click", importarArquivoCsv);
  }

  // Load reference data and render form
  const token = getToken();
  if (token) {
    Promise.all([
      carregarCategoriasETipos(token),
      carregarFontesDestinos(token)
    ]).then(() => {
      renderLancamentosForm();
    });
  }

  carregarLancamentos(1);
}

// --- Lançamentos CREATE form ---
let todasCategorias = [];
let todasFontesDestinos = [];
let lancamentosCache = [];
let lancamentoEditandoId = null;

// --- Categorias CRUD ---
let categoriasCache = [];
let categoriaEditandoId = null;

async function carregarCategoriasETipos(token) {
  try {
    const [entradas, saidas] = await Promise.all([
      api("/categorias?tipo=entrada", { token }),
      api("/categorias?tipo=saida", { token })
    ]);
    todasCategorias = [...entradas, ...saidas];
  } catch (err) {
    console.error("Erro ao carregar categorias:", err);
    todasCategorias = [];
  }
}

async function carregarFontesDestinos(token) {
  try {
    todasFontesDestinos = await api("/fontes-destinos", { token });
  } catch (err) {
    console.error("Erro ao carregar fontes/destinos:", err);
    todasFontesDestinos = [];
  }
}

function filtrarCategoriasPorTipo(tipo) {
  return todasCategorias.filter(c => c.tipo === tipo);
}

function renderLancamentosForm() {
  const container = document.getElementById("lancamentos-form");
  if (!container) return;

  const hoje = new Date().toISOString().split("T")[0];

  const categoriasEntrada = filtrarCategoriasPorTipo("entrada");
  const categoriasSaida = filtrarCategoriasPorTipo("saida");

  const optionsCategoriasEntrada = categoriasEntrada.map(c =>
    `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)}</option>`
  ).join("");
  const optionsCategoriasSaida = categoriasSaida.map(c =>
    `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)}</option>`
  ).join("");

  const optionsFontes = todasFontesDestinos.map(f =>
    `<option value="${escapeHtml(f.id)}">${escapeHtml(f.nome)} (${escapeHtml(f.tipo)})</option>`
  ).join("");

  container.innerHTML = `
    <div class="card" id="lancamentos-form-card">
      <h2>Novo Lançamento</h2>
      <form id="form-criar-lancamento" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="lanc-tipo">Tipo <span class="required">*</span></label>
            <select id="lanc-tipo" name="tipo" required>
              <option value="">Selecione</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lanc-data">Data <span class="required">*</span></label>
            <input type="date" id="lanc-data" name="data" required value="${escapeHtml(hoje)}" max="${escapeHtml(hoje)}">
          </div>
        </div>

        <div class="form-group">
          <label for="lanc-descricao">Descrição <span class="required">*</span></label>
          <input type="text" id="lanc-descricao" name="descricao" required maxlength="120" placeholder="Ex.: Supermercado, Salário, Uber...">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="lanc-valor">Valor <span class="required">*</span></label>
            <input type="number" id="lanc-valor" name="valor" required step="0.01" min="0.01" placeholder="0,00">
          </div>
          <div class="form-group">
            <label for="lanc-parcelas">Parcelas</label>
            <input type="number" id="lanc-parcelas" name="parcelas" min="1" max="48" value="1" placeholder="1">
            <small class="form-hint">Só para cartão de crédito. Deixe 1 para parcela única.</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="lanc-categoria">Categoria <span class="required">*</span></label>
            <select id="lanc-categoria" name="categoriaId" required disabled>
              <option value="">Selecione o tipo primeiro</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lanc-fonte">Fonte/Destino <span class="required">*</span></label>
            <select id="lanc-fonte" name="fonteDestinoId" required>
              <option value="">Selecione</option>
              ${optionsFontes}
            </select>
          </div>
        </div>

        <div id="lancamento-erro" class="alert alert-error" hidden></div>

        <div class="form-actions">
          <button type="submit" class="primary">Criar Lançamento</button>
          <button type="button" id="btn-limpar-form" class="secondary">Limpar</button>
          <button type="button" id="btn-cancelar-edicao" class="secondary" hidden>Cancelar</button>
        </div>
      </form>
    </div>
  `;

  // Wire events
  const form = document.getElementById("form-criar-lancamento");
  const tipoSelect = document.getElementById("lanc-tipo");
  const categoriaSelect = document.getElementById("lanc-categoria");
  const btnLimpar = document.getElementById("btn-limpar-form");
  const btnCancelar = document.getElementById("btn-cancelar-edicao");

  if (tipoSelect && categoriaSelect) {
    tipoSelect.addEventListener("change", () => {
      const tipo = tipoSelect.value;
      const categorias = filtrarCategoriasPorTipo(tipo);
      const options = categorias.map(c =>
        `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)}</option>`
      ).join("");
      categoriaSelect.innerHTML = `<option value="">Selecione</option>${options}`;
      categoriaSelect.disabled = !tipo;
    });
  }

  if (form) {
    form.addEventListener("submit", handleCriarLancamento);
  }

  if (btnLimpar) {
    btnLimpar.addEventListener("click", resetLancamentoForm);
  }

  if (btnCancelar) {
    btnCancelar.addEventListener("click", resetLancamentoForm);
  }
}

async function handleCriarLancamento(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = form.querySelector("button[type=\"submit\"]");
  const erroEl = document.getElementById("lancamento-erro");

  // Reset error
  erroEl.hidden = true;
  erroEl.textContent = "";

  const token = getToken();
  if (!token) {
    erroEl.textContent = "Sessão expirada. Faça login novamente.";
    erroEl.hidden = false;
    return;
  }

  const tipo = form.elements.tipo.value;
  const descricao = form.elements.descricao.value.trim();
  const valor = Number(form.elements.valor.value);
  const data = form.elements.data.value;
  const categoriaId = parseInt(form.elements.categoriaId.value, 10);
  const fonteDestinoId = parseInt(form.elements.fonteDestinoId.value, 10);
  const parcelas = parseInt(form.elements.parcelas.value, 10) || 1;

  // Client-side validation (mirrors server)
  const campos = {};
  if (!tipo || !["entrada", "saida"].includes(tipo)) {
    campos.tipo = "Tipo é obrigatório e deve ser entrada ou saida.";
  }
  if (!descricao) {
    campos.descricao = "Descrição é obrigatória.";
  } else if (descricao.length > 120) {
    campos.descricao = "Descrição deve ter no máximo 120 caracteres.";
  }
  if (Number.isNaN(valor) || valor <= 0) {
    campos.valor = "Valor deve ser número maior que zero.";
  }
  if (!data) {
    campos.data = "Data é obrigatória.";
  }
  if (Number.isNaN(categoriaId) || categoriaId <= 0) {
    campos.categoriaId = "categoriaId é obrigatório.";
  }
  if (Number.isNaN(fonteDestinoId) || fonteDestinoId <= 0) {
    campos.fonteDestinoId = "fonteDestinoId é obrigatório.";
  }
  if (parcelas < 1 || parcelas > 48) {
    campos.parcelas = "parcelas deve ser inteiro entre 1 e 48.";
  }

  if (Object.keys(campos).length > 0) {
    erroEl.textContent = "Dados inválidos: " + Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join("; ");
    erroEl.hidden = false;
    return;
  }

  const editando = lancamentoEditandoId !== null;
  submitBtn.disabled = true;
  submitBtn.textContent = editando ? "Salvando..." : "Criando...";

  try {
    const body = {
      tipo,
      descricao,
      valor,
      data,
      categoriaId,
      fonteDestinoId
    };
    if (!editando && parcelas > 1) {
      body.parcelas = parcelas;
    }

    if (editando) {
      await api("/lancamentos/" + lancamentoEditandoId, { method: "PUT", body, token });
    } else {
      await api("/lancamentos", { method: "POST", body, token });
    }

    // Success: reload list and reset form
    resetLancamentoForm();
    carregarLancamentos(1);
  } catch (err) {
    erroEl.textContent = escapeHtml(err.message || (editando ? "Erro ao atualizar lançamento." : "Erro ao criar lançamento."));
    erroEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editando ? "Salvar" : "Criar Lançamento";
  }
}

function resetLancamentoForm() {
  lancamentoEditandoId = null;
  const form = document.getElementById("form-criar-lancamento");
  if (form) form.reset();
  const categoriaSelect = document.getElementById("lanc-categoria");
  if (categoriaSelect) {
    categoriaSelect.innerHTML = `<option value="">Selecione o tipo primeiro</option>`;
    categoriaSelect.disabled = true;
  }
  const titulo = document.querySelector("#lancamentos-form-card h2");
  const submitBtn = document.querySelector("#form-criar-lancamento button[type=\"submit\"]");
  const cancelarBtn = document.getElementById("btn-cancelar-edicao");
  const erroEl = document.getElementById("lancamento-erro");
  const parcelasGroup = document.getElementById("lanc-parcelas").closest(".form-group");
  if (titulo) titulo.textContent = "Novo Lançamento";
  if (submitBtn) submitBtn.textContent = "Criar Lançamento";
  if (cancelarBtn) cancelarBtn.hidden = true;
  if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; }
  if (parcelasGroup) parcelasGroup.hidden = false;
}

async function editarLancamento(id) {
  const token = getToken();
  if (!token) return;

  const erroEl = document.getElementById("lancamento-erro");
  if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; }

  try {
    const item = await api("/lancamentos/" + id, { token });
    lancamentoEditandoId = id;

    // Ensure form is rendered
    renderLancamentosForm();

    const titulo = document.querySelector("#lancamentos-form-card h2");
    const submitBtn = document.querySelector("#form-criar-lancamento button[type=\"submit\"]");
    const cancelarBtn = document.getElementById("btn-cancelar-edicao");
    const tipoSelect = document.getElementById("lanc-tipo");
    const categoriaSelect = document.getElementById("lanc-categoria");
    const fonteSelect = document.getElementById("lanc-fonte");
    const valorInput = document.getElementById("lanc-valor");
    const dataInput = document.getElementById("lanc-data");
    const descricaoInput = document.getElementById("lanc-descricao");
    const parcelasGroup = document.getElementById("lanc-parcelas").closest(".form-group");

    if (titulo) titulo.textContent = "Editar Lançamento";
    if (submitBtn) submitBtn.textContent = "Salvar";
    if (cancelarBtn) cancelarBtn.hidden = false;

    if (tipoSelect) {
      tipoSelect.value = item.tipo;
      tipoSelect.dispatchEvent(new Event("change"));
    }

    // Wait for categoria options to populate
    setTimeout(() => {
      if (categoriaSelect) categoriaSelect.value = item.categoria?.id || "";
      if (fonteSelect) fonteSelect.value = item.fonteDestino?.id || "";
      if (valorInput) valorInput.value = item.valor;
      if (dataInput) dataInput.value = item.data;
      if (descricaoInput) descricaoInput.value = item.descricao || "";
      if (parcelasGroup) parcelasGroup.hidden = true;
    }, 0);

    const formCard = document.getElementById("lancamentos-form-card");
    if (formCard && formCard.scrollIntoView) formCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    if (erroEl) {
      erroEl.textContent = escapeHtml(err.message || "Erro ao carregar lançamento para edição.");
      erroEl.hidden = false;
    }
  }
}

async function excluirLancamento(id) {
  const token = getToken();
  if (!token) return;

  const erroEl = document.getElementById("lancamentos-erro");
  if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; }

  // Find item in cache
  let item = lancamentosCache.find(l => l.id === id);
  if (!item) {
    try {
      item = await api("/lancamentos/" + id, { token });
    } catch (err) {
      if (erroEl) {
        erroEl.textContent = escapeHtml(err.message || "Erro ao buscar lançamento.");
        erroEl.hidden = false;
      }
      return;
    }
  }

  const descricao = item.descricao || "este lançamento";
  const parcela = item.parcela || "";
  let todasParcelas = false;

  if (parcela && parcela.includes("/")) {
    const partes = parcela.split("/");
    const total = parseInt(partes[1], 10);
    if (total > 1) {
      const confirmAll = window.confirm(
        `"${descricao}" faz parte de um parcelamento (${parcela}). Excluir TODAS as parcelas desta compra?\n\nOK = todas as parcelas — Cancelar = decidir só esta`
      );
      if (confirmAll) {
        todasParcelas = true;
      } else {
        const confirmOne = window.confirm("Excluir apenas esta parcela?");
        if (!confirmOne) return;
      }
    } else {
      if (!window.confirm(`Excluir "${descricao}"?`)) return;
    }
  } else {
    if (!window.confirm(`Excluir "${descricao}"?`)) return;
  }

  try {
    const url = todasParcelas ? "/lancamentos/" + id + "?todasParcelas=true" : "/lancamentos/" + id;
    await api(url, { method: "DELETE", token });
    // Reload current page
    const btnAnterior = document.getElementById("btn-pagina-anterior");
    const paginaAtual = btnAnterior ? parseInt(btnAnterior.dataset.pagina || "1", 10) : 1;
    carregarLancamentos(paginaAtual);
  } catch (err) {
    if (erroEl) {
      erroEl.textContent = escapeHtml(err.message || "Erro ao excluir lançamento.");
      erroEl.hidden = false;
    }
  }
}

async function baixarModeloImportacao() {
  const token = getToken();
  if (!token) {
    const resultadoEl = document.getElementById("import-resultado");
    if (resultadoEl) {
      resultadoEl.textContent = "Sessão expirada. Faça login novamente.";
      resultadoEl.className = "alert alert-error";
      resultadoEl.hidden = false;
    }
    return;
  }

  const resultadoEl = document.getElementById("import-resultado");
  if (resultadoEl) {
    resultadoEl.hidden = true;
    resultadoEl.textContent = "";
    resultadoEl.className = "";
  }

  try {
    const res = await fetch(API_BASE + "/lancamentos/importar/modelo", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!res.ok) {
      let msg = "Erro ao baixar modelo.";
      if (res.status === 401) {
        msg = "Sessão expirada. Faça login novamente.";
        clearToken();
      } else {
        const data = await res.json().catch(() => ({}));
        if (data && data.erro) msg = data.erro;
      }
      if (resultadoEl) {
        resultadoEl.textContent = escapeHtml(msg);
        resultadoEl.className = "alert alert-error";
        resultadoEl.hidden = false;
      }
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-lancamentos.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (err) {
    if (resultadoEl) {
      resultadoEl.textContent = escapeHtml(err.message || "Erro ao baixar modelo.");
      resultadoEl.className = "alert alert-error";
      resultadoEl.hidden = false;
    }
  }
}

async function exportarLancamentos() {
  const token = getToken();
  const erroEl = document.getElementById("lancamentos-erro");
  if (!token) {
    if (erroEl) {
      erroEl.textContent = "Sessão expirada. Faça login novamente.";
      erroEl.hidden = false;
    }
    return;
  }

  const inicio = document.getElementById("filtro-inicio") ? document.getElementById("filtro-inicio").value : "";
  const fim = document.getElementById("filtro-fim") ? document.getElementById("filtro-fim").value : "";
  const tipo = document.getElementById("filtro-tipo") ? document.getElementById("filtro-tipo").value : "";
  const params = new URLSearchParams();
  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);
  if (tipo) params.set("tipo", tipo);

  if (erroEl) {
    erroEl.hidden = true;
    erroEl.textContent = "";
  }

  try {
    const res = await fetch(API_BASE + "/lancamentos/exportar?" + params.toString(), {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) {
      let msg = "Erro ao exportar.";
      if (res.status === 401) {
        msg = "Sessão expirada. Faça login novamente.";
        clearToken();
      } else {
        const data = await res.json().catch(() => ({}));
        if (data && data.erro) msg = data.erro;
      }
      if (erroEl) {
        erroEl.textContent = escapeHtml(msg);
        erroEl.hidden = false;
      }
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lancamentos.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (err) {
    if (erroEl) {
      erroEl.textContent = escapeHtml(err.message || "Erro ao exportar.");
      erroEl.hidden = false;
    }
  }
}

async function importarArquivoCsv() {
  const fileInput = document.getElementById("import-arquivo");
  const btnImportar = document.getElementById("btn-importar");
  const resultadoEl = document.getElementById("import-resultado");

  if (!fileInput || !fileInput.files.length) {
    if (resultadoEl) {
      resultadoEl.textContent = "Selecione um arquivo (.xlsx ou .csv).";
      resultadoEl.className = "alert alert-error";
      resultadoEl.hidden = false;
    }
    return;
  }

  const token = getToken();
  if (!token) {
    if (resultadoEl) {
      resultadoEl.textContent = "Sessão expirada. Faça login novamente.";
      resultadoEl.className = "alert alert-error";
      resultadoEl.hidden = false;
    }
    return;
  }

  const file = fileInput.files[0];
  const ehXlsx = /\.xlsx$/i.test(file.name) || (file.type || "").indexOf("spreadsheetml") !== -1;
  const contentType = ehXlsx
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
  let corpo;
  try {
    corpo = ehXlsx ? await file.arrayBuffer() : await file.text();
  } catch (err) {
    if (resultadoEl) {
      resultadoEl.textContent = escapeHtml("Erro ao ler o arquivo: " + err.message);
      resultadoEl.className = "alert alert-error";
      resultadoEl.hidden = false;
    }
    return;
  }

  if (btnImportar) {
    btnImportar.disabled = true;
    btnImportar.textContent = "Importando…";
  }
  if (resultadoEl) {
    resultadoEl.hidden = true;
    resultadoEl.textContent = "";
    resultadoEl.className = "";
  }

  try {
    const res = await fetch(API_BASE + "/lancamentos/importar", {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: "Bearer " + token
      },
      body: corpo
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 201) {
      const importados = data && data.importados ? data.importados : 0;
      const catsCriadas = data && data.categoriasCriadas ? data.categoriasCriadas : 0;
      const fontesCriadas = data && data.fontesCriadas ? data.fontesCriadas : 0;
      let msg = "Importados " + importados + " lançamento(s).";
      if (catsCriadas || fontesCriadas) {
        msg += " Criados automaticamente: " + catsCriadas + " categoria(s) e " + fontesCriadas + " fonte/destino.";
      }
      if (resultadoEl) {
        resultadoEl.innerHTML = escapeHtml(msg);
        resultadoEl.className = "alert alert-success";
        resultadoEl.hidden = false;
      }
      fileInput.value = "";
      if (token) {
        carregarCategoriasETipos(token);
        carregarFontesDestinos(token);
      }
      carregarLancamentos(1);
    } else if (res.status === 400) {
      let html = escapeHtml(data && data.erro ? data.erro : "Erro na importação.");
      if (data && Array.isArray(data.linhas) && data.linhas.length > 0) {
        html += "<ul class=\"import-erros\">";
        for (const item of data.linhas) {
          const linha = item && item.linha ? item.linha : "?";
          const coluna = item && item.coluna ? item.coluna : "";
          const msg = item && item.mensagem ? item.mensagem : "Erro desconhecido";
          if (coluna && coluna !== "linha") {
            html += "<li>" + escapeHtml("Linha " + linha + ", coluna " + coluna + ": " + msg) + "</li>";
          } else {
            html += "<li>" + escapeHtml("Linha " + linha + ": " + msg) + "</li>";
          }
        }
        html += "</ul>";
      }
      if (resultadoEl) {
        resultadoEl.innerHTML = html;
        resultadoEl.className = "alert alert-error";
        resultadoEl.hidden = false;
      }
    } else if (res.status === 401) {
      if (resultadoEl) {
        resultadoEl.textContent = "Sessão expirada. Faça login novamente.";
        resultadoEl.className = "alert alert-error";
        resultadoEl.hidden = false;
      }
      clearToken();
    } else {
      if (resultadoEl) {
        resultadoEl.textContent = escapeHtml(data && data.erro ? data.erro : ("Erro HTTP " + res.status));
        resultadoEl.className = "alert alert-error";
        resultadoEl.hidden = false;
      }
    }
  } catch (err) {
    if (resultadoEl) {
      resultadoEl.textContent = escapeHtml(err.message || "Erro ao importar arquivo.");
      resultadoEl.className = "alert alert-error";
      resultadoEl.hidden = false;
    }
  } finally {
    if (btnImportar) {
      btnImportar.disabled = false;
      btnImportar.textContent = "Importar";
    }
  }
}

async function carregarLancamentos(pagina = 1) {
  const token = getToken();
  if (!token) return;

  const inicio = document.getElementById("filtro-inicio")?.value || "";
  const fim = document.getElementById("filtro-fim")?.value || "";
  const tipo = document.getElementById("filtro-tipo")?.value || "";

  const tbody = document.getElementById("lancamentos-tbody");
  const erroEl = document.getElementById("lancamentos-erro");
  const btnFiltrar = document.getElementById("btn-filtrar");
  const btnAnterior = document.getElementById("btn-pagina-anterior");
  const btnProxima = document.getElementById("btn-pagina-proxima");

  if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">Carregando…</td></tr>`;
  if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; }
  if (btnFiltrar) { btnFiltrar.disabled = true; btnFiltrar.textContent = "Carregando…"; }
  if (btnAnterior) btnAnterior.disabled = true;
  if (btnProxima) btnProxima.disabled = true;

  try {
    const params = new URLSearchParams();
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);
    if (tipo) params.set("tipo", tipo);
    params.set("pagina", String(pagina));

    const data = await api("/lancamentos?" + params.toString(), { token });

    const resumo = data.resumo || { entradas: 0, saidas: 0, saldo: 0 };
    const entradasEl = document.getElementById("resumo-entradas");
    const saidasEl = document.getElementById("resumo-saidas");
    const saldoEl = document.getElementById("resumo-saldo");
    if (entradasEl) entradasEl.textContent = formatCurrency(resumo.entradas);
    if (saidasEl) saidasEl.textContent = formatCurrency(resumo.saidas);
    if (saldoEl) {
      saldoEl.textContent = formatCurrency(resumo.saldo);
      saldoEl.className = "resumo-valor" + (resumo.saldo >= 0 ? " positivo" : " negativo");
    }

    const itens = data.itens || [];
    lancamentosCache = itens;
    if (tbody) {
      if (itens.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">Nenhum lançamento encontrado.</td></tr>`;
      } else {
        tbody.innerHTML = itens.map(item => `
          <tr>
            <td>${escapeHtml(item.data)}</td>
            <td>${escapeHtml(item.descricao)}</td>
            <td>${escapeHtml(item.categoria?.nome || "")}</td>
            <td>${escapeHtml(item.fonteDestino?.nome || "")}</td>
            <td>${escapeHtml(item.parcela || "")}</td>
            <td class="text-right ${item.tipo === "entrada" ? "positivo" : "negativo"}">
              ${item.tipo === "entrada" ? "+" : "-"} ${formatCurrency(item.valor)}
            </td>
            <td class="text-right">
              <div class="acoes">
                <button type="button" class="secondary btn-sm" data-editar-lanc="${item.id}">Editar</button>
                <button type="button" class="secondary btn-sm" data-excluir-lanc="${item.id}">Excluir</button>
              </div>
            </td>
          </tr>
        `).join("");
      }

      // Wire edit/delete buttons
      tbody.querySelectorAll("[data-editar-lanc]").forEach(btn => {
        btn.addEventListener("click", () => editarLancamento(parseInt(btn.dataset.editarLanc, 10)));
      });
      tbody.querySelectorAll("[data-excluir-lanc]").forEach(btn => {
        btn.addEventListener("click", () => excluirLancamento(parseInt(btn.dataset.excluirLanc, 10)));
      });
    }

    const paginaAtual = data.pagina || 1;
    const totalPaginas = data.totalPaginas || 1;
    const infoEl = document.getElementById("paginacao-info");
    if (infoEl) infoEl.textContent = `Página ${paginaAtual} de ${totalPaginas || 1}`;

    if (btnAnterior) {
      btnAnterior.disabled = paginaAtual <= 1;
      btnAnterior.dataset.pagina = String(paginaAtual);
    }
    if (btnProxima) {
      btnProxima.disabled = paginaAtual >= totalPaginas;
      btnProxima.dataset.pagina = String(paginaAtual);
      btnProxima.dataset.total = String(totalPaginas);
    }

  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center">Erro ao carregar.</td></tr>`;
    if (erroEl) {
      erroEl.textContent = escapeHtml(err.message || "Erro ao carregar lançamentos.");
      erroEl.hidden = false;
    }
  } finally {
    if (btnFiltrar) { btnFiltrar.disabled = false; btnFiltrar.textContent = "Filtrar"; }
  }
}

// --- Relatórios view ---
function renderRelatorios() {
  const panel = document.getElementById("panel-relatorios");
  if (!panel) return;

  const { inicio, fim } = getCurrentMonthRange();

  panel.innerHTML = `
    <h1>Relatórios</h1>

    <div class="card" id="relatorios-filtro-periodo">
      <h2>Período</h2>
      <div class="filtros-row">
        <div class="form-group">
          <label for="rel-inicio">Início</label>
          <input type="date" id="rel-inicio" name="inicio" value="${escapeHtml(inicio)}">
        </div>
        <div class="form-group">
          <label for="rel-fim">Fim</label>
          <input type="date" id="rel-fim" name="fim" value="${escapeHtml(fim)}">
        </div>
        <div class="form-group filtro-submit">
          <button type="button" id="btn-rel-consultar" class="primary">Consultar</button>
        </div>
      </div>
      <div id="relatorios-erro" class="alert alert-error" hidden></div>
    </div>

    <div class="card" id="relatorio-categorias">
      <h2>Por categoria</h2>
      <div id="relatorio-categorias-conteudo">
        <p class="text-center">Clique em "Consultar" para carregar o relatório.</p>
      </div>
    </div>

    <!-- Containers for future sections (Todo 8, Todo 9) -->
    <div class="card" id="relatorio-fontes" hidden>
      <h2>Por fonte/destino</h2>
      <div id="relatorio-fontes-conteudo"></div>
    </div>

    <div class="card" id="relatorio-faturas" hidden>
      <h2>Faturas</h2>
      <div class="filtros-row filtros-row-spaced">
        <div class="form-group">
          <label for="rel-faturas-meses">Meses (1–12)</label>
          <input type="number" id="rel-faturas-meses" name="meses" min="1" max="12" value="3" class="input-small">
        </div>
        <div class="form-group filtro-submit">
          <button type="button" id="btn-rel-faturas-consultar" class="primary">Consultar</button>
        </div>
      </div>
      <div id="relatorios-faturas-erro" class="alert alert-error" hidden></div>
      <div id="relatorio-faturas-conteudo"></div>
    </div>
  `;

  const btnConsultar = document.getElementById("btn-rel-consultar");
  if (btnConsultar) {
    btnConsultar.addEventListener("click", () => {
      carregarRelatorioCategorias();
      carregarRelatorioFontes();
    });
  }

  const btnFaturasConsultar = document.getElementById("btn-rel-faturas-consultar");
  if (btnFaturasConsultar) {
    btnFaturasConsultar.addEventListener("click", () => {
      carregarRelatorioFaturas();
    });
  }

  ["rel-inicio", "rel-fim"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          carregarRelatorioCategorias();
          carregarRelatorioFontes();
        }
      });
    }
  });

  const mesesInput = document.getElementById("rel-faturas-meses");
  if (mesesInput) {
    mesesInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        carregarRelatorioFaturas();
      }
    });
  }

  carregarRelatorioCategorias();
  carregarRelatorioFontes();
  carregarRelatorioFaturas();
}

// --- Saúde Financeira view ---
async function renderSaudeFinanceira() {
  const panel = document.getElementById("panel-saude");
  if (!panel) return;

  const token = getToken();
  if (!token) {
    panel.innerHTML = `<div class="alert alert-error">Sessão expirada. Faça login novamente.</div>`;
    return;
  }

  panel.innerHTML = `<p class="text-center">Carregando…</p>`;

  try {
    const data = await api("/saude-financeira", { token });

    const aviso = data.aviso || "";
    const ind = data.indicadores || {};
    const projecao = data.projecao || [];
    const dicas = data.dicas || [];

    let html = "";

    // 1. Aviso banner
    if (aviso) {
      html += `<div class="alert alert-info">${escapeHtml(aviso)}</div>`;
    }

    // 2. Scalar indicators cards grid
    const taxaPoupanca = Number(ind.taxaPoupanca || 0);
    const comprometimentoCartoes = Number(ind.comprometimentoCartoes || 0);
    const mesesDeReserva = Number(ind.mesesDeReserva || 0);
    const indiceEndividamento = Number(ind.indiceEndividamento || 0);
    const runwayMeses = Number(ind.runwayMeses || 0);
    const scoreSaude = Number(ind.scoreSaude || 0);

    html += `
      <div class="card">
        <h2>Indicadores Principais</h2>
        <div class="resumo-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
          <div class="resumo-item">
            <span class="resumo-label">Taxa de Poupança ${ajuda("Percentual da sua renda mensal que sobra após as despesas: (entradas − saídas) ÷ entradas. O recomendado é poupar ao menos 10%.")}</span>
            <span class="resumo-valor">${escapeHtml((taxaPoupanca * 100).toFixed(2))}%</span>
          </div>
          <div class="resumo-item">
            <span class="resumo-label">Comprometimento Cartões ${ajuda("Quanto da sua renda mensal média está comprometida com faturas de cartão dos últimos 3 meses. Acima de 30% é considerado elevado.")}</span>
            <span class="resumo-valor">${escapeHtml((comprometimentoCartoes * 100).toFixed(2))}%</span>
          </div>
          <div class="resumo-item">
            <span class="resumo-label">Meses de Reserva ${ajuda("Quantos meses das suas despesas a sua reserva de emergência cobre. O ideal é ter de 3 a 6 meses.")}</span>
            <span class="resumo-valor">${escapeHtml(mesesDeReserva.toFixed(2))}</span>
          </div>
          <div class="resumo-item">
            <span class="resumo-label">Índice de Endividamento ${ajuda("Parte da renda dos próximos 12 meses já comprometida com parcelas futuras do cartão. Acima de 15% é considerado alto.")}</span>
            <span class="resumo-valor">${escapeHtml((indiceEndividamento * 100).toFixed(2))}%</span>
          </div>
          <div class="resumo-item">
            <span class="resumo-label">Runway (meses) ${ajuda("Por quantos meses o saldo das suas contas cobriria as despesas, sem novas entradas. Faixa saudável: 3 a 6 meses.")}</span>
            <span class="resumo-valor">${escapeHtml(runwayMeses.toFixed(2))}</span>
          </div>
          <div class="resumo-item">
            <span class="resumo-label">Score de Saúde ${ajuda("Nota de 0 a 100 que resume sua saúde financeira, combinando taxa de poupança, comprometimento com cartões e meses de reserva.")}</span>
            <span class="resumo-valor">${escapeHtml(String(Math.round(scoreSaude)))}</span>
          </div>
        </div>
      </div>
    `;

    // 3. 50/30/20 sub-table
    const dist = ind.distribuicao503020 || {};
    const necessidades = dist.necessidades || { total: 0, percentual: 0 };
    const desejos = dist.desejos || { total: 0, percentual: 0 };
    const poupanca = dist.poupanca || { total: 0, percentual: 0 };
    const naoClassificado = dist.naoClassificado || { total: 0, percentual: 0 };

    html += `
      <div class="card">
        <h2>Distribuição 50/30/20 ${ajuda("Regra que sugere destinar 50% da renda a necessidades, 30% a desejos e 20% a poupança.")}</h2>
        <table class="relatorio-tabela">
          <thead>
            <tr>
              <th>Categoria</th>
              <th class="text-right">Total</th>
              <th class="text-right">%</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml("Necessidades")}</td>
              <td class="text-right">${formatCurrency(necessidades.total)}</td>
              <td class="text-right">${escapeHtml((Number(necessidades.percentual) * 100).toFixed(2))}%</td>
            </tr>
            <tr>
              <td>${escapeHtml("Desejos")}</td>
              <td class="text-right">${formatCurrency(desejos.total)}</td>
              <td class="text-right">${escapeHtml((Number(desejos.percentual) * 100).toFixed(2))}%</td>
            </tr>
            <tr>
              <td>${escapeHtml("Poupança")}</td>
              <td class="text-right">${formatCurrency(poupanca.total)}</td>
              <td class="text-right">${escapeHtml((Number(poupanca.percentual) * 100).toFixed(2))}%</td>
            </tr>
            <tr>
              <td>${escapeHtml("Não Classificado")}</td>
              <td class="text-right">${formatCurrency(naoClassificado.total)}</td>
              <td class="text-right">${escapeHtml((Number(naoClassificado.percentual) * 100).toFixed(2))}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // 4. Out-of-curve list
    const foraDaCurva = Array.isArray(ind.categoriasForaDaCurva) ? ind.categoriasForaDaCurva : [];
    if (foraDaCurva.length > 0) {
      const rowsFora = foraDaCurva.map(cat => `
        <tr>
          <td>${escapeHtml(cat.nome || "")}</td>
          <td class="text-right">${formatCurrency(cat.total)}</td>
          <td class="text-right">${formatCurrency(cat.mediaAnterior)}</td>
          <td class="text-right">${escapeHtml(Number(cat.ratio || 0).toFixed(2))}x</td>
        </tr>
      `).join("");
      html += `
        <div class="card">
          <h2>Categorias Fora da Curva (> 1.30× média anterior) ${ajuda("Categorias cujos gastos no mês ficaram mais de 30% acima da média dos 3 meses anteriores.")}</h2>
          <table class="relatorio-tabela">
            <thead>
              <tr>
                <th>Categoria</th>
                <th class="text-right">Total Atual</th>
                <th class="text-right">Média Anterior (3m)</th>
                <th class="text-right">Ratio</th>
              </tr>
            </thead>
            <tbody>${rowsFora}</tbody>
          </table>
        </div>
      `;
    }

    // 5. Top-3 concentration list
    const conc = ind.concentracaoGastos || { categorias: [], totalGastos: 0, indiceConcentracao: 0 };
    if (conc.categorias && conc.categorias.length > 0) {
      const rowsConc = conc.categorias.map(cat => `
        <tr>
          <td>${escapeHtml(cat.nome || "")}</td>
          <td class="text-right">${formatCurrency(cat.total)}</td>
          <td class="text-right">${escapeHtml((Number(cat.percentual || 0) * 100).toFixed(2))}%</td>
        </tr>
      `).join("");
      html += `
        <div class="card">
          <h2>Concentração de Gastos (Top 3) ${ajuda("Peso das suas 3 maiores categorias no total de despesas do mês. Índices altos indicam gastos pouco diversificados.")}</h2>
          <p class="text-muted">Índice de concentração: ${escapeHtml((Number(conc.indiceConcentracao || 0) * 100).toFixed(2))}% do total de ${formatCurrency(conc.totalGastos)}</p>
          <table class="relatorio-tabela">
            <thead>
              <tr>
                <th>Categoria</th>
                <th class="text-right">Total</th>
                <th class="text-right">%</th>
              </tr>
            </thead>
            <tbody>${rowsConc}</tbody>
          </table>
        </div>
      `;
    }

    // 6. Trend line
    const tend = ind.tendenciaGastos || {};
    if (tend.mesAtual) {
      const variacao = Number(tend.variacaoPercentual || 0);
      const direcao = tend.direcao || "estavel";
      const direcaoLabel = direcao === "alta" ? "Alta" : direcao === "baixa" ? "Baixa" : "Estável";
      const direcaoClass = direcao === "alta" ? "negativo" : direcao === "baixa" ? "positivo" : "";
      html += `
        <div class="card">
          <h2>Tendência de Gastos ${ajuda("Comparação das despesas do mês atual com a média dos últimos 3 meses (variação de ±10% define alta, baixa ou estável).")}</h2>
          <div class="resumo-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
            <div class="resumo-item">
              <span class="resumo-label">Mês Atual</span>
              <span class="resumo-valor">${escapeHtml(tend.mesAtual)}</span>
            </div>
            <div class="resumo-item">
              <span class="resumo-label">Saídas do Mês</span>
              <span class="resumo-valor">${formatCurrency(tend.saidasMesAtual)}</span>
            </div>
            <div class="resumo-item">
              <span class="resumo-label">Média 3 Meses</span>
              <span class="resumo-valor">${formatCurrency(tend.media3Meses)}</span>
            </div>
            <div class="resumo-item">
              <span class="resumo-label">Variação</span>
              <span class="resumo-valor ${direcaoClass}">${variacao >= 0 ? "+" : ""}${escapeHtml(variacao.toFixed(2))}%</span>
            </div>
            <div class="resumo-item">
              <span class="resumo-label">Direção</span>
              <span class="resumo-valor ${direcaoClass}">${escapeHtml(direcaoLabel)}</span>
            </div>
          </div>
        </div>
      `;
    }

    // 7. Projection table
    if (projecao.length > 0) {
      const rowsProj = projecao.map(p => {
        const saldo = Number(p.saldoPrevisto || 0);
        const negativoClass = saldo < 0 ? " negativo" : "";
        return `
          <tr class="${negativoClass}">
            <td>${escapeHtml(p.mes || "")}</td>
            <td class="text-right">${formatCurrency(p.entradas)}</td>
            <td class="text-right">${formatCurrency(p.saidas)}</td>
            <td class="text-right${negativoClass}">${formatCurrency(saldo)}</td>
          </tr>
        `;
      }).join("");
      html += `
        <div class="card">
          <h2>Projeção (6 meses) ${ajuda("Estimativa do seu saldo nos próximos 6 meses, combinando a média de entradas, a média de saídas e as parcelas futuras do cartão.")}</h2>
          <table class="relatorio-tabela">
            <thead>
              <tr>
                <th>Mês</th>
                <th class="text-right">Entradas</th>
                <th class="text-right">Saídas</th>
                <th class="text-right">Saldo Previsto</th>
              </tr>
            </thead>
            <tbody>${rowsProj}</tbody>
          </table>
          <p class="text-muted mt-2">Linhas em vermelho indicam saldo previsto negativo.</p>
        </div>
      `;
    }

    // 8. Dicas list
    if (dicas.length > 0) {
      const dicasHtml = dicas.map(d => `<li>${escapeHtml(d)}</li>`).join("");
      html += `
        <div class="card">
          <h2>Dicas</h2>
          <ul>${dicasHtml}</ul>
        </div>
      `;
    }

    panel.innerHTML = html;

  } catch (err) {
    if (err.status === 401) {
      clearToken();
      panel.innerHTML = `<div class="alert alert-error">Sessão expirada. Faça login novamente.</div>`;
    } else {
      panel.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || "Erro ao carregar saúde financeira.")}</div>`;
    }
  }
}

async function carregarRelatorioCategorias() {
  const token = getToken();
  if (!token) return;

  const inicio = document.getElementById("rel-inicio")?.value || "";
  const fim = document.getElementById("rel-fim")?.value || "";
  const conteudoEl = document.getElementById("relatorio-categorias-conteudo");
  const erroEl = document.getElementById("relatorios-erro");
  const btnConsultar = document.getElementById("btn-rel-consultar");

  if (conteudoEl) conteudoEl.innerHTML = `<p class="text-center">Carregando…</p>`;
  if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; }
  if (btnConsultar) { btnConsultar.disabled = true; btnConsultar.textContent = "Carregando…"; }

  try {
    const params = new URLSearchParams();
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);

    const data = await api("/relatorios/categorias?" + params.toString(), { token });

    const periodo = data.periodo || { inicio, fim };
    const periodoAnterior = data.periodoAnterior || { inicio: "", fim: "" };
    const saidas = data.saidas || { total: 0, categorias: [] };
    const entradas = data.entradas || { total: 0, categorias: [] };

    let html = `
      <div class="periodo-info">
        <div class="periodo-atual">
          <strong>Período atual:</strong> ${escapeHtml(periodo.inicio)} a ${escapeHtml(periodo.fim)}
        </div>
        <div class="periodo-anterior">
          <strong>Período anterior:</strong> ${escapeHtml(periodoAnterior.inicio)} a ${escapeHtml(periodoAnterior.fim)}
        </div>
      </div>

      <div class="relatorio-secao">
        <h3>Saídas <span class="total-badge">${formatCurrency(saidas.total)}</span></h3>
        ${renderCategoriasTabela(saidas.categorias)}
      </div>

      <div class="relatorio-secao">
        <h3>Entradas <span class="total-badge">${formatCurrency(entradas.total)}</span></h3>
        ${renderCategoriasTabela(entradas.categorias)}
      </div>
    `;

    if (conteudoEl) conteudoEl.innerHTML = html;

  } catch (err) {
    if (conteudoEl) conteudoEl.innerHTML = `<p class="text-center">Erro ao carregar relatório.</p>`;
    if (erroEl) {
      erroEl.textContent = escapeHtml(err.message || "Erro ao carregar relatório.");
      erroEl.hidden = false;
    }
  } finally {
    if (btnConsultar) { btnConsultar.disabled = false; btnConsultar.textContent = "Consultar"; }
  }
}

async function carregarRelatorioFontes() {
  const token = getToken();
  if (!token) return;

  const inicio = document.getElementById("rel-inicio")?.value || "";
  const fim = document.getElementById("rel-fim")?.value || "";
  const conteudoEl = document.getElementById("relatorio-fontes-conteudo");
  const containerEl = document.getElementById("relatorio-fontes");
  const erroEl = document.getElementById("relatorios-erro");

  if (conteudoEl) conteudoEl.innerHTML = `<p class="text-center">Carregando…</p>`;
  if (containerEl) containerEl.hidden = false;
  if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; }

  try {
    const params = new URLSearchParams();
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);

    const data = await api("/relatorios/fontes-destinos?" + params.toString(), { token });

    const periodo = data.periodo || { inicio, fim };
    const entradas = data.entradas || [];
    const saidas = data.saidas || [];
    const contas = data.contas || [];

    let html = `
      <div class="periodo-info">
        <div class="periodo-atual">
          <strong>Período:</strong> ${escapeHtml(periodo.inicio)} a ${escapeHtml(periodo.fim)}
        </div>
      </div>

      <div class="relatorio-secao">
        <h3>Entradas por fonte <span class="total-badge">${formatCurrency(entradas.reduce((sum, e) => sum + e.total, 0))}</span></h3>
        ${renderFontesTabela(entradas, "entrada")}
      </div>

      <div class="relatorio-secao">
        <h3>Saídas por destino <span class="total-badge">${formatCurrency(saidas.reduce((sum, s) => sum + s.total, 0))}</span></h3>
        ${renderFontesTabela(saidas, "saida")}
      </div>

      <div class="relatorio-secao">
        <h3>Saldo das contas</h3>
        ${renderContasTabela(contas)}
      </div>
    `;

    if (conteudoEl) conteudoEl.innerHTML = html;

  } catch (err) {
    if (conteudoEl) conteudoEl.innerHTML = `<p class="text-center">Erro ao carregar relatório.</p>`;
    if (erroEl) {
      erroEl.textContent = escapeHtml(err.message || "Erro ao carregar relatório.");
      erroEl.hidden = false;
    }
  }
}

// --- Relatório Faturas ---
async function carregarRelatorioFaturas() {
  const token = getToken();
  if (!token) return;

  const mesesInput = document.getElementById("rel-faturas-meses");
  const meses = mesesInput ? parseInt(mesesInput.value, 10) : 3;
  const conteudoEl = document.getElementById("relatorio-faturas-conteudo");
  const containerEl = document.getElementById("relatorio-faturas");
  const erroEl = document.getElementById("relatorios-faturas-erro");
  const btnConsultar = document.getElementById("btn-rel-faturas-consultar");

  if (conteudoEl) conteudoEl.innerHTML = `<p class="text-center">Carregando…</p>`;
  if (containerEl) containerEl.hidden = false;
  if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; }
  if (btnConsultar) { btnConsultar.disabled = true; btnConsultar.textContent = "Carregando…"; }

  try {
    const data = await api("/relatorios/faturas?meses=" + encodeURIComponent(meses), { token });

    const hoje = data.hoje || "";
    const cartoes = data.cartoes || [];

    let html = `
      <div class="periodo-info">
        <div class="periodo-atual">
          <strong>Data de referência:</strong> ${escapeHtml(hoje)}
        </div>
      </div>
    `;

    if (cartoes.length === 0) {
      html += `<p class="text-center">Nenhum cartão de crédito cadastrado.</p>`;
    } else {
      for (const cartao of cartoes) {
        html += renderFaturasCartao(cartao);
      }
    }

    if (conteudoEl) conteudoEl.innerHTML = html;

  } catch (err) {
    if (conteudoEl) conteudoEl.innerHTML = `<p class="text-center">Erro ao carregar relatório.</p>`;
    if (erroEl) {
      erroEl.textContent = escapeHtml(err.message || "Erro ao carregar relatório.");
      erroEl.hidden = false;
    }
  } finally {
    if (btnConsultar) { btnConsultar.disabled = false; btnConsultar.textContent = "Consultar"; }
  }
}

function renderFaturasCartao(cartao) {
  const faturas = cartao.faturas || [];
  const limite = Number(cartao.limite || 0);
  const limiteUtilizado = Number(cartao.limiteUtilizado || 0);
  const limiteDisponivel = Number(cartao.limiteDisponivel || 0);

  let faturasHtml = "";
  if (faturas.length === 0) {
    faturasHtml = `<p class="text-center">Nenhuma fatura no período.</p>`;
  } else {
    for (const fatura of faturas) {
      const lancamentos = fatura.lancamentos || [];
      let lancamentosHtml = "";
      if (lancamentos.length === 0) {
        lancamentosHtml = `<tr><td colspan="3" class="text-center">Sem lançamentos</td></tr>`;
      } else {
        lancamentosHtml = lancamentos.map(l => `
          <tr>
            <td>${escapeHtml(l.descricao)}</td>
            <td class="text-center">${escapeHtml(l.parcela || "")}</td>
            <td class="text-right negativo">${formatCurrency(l.valor)}</td>
          </tr>
        `).join("");
      }

      faturasHtml += `
        <div class="fatura-bloco">
          <div class="fatura-cabecalho">
            <div>
              <strong>${escapeHtml(fatura.referencia)}</strong>
              <span class="text-muted">Fechamento: ${escapeHtml(fatura.fechamento || "")} | Vencimento: ${escapeHtml(fatura.vencimento || "")}</span>
            </div>
            <span class="text-right negativo">${formatCurrency(fatura.total)}</span>
          </div>
          <table class="relatorio-tabela table-sm">
            <thead>
              <tr>
                <th>Descrição</th>
                <th class="text-center">Parcela</th>
                <th class="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${lancamentosHtml}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  return `
    <div class="relatorio-secao cartao-faturas">
      <div class="cartao-header">
        <h3>${escapeHtml(cartao.nome)}</h3>
        <div>
          <span>Limite: ${formatCurrency(limite)}</span>
          <span class="negativo">Usado: ${formatCurrency(limiteUtilizado)}</span>
          <span class="${limiteDisponivel >= 0 ? "positivo" : "negativo"}">Disponível: ${formatCurrency(limiteDisponivel)}</span>
        </div>
      </div>
      ${faturasHtml}
    </div>
  `;
}

function renderFontesTabela(itens, tipo) {
  if (!itens || itens.length === 0) {
    return `<p class="text-center">Nenhuma ${tipo === "entrada" ? "entrada" : "saída"} no período.</p>`;
  }

  const rows = itens.map(item => `
    <tr>
      <td>${escapeHtml(item.nome)}</td>
      <td class="text-right ${tipo === "entrada" ? "positivo" : "negativo"}">${formatCurrency(item.total)}</td>
    </tr>
  `).join("");

  return `
    <table class="relatorio-tabela">
      <thead>
        <tr>
          <th>${tipo === "entrada" ? "Fonte" : "Destino"}</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderContasTabela(contas) {
  if (!contas || contas.length === 0) {
    return `<p class="text-center">Nenhuma conta no período.</p>`;
  }

  const rows = contas.map(conta => `
    <tr>
      <td>${escapeHtml(conta.nome)}</td>
      <td class="text-right positivo">${formatCurrency(conta.entradas)}</td>
      <td class="text-right negativo">${formatCurrency(conta.saidas)}</td>
      <td class="text-right ${conta.saldo >= 0 ? "positivo" : "negativo"}">${formatCurrency(conta.saldo)}</td>
    </tr>
  `).join("");

  return `
    <table class="relatorio-tabela">
      <thead>
        <tr>
          <th>Conta</th>
          <th class="text-right">Entradas</th>
          <th class="text-right">Saídas</th>
          <th class="text-right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderCategoriasTabela(categorias) {
  if (!categorias || categorias.length === 0) {
    return `<p class="text-center">Nenhuma categoria no período.</p>`;
  }

  const rows = categorias.map(cat => {
    const variacaoHtml = cat.variacao === null
      ? `<span class="variacao-null">—</span>`
      : `<span class="variacao ${cat.variacao >= 0 ? "positivo" : "negativo"}">${cat.variacao >= 0 ? "+" : ""}${cat.variacao.toFixed(2)}%</span>`;

    return `
      <tr>
        <td>${escapeHtml(cat.nome)}</td>
        <td class="text-right">${formatCurrency(cat.total)}</td>
        <td class="text-right">${cat.percentual.toFixed(2)}%</td>
        <td class="text-right">${formatCurrency(cat.anterior)}</td>
        <td class="text-right">${variacaoHtml}</td>
      </tr>
    `;
  }).join("");

  return `
    <table class="relatorio-tabela">
      <thead>
        <tr>
          <th>Categoria</th>
          <th class="text-right">Total</th>
          <th class="text-right">%</th>
          <th class="text-right">Anterior</th>
          <th class="text-right">Variação</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// --- Fontes/Destinos view ---
let fontesCache = [];
let fonteEditandoId = null;

function renderFontes() {
  const panel = document.getElementById("panel-fontes");
  if (!panel) return;

  panel.innerHTML = `
    <h1>Fontes e Destinos</h1>

    <div class="card" id="fonte-form-card">
      <h2 id="fonte-form-titulo">Nova Fonte/Destino</h2>
      <form id="form-fonte" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="fonte-nome">Nome <span class="required">*</span></label>
            <input type="text" id="fonte-nome" name="nome" required maxlength="60" placeholder="Ex.: Conta Corrente, Cartão Nubank...">
          </div>
          <div class="form-group">
            <label for="fonte-tipo">Tipo <span class="required">*</span></label>
            <select id="fonte-tipo" name="tipo" required>
              <option value="">Selecione</option>
              <option value="renda">Renda</option>
              <option value="conta">Conta</option>
              <option value="cartao_credito">Cartão de crédito</option>
            </select>
          </div>
        </div>

        <div class="form-row" id="fonte-cartao-campos" hidden>
          <div class="form-group">
            <label for="fonte-dia-fechamento">Dia de fechamento <span class="required">*</span></label>
            <input type="number" id="fonte-dia-fechamento" name="dia_fechamento" min="1" max="31" placeholder="Ex.: 3">
          </div>
          <div class="form-group">
            <label for="fonte-dia-vencimento">Dia de vencimento <span class="required">*</span></label>
            <input type="number" id="fonte-dia-vencimento" name="dia_vencimento" min="1" max="31" placeholder="Ex.: 10">
          </div>
          <div class="form-group">
            <label for="fonte-limite">Limite (R$) <span class="required">*</span></label>
            <input type="number" id="fonte-limite" name="limite" min="0.01" step="0.01" placeholder="0,00">
          </div>
        </div>

        <div id="fonte-erro" class="alert alert-error" hidden></div>

        <div class="form-actions">
          <button type="submit" class="primary" id="fonte-submit">Criar</button>
          <button type="button" class="secondary" id="fonte-cancelar" hidden>Cancelar</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2>Cadastradas</h2>
      <div id="fonte-lista"><p class="text-center">Carregando…</p></div>
    </div>
  `;

  const form = document.getElementById("form-fonte");
  const tipoSelect = document.getElementById("fonte-tipo");
  const cancelar = document.getElementById("fonte-cancelar");

  if (tipoSelect) tipoSelect.addEventListener("change", atualizarCamposFonte);
  if (form) form.addEventListener("submit", handleSalvarFonte);
  if (cancelar) cancelar.addEventListener("click", resetFormFonte);

  resetFormFonte();
  carregarListaFontes();
}

function atualizarCamposFonte() {
  const tipoEl = document.getElementById("fonte-tipo");
  const tipo = tipoEl ? tipoEl.value : "";
  const cartaoCampos = document.getElementById("fonte-cartao-campos");
  if (cartaoCampos) cartaoCampos.hidden = tipo !== "cartao_credito";
}

function resetFormFonte() {
  fonteEditandoId = null;
  const form = document.getElementById("form-fonte");
  if (form) form.reset();
  atualizarCamposFonte();
  const titulo = document.getElementById("fonte-form-titulo");
  const submit = document.getElementById("fonte-submit");
  const cancelar = document.getElementById("fonte-cancelar");
  const erro = document.getElementById("fonte-erro");
  if (titulo) titulo.textContent = "Nova Fonte/Destino";
  if (submit) submit.textContent = "Criar";
  if (cancelar) cancelar.hidden = true;
  if (erro) { erro.hidden = true; erro.textContent = ""; }
}

async function carregarListaFontes() {
  const container = document.getElementById("fonte-lista");
  if (!container) return;
  const token = getToken();
  if (!token) {
    container.innerHTML = `<p class="text-center">Faça login para ver as fontes/destinos.</p>`;
    return;
  }
  try {
    fontesCache = await api("/fontes-destinos", { token });
    renderListaFontes();
  } catch (err) {
    container.innerHTML = `<p class="text-center">${escapeHtml(err.message || "Erro ao carregar fontes/destinos.")}</p>`;
  }
}

function renderListaFontes() {
  const container = document.getElementById("fonte-lista");
  if (!container) return;
  if (!fontesCache || fontesCache.length === 0) {
    container.innerHTML = `<p class="text-center">Nenhuma fonte/destino cadastrada.</p>`;
    return;
  }

  const tipos = { renda: "Renda", conta: "Conta", cartao_credito: "Cartão de crédito" };
  const rows = fontesCache.map(f => `
    <tr>
      <td>${escapeHtml(f.nome)}</td>
      <td>${escapeHtml(tipos[f.tipo] || f.tipo)}</td>
      <td class="text-right">${f.dia_fechamento != null ? f.dia_fechamento : "—"}</td>
      <td class="text-right">${f.dia_vencimento != null ? f.dia_vencimento : "—"}</td>
      <td class="text-right">${f.limite != null ? formatCurrency(f.limite) : "—"}</td>
      <td>${f.reserva ? "Sim" : "—"}</td>
      <td class="text-right">
        <div class="acoes">
          <button type="button" class="secondary btn-sm" data-editar="${f.id}">Editar</button>
          <button type="button" class="secondary btn-sm" data-excluir="${f.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="relatorio-tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th class="text-right">Fechamento</th>
            <th class="text-right">Vencimento</th>
            <th class="text-right">Limite</th>
            <th>Reserva</th>
            <th class="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  container.querySelectorAll("[data-editar]").forEach(btn => {
    btn.addEventListener("click", () => editarFonte(parseInt(btn.dataset.editar, 10)));
  });
  container.querySelectorAll("[data-excluir]").forEach(btn => {
    btn.addEventListener("click", () => excluirFonte(parseInt(btn.dataset.excluir, 10)));
  });
}

function editarFonte(id) {
  const fonte = fontesCache.find(f => f.id === id);
  if (!fonte) return;

  fonteEditandoId = id;
  const setVal = (elId, valor) => {
    const el = document.getElementById(elId);
    if (el) el.value = valor == null ? "" : valor;
  };
  setVal("fonte-nome", fonte.nome);
  setVal("fonte-tipo", fonte.tipo);
  setVal("fonte-dia-fechamento", fonte.dia_fechamento);
  setVal("fonte-dia-vencimento", fonte.dia_vencimento);
  setVal("fonte-limite", fonte.limite);

  atualizarCamposFonte();

  const titulo = document.getElementById("fonte-form-titulo");
  const submit = document.getElementById("fonte-submit");
  const cancelar = document.getElementById("fonte-cancelar");
  const erro = document.getElementById("fonte-erro");
  if (titulo) titulo.textContent = "Editar Fonte/Destino";
  if (submit) submit.textContent = "Salvar";
  if (cancelar) cancelar.hidden = false;
  if (erro) { erro.hidden = true; erro.textContent = ""; }

  const formCard = document.getElementById("fonte-form-card");
  if (formCard && formCard.scrollIntoView) formCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function excluirFonte(id) {
  const fonte = fontesCache.find(f => f.id === id);
  const nome = fonte ? fonte.nome : "esta fonte/destino";
  if (!window.confirm(`Excluir "${nome}"?`)) return;

  const token = getToken();
  if (!token) return;
  const erro = document.getElementById("fonte-erro");

  try {
    await api("/fontes-destinos/" + id, { method: "DELETE", token });
    await carregarListaFontes();
    await carregarFontesDestinos(token);
  } catch (err) {
    if (erro) {
      erro.textContent = escapeHtml(err.message || "Erro ao excluir.");
      erro.hidden = false;
    }
  }
}

async function handleSalvarFonte(event) {
  event.preventDefault();
  const form = event.target;
  const submit = document.getElementById("fonte-submit");
  const erro = document.getElementById("fonte-erro");
  if (erro) { erro.hidden = true; erro.textContent = ""; }

  const token = getToken();
  if (!token) {
    if (erro) { erro.textContent = "Sessão expirada. Faça login novamente."; erro.hidden = false; }
    return;
  }

  const nome = form.elements.nome.value.trim();
  const tipo = form.elements.tipo.value;
  const diaFechamento = form.elements.dia_fechamento.value;
  const diaVencimento = form.elements.dia_vencimento.value;
  const limite = form.elements.limite.value;

  const campos = {};
  if (!nome) campos.nome = "Nome é obrigatório.";
  else if (nome.length > 60) campos.nome = "Nome deve ter no máximo 60 caracteres.";
  if (!tipo) campos.tipo = "Tipo é obrigatório.";
  if (tipo === "cartao_credito") {
    const fech = Number(diaFechamento);
    if (!diaFechamento || !Number.isInteger(fech) || fech < 1 || fech > 31) {
      campos.dia_fechamento = "Dia de fechamento deve ser inteiro entre 1 e 31.";
    }
    const venc = Number(diaVencimento);
    if (!diaVencimento || !Number.isInteger(venc) || venc < 1 || venc > 31) {
      campos.dia_vencimento = "Dia de vencimento deve ser inteiro entre 1 e 31.";
    }
    const lim = Number(limite);
    if (!limite || Number.isNaN(lim) || lim <= 0) {
      campos.limite = "Limite deve ser número maior que zero.";
    }
  }

  if (Object.keys(campos).length > 0) {
    if (erro) {
      erro.textContent = "Dados inválidos: " + Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join("; ");
      erro.hidden = false;
    }
    return;
  }

  const ehCartao = tipo === "cartao_credito";
  const body = {
    nome,
    tipo,
    dia_fechamento: ehCartao ? Number(diaFechamento) : null,
    dia_vencimento: ehCartao ? Number(diaVencimento) : null,
    limite: ehCartao ? Number(limite) : null
  };

  const editando = fonteEditandoId !== null;
  if (submit) {
    submit.disabled = true;
    submit.textContent = editando ? "Salvando..." : "Criando...";
  }

  try {
    if (editando) {
      await api("/fontes-destinos/" + fonteEditandoId, { method: "PUT", body, token });
    } else {
      await api("/fontes-destinos", { method: "POST", body, token });
    }
    resetFormFonte();
    await carregarListaFontes();
    await carregarFontesDestinos(token);
  } catch (err) {
    if (erro) {
      erro.textContent = escapeHtml(err.message || "Erro ao salvar.");
      erro.hidden = false;
    }
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = fonteEditandoId !== null ? "Salvar" : "Criar";
    }
  }
}

// --- Categorias CRUD ---
function renderCategorias() {
  const panel = document.getElementById("panel-categorias");
  if (!panel) return;

  panel.innerHTML = `
    <h1>Categorias</h1>

    <div class="card" id="categoria-form-card">
      <h2 id="categoria-form-titulo">Nova Categoria</h2>
      <form id="form-categoria" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="cat-nome">Nome <span class="required">*</span></label>
            <input type="text" id="cat-nome" name="nome" required maxlength="60" placeholder="Ex.: Alimentação, Transporte, Salário...">
          </div>
          <div class="form-group">
            <label for="cat-tipo">Tipo <span class="required">*</span></label>
            <select id="cat-tipo" name="tipo" required>
              <option value="">Selecione</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
        </div>

        <div class="form-group" id="cat-classificacao-group" hidden>
          <label for="cat-classificacao">Classificação</label>
          <select id="cat-classificacao" name="classificacao">
            <option value="">Selecione</option>
            <option value="necessidade">Necessidade</option>
            <option value="desejo">Desejo</option>
            <option value="poupanca">Poupança</option>
          </select>
          <small class="form-hint">Obrigatório apenas para categorias de saída (tipo \"saida\").</small>
        </div>

        <div id="categoria-erro" class="alert alert-error" hidden></div>

        <div class="form-actions">
          <button type="submit" class="primary" id="cat-submit">Criar</button>
          <button type="button" class="secondary" id="cat-cancelar" hidden>Cancelar</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2>Cadastradas</h2>
      <div id="categoria-lista"><p class="text-center">Carregando…</p></div>
    </div>
  `;

  const form = document.getElementById("form-categoria");
  const tipoSelect = document.getElementById("cat-tipo");
  const cancelar = document.getElementById("cat-cancelar");

  if (tipoSelect) tipoSelect.addEventListener("change", atualizarClassificacaoCategoria);
  if (form) form.addEventListener("submit", handleSalvarCategoria);
  if (cancelar) cancelar.addEventListener("click", resetFormCategoria);

  resetFormCategoria();
  carregarListaCategorias();
}

function atualizarClassificacaoCategoria() {
  const tipoEl = document.getElementById("cat-tipo");
  const tipo = tipoEl ? tipoEl.value : "";
  const grupo = document.getElementById("cat-classificacao-group");
  const select = document.getElementById("cat-classificacao");
  if (grupo) grupo.hidden = tipo !== "saida";
  if (select && tipo !== "saida") select.value = "";
}

function resetFormCategoria() {
  categoriaEditandoId = null;
  const form = document.getElementById("form-categoria");
  if (form) form.reset();
  atualizarClassificacaoCategoria();
  const titulo = document.getElementById("categoria-form-titulo");
  const submit = document.getElementById("cat-submit");
  const cancelar = document.getElementById("cat-cancelar");
  const erro = document.getElementById("categoria-erro");
  if (titulo) titulo.textContent = "Nova Categoria";
  if (submit) submit.textContent = "Criar";
  if (cancelar) cancelar.hidden = true;
  if (erro) { erro.hidden = true; erro.textContent = ""; }
}

async function carregarListaCategorias() {
  const container = document.getElementById("categoria-lista");
  if (!container) return;
  const token = getToken();
  if (!token) {
    container.innerHTML = `<p class="text-center">Faça login para ver as categorias.</p>`;
    return;
  }
  try {
    categoriasCache = await api("/categorias", { token });
    renderListaCategorias();
  } catch (err) {
    container.innerHTML = `<p class="text-center">${escapeHtml(err.message || "Erro ao carregar categorias.")}</p>`;
  }
}

function renderListaCategorias() {
  const container = document.getElementById("categoria-lista");
  if (!container) return;
  if (!categoriasCache || categoriasCache.length === 0) {
    container.innerHTML = `<p class="text-center">Nenhuma categoria cadastrada.</p>`;
    return;
  }

  const classificacaoLabels = { necessidade: "Necessidade", desejo: "Desejo", poupanca: "Poupança" };
  const tipoLabels = { entrada: "Entrada", saida: "Saída" };
  const rows = categoriasCache.map(c => `
    <tr>
      <td>${escapeHtml(c.nome)}</td>
      <td>${escapeHtml(tipoLabels[c.tipo] || c.tipo)}</td>
      <td>${c.classificacao ? escapeHtml(classificacaoLabels[c.classificacao] || c.classificacao) : "—"}</td>
      <td class="text-right">
        <div class="acoes">
          <button type="button" class="secondary btn-sm" data-editar-cat="${c.id}">Editar</button>
          <button type="button" class="secondary btn-sm" data-excluir-cat="${c.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="relatorio-tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Classificação</th>
            <th class="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  container.querySelectorAll("[data-editar-cat]").forEach(btn => {
    btn.addEventListener("click", () => editarCategoria(parseInt(btn.dataset.editarCat, 10)));
  });
  container.querySelectorAll("[data-excluir-cat]").forEach(btn => {
    btn.addEventListener("click", () => excluirCategoria(parseInt(btn.dataset.excluirCat, 10)));
  });
}

function editarCategoria(id) {
  const cat = categoriasCache.find(c => c.id === id);
  if (!cat) return;

  categoriaEditandoId = id;
  const setVal = (elId, valor) => {
    const el = document.getElementById(elId);
    if (el) el.value = valor == null ? "" : valor;
  };
  setVal("cat-nome", cat.nome);
  setVal("cat-tipo", cat.tipo);
  setVal("cat-classificacao", cat.classificacao || "");

  atualizarClassificacaoCategoria();

  const titulo = document.getElementById("categoria-form-titulo");
  const submit = document.getElementById("cat-submit");
  const cancelar = document.getElementById("cat-cancelar");
  const erro = document.getElementById("categoria-erro");
  if (titulo) titulo.textContent = "Editar Categoria";
  if (submit) submit.textContent = "Salvar";
  if (cancelar) cancelar.hidden = false;
  if (erro) { erro.hidden = true; erro.textContent = ""; }

  const formCard = document.getElementById("categoria-form-card");
  if (formCard && formCard.scrollIntoView) formCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function excluirCategoria(id) {
  const cat = categoriasCache.find(c => c.id === id);
  const nome = cat ? cat.nome : "esta categoria";
  if (!window.confirm(`Excluir "${nome}"?`)) return;

  const token = getToken();
  if (!token) return;
  const erro = document.getElementById("categoria-erro");

  try {
    await api("/categorias/" + id, { method: "DELETE", token });
    await carregarListaCategorias();
    await carregarCategoriasETipos(token);
  } catch (err) {
    if (erro) {
      erro.textContent = escapeHtml(err.message || "Erro ao excluir.");
      erro.hidden = false;
    }
  }
}

async function handleSalvarCategoria(event) {
  event.preventDefault();
  const form = event.target;
  const submit = document.getElementById("cat-submit");
  const erro = document.getElementById("categoria-erro");
  if (erro) { erro.hidden = true; erro.textContent = ""; }

  const token = getToken();
  if (!token) {
    if (erro) { erro.textContent = "Sessão expirada. Faça login novamente."; erro.hidden = false; }
    return;
  }

  const nome = form.elements.nome.value.trim();
  const tipo = form.elements.tipo.value;
  const classificacao = form.elements.classificacao.value;

  const campos = {};
  if (!nome) campos.nome = "Nome é obrigatório.";
  else if (nome.length > 60) campos.nome = "Nome deve ter no máximo 60 caracteres.";
  if (!tipo || !["entrada", "saida"].includes(tipo)) campos.tipo = "Tipo é obrigatório e deve ser entrada ou saida.";
  if (tipo === "saida" && !classificacao) campos.classificacao = "Classificação é obrigatória para categorias de saída.";

  if (Object.keys(campos).length > 0) {
    if (erro) {
      erro.textContent = "Dados inválidos: " + Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join("; ");
      erro.hidden = false;
    }
    return;
  }

  const body = { nome, tipo };
  if (tipo === "saida") {
    body.classificacao = classificacao || null;
  }

  const editando = categoriaEditandoId !== null;
  if (submit) {
    submit.disabled = true;
    submit.textContent = editando ? "Salvando..." : "Criando...";
  }

  try {
    if (editando) {
      await api("/categorias/" + categoriaEditandoId, { method: "PUT", body, token });
    } else {
      await api("/categorias", { method: "POST", body, token });
    }
    resetFormCategoria();
    await carregarListaCategorias();
    await carregarCategoriasETipos(token);
  } catch (err) {
    if (erro) {
      erro.textContent = escapeHtml(err.message || "Erro ao salvar.");
      erro.hidden = false;
    }
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = categoriaEditandoId !== null ? "Salvar" : "Criar";
    }
  }
}

// --- Init ---
function iniciarTema() {
  const btn = document.getElementById("btn-tema");
  if (!btn) return;

  const atualizar = () => {
    const escuro = document.documentElement.getAttribute("data-theme") === "dark";
    btn.textContent = escuro ? "☀️" : "🌙";
    btn.title = escuro ? "Tema claro" : "Tema escuro";
    btn.setAttribute("aria-label", escuro ? "Ativar tema claro" : "Ativar tema escuro");
  };

  atualizar();
  btn.addEventListener("click", () => {
    const escuro = document.documentElement.getAttribute("data-theme") === "dark";
    const novo = escuro ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    try { localStorage.setItem("tema", novo); } catch (e) {}
    atualizar();
  });
}

function init() {
  // Wire tab buttons
  document.querySelectorAll(".tabs button[role=\"tab\"]").forEach(btn => {
    btn.addEventListener("click", () => {
      const panelId = btn.getAttribute("aria-controls");
      if (panelId) {
        const name = panelId.replace("panel-", "");
        showTab(name);
      }
    });
  });

  iniciarTema();

  // Initial render
  renderLogin();
  hydrateSession();
}

document.addEventListener("DOMContentLoaded", init);