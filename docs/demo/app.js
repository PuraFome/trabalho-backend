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
  if (name === "relatorios" && getToken()) {
    renderRelatorios();
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
          </tr>
        </thead>
        <tbody id="lancamentos-tbody">
          <tr><td colspan="6" class="text-center">Carregando…</td></tr>
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
        </div>
      </form>
    </div>
  `;

  // Wire events
  const form = document.getElementById("form-criar-lancamento");
  const tipoSelect = document.getElementById("lanc-tipo");
  const categoriaSelect = document.getElementById("lanc-categoria");
  const btnLimpar = document.getElementById("btn-limpar-form");

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
    btnLimpar.addEventListener("click", () => {
      form.reset();
      categoriaSelect.innerHTML = `<option value="">Selecione o tipo primeiro</option>`;
      categoriaSelect.disabled = true;
      const erroEl = document.getElementById("lancamento-erro");
      if (erroEl) { erroEl.hidden = true; erroEl.textContent = ""; }
    });
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

  submitBtn.disabled = true;
  submitBtn.textContent = "Criando...";

  try {
    const body = {
      tipo,
      descricao,
      valor,
      data,
      categoriaId,
      fonteDestinoId
    };
    if (parcelas > 1) {
      body.parcelas = parcelas;
    }

    await api("/lancamentos", { method: "POST", body, token });

    // Success: reload list and reset form
    form.reset();
    const categoriaSelect = document.getElementById("lanc-categoria");
    if (categoriaSelect) {
      categoriaSelect.innerHTML = `<option value="">Selecione o tipo primeiro</option>`;
      categoriaSelect.disabled = true;
    }
    carregarLancamentos(1);
  } catch (err) {
    erroEl.textContent = escapeHtml(err.message || "Erro ao criar lançamento.");
    erroEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Criar Lançamento";
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

  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center">Carregando…</td></tr>`;
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
    if (tbody) {
      if (itens.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">Nenhum lançamento encontrado.</td></tr>`;
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
          </tr>
        `).join("");
      }
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
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center">Erro ao carregar.</td></tr>`;
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