const pool = require('../database/connection');
const { dividirEmParcelas } = require('../utils/parcelas');
const crypto = require('crypto');

class Lancamento {
  async criar({ usuarioId, tipo, descricao, valor, data, categoriaId, fonteDestinoId, parcelas = 1 }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const valoresParcelas = dividirEmParcelas(valor, parcelas);
      const grupo = parcelas > 1 ? crypto.randomUUID() : null;

      const linhas = valoresParcelas.map((valorParcela, i) => [
        usuarioId,
        tipo,
        descricao,
        valorParcela,
        data,
        categoriaId,
        fonteDestinoId,
        i + 1,
        parcelas,
        grupo
      ]);

      const [result] = await conn.query(
        `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id, parcela_atual, total_parcelas, grupo_parcelamento)
         VALUES ?`,
        [linhas]
      );

      await conn.commit();
      return { id: result.insertId, quantidade: parcelas, grupo };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async listar(usuarioId, { inicio, fim, tipo, categoriaId, fonteDestinoId, pagina = 1 }) {
    const where = ['l.usuario_id = ?'];
    const params = [usuarioId];

    if (inicio) {
      where.push('l.data >= ?');
      params.push(inicio);
    }
    if (fim) {
      where.push('l.data <= ?');
      params.push(fim);
    }
    if (tipo) {
      where.push('l.tipo = ?');
      params.push(tipo);
    }
    if (categoriaId) {
      where.push('l.categoria_id = ?');
      params.push(categoriaId);
    }
    if (fonteDestinoId) {
      where.push('l.fonte_destino_id = ?');
      params.push(fonteDestinoId);
    }

    const whereSql = where.join(' AND ');
    const limit = 20;
    const offset = (Math.max(1, pagina) - 1) * limit;

    const [itens] = await pool.query(
      `SELECT l.id, l.tipo, l.descricao, l.valor, l.data, l.parcela_atual, l.total_parcelas, l.grupo_parcelamento,
              c.id AS categoria_id, c.nome AS categoria_nome,
              f.id AS fonte_id, f.nome AS fonte_nome, f.tipo AS fonte_tipo
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
       JOIN fontes_destinos f ON f.id = l.fonte_destino_id
       WHERE ${whereSql}
       ORDER BY l.data DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM lancamentos l WHERE ${whereSql}`,
      params
    );
    const total = countRows[0].total;

    const [resumoRows] = await pool.query(
      `SELECT
         SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE 0 END) AS entradas,
         SUM(CASE WHEN l.tipo = 'saida' THEN l.valor ELSE 0 END) AS saidas
       FROM lancamentos l
       WHERE ${whereSql}`,
      params
    );

    const entradas = Number(resumoRows[0].entradas || 0);
    const saidas = Number(resumoRows[0].saidas || 0);

    return {
      itens: itens.map(row => ({
        id: row.id,
        tipo: row.tipo,
        descricao: row.descricao,
        valor: Number(row.valor),
        data: row.data,
        categoria: { id: row.categoria_id, nome: row.categoria_nome },
        fonteDestino: { id: row.fonte_id, nome: row.fonte_nome, tipo: row.fonte_tipo },
        parcela: row.total_parcelas > 1 ? `${row.parcela_atual}/${row.total_parcelas}` : null
      })),
      total,
      resumo: { entradas, saidas, saldo: Number((entradas - saidas).toFixed(2)) }
    };
  }

  async buscarPorId(id, usuarioId) {
    const [rows] = await pool.query(
      `SELECT l.id, l.tipo, l.descricao, l.valor, l.data, l.parcela_atual, l.total_parcelas, l.grupo_parcelamento,
              c.id AS categoria_id, c.nome AS categoria_nome,
              f.id AS fonte_id, f.nome AS fonte_nome, f.tipo AS fonte_tipo
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
       JOIN fontes_destinos f ON f.id = l.fonte_destino_id
       WHERE l.id = ? AND l.usuario_id = ?`,
      [id, usuarioId]
    );

    if (!rows[0]) return undefined;

    const row = rows[0];
    return {
      id: row.id,
      tipo: row.tipo,
      descricao: row.descricao,
      valor: Number(row.valor),
      data: row.data,
      categoria: { id: row.categoria_id, nome: row.categoria_nome },
      fonteDestino: { id: row.fonte_id, nome: row.fonte_nome, tipo: row.fonte_tipo },
      parcela: row.total_parcelas > 1 ? `${row.parcela_atual}/${row.total_parcelas}` : null
    };
  }

  async atualizar(id, usuarioId, dados) {
    const allowlist = ['tipo', 'descricao', 'valor', 'data', 'categoria_id', 'fonte_destino_id'];
    const sets = [];
    const params = [];

    for (const key of allowlist) {
      if (Object.prototype.hasOwnProperty.call(dados, key)) {
        sets.push(`${key} = ?`);
        params.push(dados[key]);
      }
    }

    if (sets.length === 0) {
      return 0;
    }

    params.push(id, usuarioId);
    const [result] = await pool.query(
      `UPDATE lancamentos SET ${sets.join(', ')} WHERE id = ? AND usuario_id = ?`,
      params
    );
    return result.affectedRows;
  }

  async excluir(id, usuarioId, todasParcelas = false) {
    if (todasParcelas) {
      const [lancamento] = await pool.query(
        'SELECT grupo_parcelamento FROM lancamentos WHERE id = ? AND usuario_id = ?',
        [id, usuarioId]
      );

      if (!lancamento[0] || !lancamento[0].grupo_parcelamento) {
        const [result] = await pool.query(
          'DELETE FROM lancamentos WHERE id = ? AND usuario_id = ?',
          [id, usuarioId]
        );
        return result.affectedRows;
      }

      const [result] = await pool.query(
        'DELETE FROM lancamentos WHERE grupo_parcelamento = ? AND usuario_id = ?',
        [lancamento[0].grupo_parcelamento, usuarioId]
      );
      return result.affectedRows;
    } else {
      const [result] = await pool.query(
        'DELETE FROM lancamentos WHERE id = ? AND usuario_id = ?',
        [id, usuarioId]
      );
      return result.affectedRows;
    }
  }
}

module.exports = new Lancamento();