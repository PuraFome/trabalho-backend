const pool = require('../database/connection');

class FonteDestino {
  async listar(usuarioId, tipo) {
    let sql = 'SELECT id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva FROM fontes_destinos WHERE usuario_id = ?';
    const params = [usuarioId];
    if (tipo) {
      sql += ' AND tipo = ?';
      params.push(tipo);
    }
    sql += ' ORDER BY nome';
    const [rows] = await pool.query(sql, params);
    return rows.map(row => ({
      ...row,
      limite: row.limite === null ? null : Number(row.limite),
      reserva: Boolean(row.reserva)
    }));
  }

  async listarCartoes(usuarioId) {
    const [rows] = await pool.query(
      'SELECT id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva FROM fontes_destinos WHERE usuario_id = ? AND tipo = ? ORDER BY nome',
      [usuarioId, 'cartao_credito']
    );
    return rows.map(row => ({
      ...row,
      limite: row.limite === null ? null : Number(row.limite),
      reserva: Boolean(row.reserva)
    }));
  }

  async buscarPorId(id, usuarioId) {
    const [rows] = await pool.query(
      'SELECT id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva FROM fontes_destinos WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    if (!rows[0]) return undefined;
    return {
      ...rows[0],
      limite: rows[0].limite === null ? null : Number(rows[0].limite),
      reserva: Boolean(rows[0].reserva)
    };
  }

  async criar({ usuarioId, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva }) {
    const [result] = await pool.query(
      'INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [usuarioId, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva ? 1 : 0]
    );
    return { id: result.insertId, nome, tipo, dia_fechamento, dia_vencimento, limite: limite === null ? null : Number(limite), reserva: Boolean(reserva) };
  }

  async atualizar(id, usuarioId, campos) {
    const allowlist = ['nome', 'tipo', 'dia_fechamento', 'dia_vencimento', 'limite', 'reserva'];
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
      `UPDATE fontes_destinos SET ${sets.join(', ')} WHERE id = ? AND usuario_id = ?`,
      params
    );
    return result.affectedRows;
  }

  async excluir(id, usuarioId) {
    const [result] = await pool.query(
      'DELETE FROM fontes_destinos WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    return result.affectedRows;
  }

  async contarLancamentos(id, usuarioId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS n FROM lancamentos WHERE fonte_destino_id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    return rows[0].n;
  }
}

module.exports = new FonteDestino();