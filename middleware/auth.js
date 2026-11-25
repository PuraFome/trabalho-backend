const { expressjwt } = require('express-jwt');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET não configurado');
}

// [Critério 4] Rotas protegidas: express-jwt valida o JWT (HS256, segredo do .env) e injeta o payload em req.auth.
module.exports = expressjwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'auth'
});