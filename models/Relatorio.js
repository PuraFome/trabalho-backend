const pool = require('../database/connection');
const { calcularFatura } = require('../utils/faturas');
const { hojeUTC, deslocarMes, dataSegura } = require('../utils/datas');

class Relatorio {
  async porCategoria(usuarioId, inicio, fim, inicioAnterior, fimAnterior) {
    const querySaidas = `
      SELECT c.id, c.nome, SUM(l.valor) AS total
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = ? AND l.tipo = 'saida' AND l.data BETWEEN ? AND ?
      GROUP BY c.id, c.nome
      ORDER BY total DESC
    `;

    const queryEntradas = `
      SELECT c.id, c.nome, SUM(l.valor) AS total
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = ? AND l.tipo = 'entrada' AND l.data BETWEEN ? AND ?
      GROUP BY c.id, c.nome
      ORDER BY total DESC
    `;

    const [saidasAtual] = await pool.query(querySaidas, [usuarioId, inicio, fim]);
    const [saidasAnterior] = await pool.query(querySaidas, [usuarioId, inicioAnterior, fimAnterior]);
    const [entradasAtual] = await pool.query(queryEntradas, [usuarioId, inicio, fim]);
    const [entradasAnterior] = await pool.query(queryEntradas, [usuarioId, inicioAnterior, fimAnterior]);

    const compararComAnterior = (atualRows, anteriorRows) => {
      const atualNum = atualRows.map(row => ({
        id: row.id,
        nome: row.nome,
        total: Number(row.total)
      }));
      const anteriorMap = new Map(anteriorRows.map(row => [row.id, Number(row.total)]));
      const total = atualNum.reduce((sum, c) => sum + c.total, 0);

      return atualNum.map(cat => {
        const anterior = anteriorMap.get(cat.id) || 0;
        const variacao = anterior === 0 ? null : Number((((cat.total - anterior) / anterior) * 100).toFixed(2));
        const percentual = total === 0 ? 0 : Number(((cat.total / total) * 100).toFixed(2));
        return {
          id: cat.id,
          nome: cat.nome,
          total: cat.total,
          percentual,
          anterior,
          variacao
        };
      });
    };

    const saidasComComparacao = compararComAnterior(saidasAtual, saidasAnterior);
    const entradasComComparacao = compararComAnterior(entradasAtual, entradasAnterior);

    const totalSaidasAtual = saidasComComparacao.reduce((sum, c) => sum + c.total, 0);
    const totalEntradasAtual = entradasComComparacao.reduce((sum, c) => sum + c.total, 0);

    return {
      saidas: {
        total: Number(totalSaidasAtual.toFixed(2)),
        categorias: saidasComComparacao
      },
      entradas: {
        total: Number(totalEntradasAtual.toFixed(2)),
        categorias: entradasComComparacao
      }
    };
  }

  async porFonteDestino(usuarioId, inicio, fim) {
    const queryEntradas = `
      SELECT f.id, f.nome, SUM(l.valor) AS total
      FROM lancamentos l
      JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.usuario_id = ? AND l.tipo = 'entrada' AND l.data BETWEEN ? AND ?
      GROUP BY f.id, f.nome
      ORDER BY total DESC
    `;

    const querySaidas = `
      SELECT f.id, f.nome, SUM(l.valor) AS total
      FROM lancamentos l
      JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.usuario_id = ? AND l.tipo = 'saida' AND l.data BETWEEN ? AND ?
      GROUP BY f.id, f.nome
      ORDER BY total DESC
    `;

    const queryContas = `
      SELECT f.id, f.nome,
        SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE 0 END) AS entradas,
        SUM(CASE WHEN l.tipo = 'saida' THEN l.valor ELSE 0 END) AS saidas
      FROM lancamentos l
      JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.usuario_id = ? AND f.tipo = 'conta' AND l.data BETWEEN ? AND ?
      GROUP BY f.id, f.nome
      ORDER BY f.nome
    `;

    const [entradasRows] = await pool.query(queryEntradas, [usuarioId, inicio, fim]);
    const [saidasRows] = await pool.query(querySaidas, [usuarioId, inicio, fim]);
    const [contasRows] = await pool.query(queryContas, [usuarioId, inicio, fim]);

    const entradas = entradasRows.map(row => ({
      id: row.id,
      nome: row.nome,
      total: Number(row.total)
    }));

    const saidas = saidasRows.map(row => ({
      id: row.id,
      nome: row.nome,
      total: Number(row.total)
    }));

    const contas = contasRows.map(row => {
      const entradasNum = Number(row.entradas || 0);
      const saidasNum = Number(row.saidas || 0);
      return {
        id: row.id,
        nome: row.nome,
        entradas: entradasNum,
        saidas: saidasNum,
        saldo: Number((entradasNum - saidasNum).toFixed(2))
      };
    });

    return { entradas, saidas, contas };
  }

