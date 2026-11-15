const pool = require('../database/connection');

class Health {
  async ping() {
    await pool.query('SELECT 1');
    return true;
  }
}

module.exports = new Health();