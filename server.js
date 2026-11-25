require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('./middleware/cors');
const protegerRota = require('./middleware/auth');
const Health = require('./models/Health');

const app = express();

app.use(cors);
app.use(express.json());
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }));
app.use(express.raw({
  type: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ],
  limit: '5mb'
}));

app.get('/health', async (req, res) => {
  try {
    await Health.ping();
    res.status(200).json({ status: 'ok', banco: 'ok' });
  } catch (e) {
    res.status(503).json({ status: 'degraded', banco: 'erro' });
  }
});

// [Critério 12] express.Router() por recurso (cada rota delega ao seu model).
app.use('/auth', require('./routes/auth'));
app.use('/categorias', protegerRota, require('./routes/categorias'));
app.use('/fontes-destinos', protegerRota, require('./routes/fontesDestinos'));
app.use('/lancamentos', protegerRota, require('./routes/lancamentos'));
app.use('/relatorios', protegerRota, require('./routes/relatorios'));
app.use('/saude-financeira', protegerRota, require('./routes/saudeFinanceira'));

// [Critério 13] Rota inexistente -> 404 no padrão { erro }.
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

// [Critério 13] Padrão único de resposta de erro: { erro, campos? }.
app.use((err, req, res, next) => {
  // [Critério 4] Token ausente/inválido/expirado -> 401 em JSON (não HTML).
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ erro: 'Token ausente, inválido ou expirado.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API rodando na porta ${port}`);
});

module.exports = app;