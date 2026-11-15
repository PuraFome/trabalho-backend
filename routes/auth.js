const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { cpfValido } = require('../utils/cpf');
const Usuario = require('../models/Usuario');
const protegerRota = require('../middleware/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /auth/cadastro
router.post('/cadastro', async (req, res) => {
  const { nome, email, cpf, senha } = req.body || {};
  const campos = {};

  // Validações
  if (!nome || !nome.trim()) {
    campos.nome = 'Nome é obrigatório.';
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    campos.email = 'E-mail inválido.';
  }
  if (!cpf || !cpfValido(cpf)) {
    campos.cpf = 'CPF inválido.';
  }
  if (!senha || senha.length < 8 || !/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
    campos.senha = 'Senha deve ter pelo menos 8 caracteres, com letra e número.';
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  // Normalização
  const nomeNorm = nome.trim();
  const emailNorm = email.trim().toLowerCase();
  const cpfNorm = cpf.replace(/\D/g, '');

  try {
    const senhaHash = await bcrypt.hash(senha, Number(process.env.BCRYPT_ROUNDS || 10));
    const usuario = await Usuario.cadastrar({ nome: nomeNorm, email: emailNorm, cpf: cpfNorm, senhaHash });
    return res.status(201).json(usuario);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      const campo = e.sqlMessage.includes('uq_usuarios_cpf') ? 'cpf' : 'email';
      return res.status(409).json({ erro: 'Conflito.', campos: { [campo]: `${campo === 'cpf' ? 'CPF' : 'E-mail'} já cadastrado.` } });
    }
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  }

  const emailNorm = email.trim().toLowerCase();
  const usuario = await Usuario.buscarPorEmail(emailNorm);

  if (!usuario) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  }

  const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaOk) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return res.status(200).json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
  });
});

// GET /auth/me
router.get('/me', protegerRota, async (req, res) => {
  const usuario = await Usuario.buscarPorId(req.auth.id);
  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' });
  }
  return res.status(200).json(usuario);
});

module.exports = router;