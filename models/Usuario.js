const pool = require('../database/connection');
const bcrypt = require('bcrypt');

const CATEGORIAS_PADRAO = [
  ['Salário', 'entrada', null],
  ['Outras entradas', 'entrada', null],
  ['Alimentação', 'saida', 'necessidade'],
  ['Moradia', 'saida', 'necessidade'],
  ['Saúde', 'saida', 'necessidade'],
  ['Mobilidade', 'saida', 'necessidade'],
  ['Lazer', 'saida', 'desejo'],
  ['Educação', 'saida', 'necessidade'],
  ['Outras saídas', 'saida', 'desejo']
];

class Usuario {
  async cadastrar({ nome, email, cpf, senhaHash }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Inserir usuário
      const [result] = await conn.query(
        'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES (?, ?, ?, ?)',
        [nome, email, cpf, senhaHash]
      );
      const usuarioId = result.insertId;

      // Inserir 9 categorias padrão
      const categoriasValues = CATEGORIAS_PADRAO.map(([nomeCat, tipo, classificacao]) => [
        usuarioId,
        nomeCat,
        tipo,
        classificacao
      ]);
      await conn.query(
        'INSERT INTO categorias (usuario_id, nome, tipo, classificacao) VALUES ?',
        [categoriasValues]
      );

      // Inserir fonte padrão "Conta corrente"
      await conn.query(
        'INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES (?, ?, ?)',
        [usuarioId, 'Conta corrente', 'conta']
      );

      await conn.commit();
      return { id: usuarioId, nome, email };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async buscarPorEmail(email) {
    const [rows] = await pool.query(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?',
      [email]
    );
    return rows[0];
  }

  async buscarPorId(id) {
    const [rows] = await pool.query(
      'SELECT id, nome, email, cpf, criado_em FROM usuarios WHERE id = ?',
      [id]
    );
    return rows[0];
  }
}

module.exports = new Usuario();