const { expressjwt } = require('express-jwt');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET não configurado');
}

module.exports = expressjwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'auth'
});