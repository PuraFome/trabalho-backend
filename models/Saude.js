// [Desafio] Agregações SQL que alimentam os indicadores de saúde financeira.
const pool = require('../database/connection');
const Relatorio = require('./Relatorio');
const { hojeUTC, deslocarMes, somarDias, periodoAnterior } = require('../utils/datas');

class Saude {
  async medias(usuarioId) {
    const inicio = deslocarMes(`${hojeUTC().slice(0, 7)}-01`, -2);
    const fim = hojeUTC();

    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) AS entradas,
         SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) AS saidas
       FROM lancamentos
       WHERE usuario_id = ? AND data BETWEEN ? AND ?`,
      [usuarioId, inicio, fim]
    );

    return {
      entradas: Number(rows[0].entradas || 0),
      saidas: Number(rows[0].saidas || 0),
      meses: 3
    };
  }

  async saldoReserva(usuarioId) {
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE 0 END) AS entradas,
         SUM(CASE WHEN l.tipo = 'saida' THEN l.valor ELSE 0 END) AS saidas
       FROM lancamentos l
       JOIN fontes_destinos f ON f.id = l.fonte_destino_id
       WHERE l.usuario_id = ? AND f.reserva = 1`,
      [usuarioId]
    );

    const entradas = Number(rows[0].entradas || 0);
    const saidas = Number(rows[0].saidas || 0);
    return Number((entradas - saidas).toFixed(2));
  }

  async parcelasPorMes(usuarioId, meses = 12) {
    const faturasData = await Relatorio.faturas(usuarioId, meses);
    const parcelasPorMes = {};

    for (const cartao of faturasData.cartoes) {
      for (const fatura of cartao.faturas) {
        const ref = fatura.referencia;
        const totalFatura = Number(fatura.total || 0);
        if (totalFatura > 0) {
          parcelasPorMes[ref] = Number((parcelasPorMes[ref] || 0) + totalFatura).toFixed(2);
        }
      }
    }

    return parcelasPorMes;
  }

  async gastosPorClassificacao(usuarioId, inicio, fim) {
    const [rows] = await pool.query(
      `SELECT c.classificacao, SUM(l.valor) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
       WHERE l.usuario_id = ? AND l.tipo = 'saida' AND l.data BETWEEN ? AND ?
       GROUP BY c.classificacao`,
      [usuarioId, inicio, fim]
    );

    const resultado = {
      necessidade: 0,
      desejo: 0,
      poupanca: 0,
      naoClassificado: 0
    };

    for (const row of rows) {
      const classif = row.classificacao;
      const total = Number(row.total);
      if (classif && resultado.hasOwnProperty(classif)) {
        resultado[classif] = total;
      } else {
        resultado.naoClassificado += total;
      }
    }

    return resultado;
  }

  async saldoContas(usuarioId) {
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE 0 END) AS e,
         SUM(CASE WHEN l.tipo = 'saida' THEN l.valor ELSE 0 END) AS s
       FROM lancamentos l
       JOIN fontes_destinos f ON f.id = l.fonte_destino_id
       WHERE l.usuario_id = ? AND f.tipo = 'conta'`,
      [usuarioId]
    );

    const entradas = Number(rows[0].e || 0);
    const saidas = Number(rows[0].s || 0);
    return Number((entradas - saidas).toFixed(2));
  }

  async gastosPorCategoriaMes(usuarioId, inicio, fim) {
    const [rows] = await pool.query(
      `SELECT c.nome, SUM(l.valor) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
       WHERE l.usuario_id = ? AND l.tipo = 'saida' AND l.data BETWEEN ? AND ?
       GROUP BY c.id, c.nome
       ORDER BY total DESC`,
      [usuarioId, inicio, fim]
    );

    const categorias = rows.map((row) => ({
      nome: row.nome,
      total: Number(row.total)
    }));

    const totalGastos = Number(
      categorias.reduce((acc, cat) => acc + cat.total, 0).toFixed(2)
    );

    return { categorias, totalGastos };
  }

  async categoriaVsMedia(usuarioId) {
    const hoje = hojeUTC();
    const inicioAtual = `${hoje.slice(0, 7)}-01`;
    const fimAtual = hoje;

    const inicioAnterior = deslocarMes(`${hoje.slice(0, 7)}-01`, -3);
    const fimAnterior = somarDias(`${hoje.slice(0, 7)}-01`, -1);

    const [atualRows] = await pool.query(
      `SELECT c.id, c.nome, SUM(l.valor) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
       WHERE l.usuario_id = ? AND l.tipo = 'saida' AND l.data BETWEEN ? AND ?
       GROUP BY c.id, c.nome`,
      [usuarioId, inicioAtual, fimAtual]
    );

    const [anteriorRows] = await pool.query(
      `SELECT c.id, SUM(l.valor) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
       WHERE l.usuario_id = ? AND l.tipo = 'saida' AND l.data BETWEEN ? AND ?
       GROUP BY c.id`,
      [usuarioId, inicioAnterior, fimAnterior]
    );

    const anteriorMap = new Map();
    for (const row of anteriorRows) {
      anteriorMap.set(row.id, Number(row.total));
    }

    const resultado = [];
    for (const row of atualRows) {
      const totalAnterior = anteriorMap.get(row.id) || 0;
      const mediaAnterior = Number((totalAnterior / 3).toFixed(2));
      const totalAtual = Number(row.total);
      let ratio = 0;
      if (mediaAnterior > 0) {
        ratio = totalAtual / mediaAnterior;
      }
      resultado.push({
        id: row.id,
        nome: row.nome,
        totalAtual,
        mediaAnterior,
        ratio: Number(ratio.toFixed(4))
      });
    }

    return resultado;
  }
}

module.exports = new Saude();