  async faturas(usuarioId, meses = 3) {
    const FonteDestino = require('./FonteDestino');
    const cartoes = await FonteDestino.listarCartoes(usuarioId);

    if (cartoes.length === 0) {
      return { hoje: hojeUTC(), cartoes: [] };
    }

    const cartaoIds = cartoes.map(c => c.id);
    const placeholders = cartaoIds.map(() => '?').join(',');

    const [lancamentos] = await pool.query(
      `SELECT l.id, l.descricao, l.valor, l.data, l.parcela_atual, l.total_parcelas, l.fonte_destino_id
       FROM lancamentos l
       WHERE l.usuario_id = ? AND l.tipo = 'saida' AND l.fonte_destino_id IN (${placeholders})`,
      [usuarioId, ...cartaoIds]
    );

    const hoje = hojeUTC();
    const faturaAtualRef = {};

    for (const cartao of cartoes) {
      const ref = calcularFatura(hoje, { diaFechamento: cartao.dia_fechamento, diaVencimento: cartao.dia_vencimento }, 1).referencia;
      faturaAtualRef[cartao.id] = ref;
    }

    const faturasPorCartao = {};
    const referenciasPorCartao = {};

    for (const cartao of cartoes) {
      const refAtual = faturaAtualRef[cartao.id];
      const referencias = [refAtual];

      for (let i = 1; i < meses; i++) {
        const [ano, mes] = refAtual.split('-').map(Number);
        const novaRef = deslocarMes(`${ano}-${String(mes).padStart(2, '0')}-01`, i).slice(0, 7);
        referencias.push(novaRef);
      }

      referenciasPorCartao[cartao.id] = referencias;
      faturasPorCartao[cartao.id] = {};
      for (const ref of referencias) {
        let fechamento = null;
        let vencimento = null;
        if (cartao.dia_vencimento > cartao.dia_fechamento) {
          const [ano, mes] = ref.split('-').map(Number);
          fechamento = dataSegura(ano, mes - 1, cartao.dia_fechamento).toISOString().slice(0, 10);
          vencimento = dataSegura(ano, mes - 1, cartao.dia_vencimento).toISOString().slice(0, 10);
        } else {
          const [ano, mes] = ref.split('-').map(Number);
          fechamento = dataSegura(ano, mes - 2, cartao.dia_fechamento).toISOString().slice(0, 10);
          vencimento = dataSegura(ano, mes - 1, cartao.dia_vencimento).toISOString().slice(0, 10);
        }
        faturasPorCartao[cartao.id][ref] = {
          referencia: ref,
          fechamento,
          vencimento,
          total: 0,
          lancamentos: []
        };
      }
    }

    for (const l of lancamentos) {
      const cartao = cartoes.find(c => c.id === l.fonte_destino_id);
      if (!cartao) continue;

      const fatura = calcularFatura(l.data, { diaFechamento: cartao.dia_fechamento, diaVencimento: cartao.dia_vencimento }, l.parcela_atual);
      const ref = fatura.referencia;

      if (!faturasPorCartao[cartao.id][ref]) {
        faturasPorCartao[cartao.id][ref] = {
          referencia: ref,
          fechamento: fatura.fechamento,
          vencimento: fatura.vencimento,
          total: 0,
          lancamentos: []
        };
      }

      const faturaObj = faturasPorCartao[cartao.id][ref];
      if (!faturaObj.fechamento) {
        faturaObj.fechamento = fatura.fechamento;
        faturaObj.vencimento = fatura.vencimento;
      }
      faturaObj.total += Number(l.valor);
      faturaObj.lancamentos.push({
        id: l.id,
        descricao: l.descricao,
        parcela: `${l.parcela_atual}/${l.total_parcelas}`,
        valor: Number(l.valor)
      });
    }

    const resultadoCartoes = [];

    for (const cartao of cartoes) {
      const referencias = referenciasPorCartao[cartao.id];
      const faturasOrdenadas = referencias.map(ref => {
        const f = faturasPorCartao[cartao.id][ref];
        return {
          referencia: f.referencia,
          fechamento: f.fechamento,
          vencimento: f.vencimento,
          total: Number(f.total.toFixed(2)),
          lancamentos: f.lancamentos
        };
      });

      const limiteUtilizado = lancamentos
        .filter(l => l.fonte_destino_id === cartao.id)
        .reduce((sum, l) => {
          const fatura = calcularFatura(
            l.data,
            { diaFechamento: cartao.dia_fechamento, diaVencimento: cartao.dia_vencimento },
            l.parcela_atual
          );
          return fatura.vencimento >= hoje ? sum + Number(l.valor) : sum;
        }, 0);

      const limite = Number(cartao.limite || 0);
      const limiteDisponivel = Number((limite - limiteUtilizado).toFixed(2));

      resultadoCartoes.push({
        id: cartao.id,
        nome: cartao.nome,
        limite: Number(limite.toFixed(2)),
        limiteUtilizado: Number(limiteUtilizado.toFixed(2)),
        limiteDisponivel,
        faturas: faturasOrdenadas
      });
    }

    return { hoje, cartoes: resultadoCartoes };
  }
}

module.exports = new Relatorio();