const pool = require('../database/connection');

class Categoria {
  async listar(usuarioId, tipo) {
    let sql = 'SELECT id, nome, tipo, classificacao FROM categorias WHERE usuario_id = ?';
    const params = [usuarioId];
    if (tipo) {
      sql += ' AND tipo = ?';
      params.push(tipo);
    }
    sql += ' ORDER BY nome';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async buscarPorId(id, usuarioId) {
    const [rows] = await pool.query(
      'SELECT id, nome, tipo, classificacao FROM categorias WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    return rows[0];
  }

  async criar({ usuarioId, nome, tipo, classificacao }) {
    const [result] = await pool.query(
      'INSERT INTO categorias (usuario_id, nome, tipo, classificacao) VALUES (?, ?, ?, ?)',
      [usuarioId, nome, tipo, classificacao]
    );
    return { id: result.insertId, nome, tipo, classificacao };
  }

  async atualizar(id, usuarioId, campos) {
    const allowlist = ['nome', 'tipo', 'classificacao'];
    const sets = [];
    const params = [];
    for (const key of allowlist) {
      if (Object.prototype.hasOwnProperty.call(campos, key)) {
        sets.push(`${key} = ?`);
        params.push(campos[key]);
      }
    }
    if (sets.length === 0) {
      return 0;
    }
    params.push(id, usuarioId);
    const [result] = await pool.query(
      `UPDATE categorias SET ${sets.join(', ')} WHERE id = ? AND usuario_id = ?`,
      params
    );
    return result.affectedRows;
  }

  async excluir(id, usuarioId) {
    const [result] = await pool.query(
      'DELETE FROM categorias WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    return result.affectedRows;
  }

  async contarLancamentos(id, usuarioId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS n FROM lancamentos WHERE categoria_id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    return rows[0].n;
  }
}

module.exports = new Categoria();