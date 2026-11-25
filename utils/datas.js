// [Critério 9] Datas em UTC; período anterior = mês de calendário anterior (com clamp de fim de mês).
function ehDataValida(str) {
  if (typeof str !== 'string') {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [ano, mes, dia] = str.split('-').map(Number);
  if (mes < 1 || mes > 12) {
    return false;
  }
  const ultimoDia = ultimoDiaDoMes(ano, mes - 1);
  if (dia < 1 || dia > ultimoDia) {
    return false;
  }
  return true;
}

function paraUTC(str) {
  const [ano, mes, dia] = str.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function ultimoDiaDoMes(ano, mes0) {
  return new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
}

function dataSegura(ano, mes, dia) {
  let m = mes;
  let a = ano;
  while (m > 11) {
    m -= 12;
    a += 1;
  }
  while (m < 0) {
    m += 12;
    a -= 1;
  }
  const ultimoDia = ultimoDiaDoMes(a, m);
  const d = dia > ultimoDia ? ultimoDia : dia < 1 ? 1 : dia;
  return new Date(Date.UTC(a, m, d));
}

function hojeUTC() {
  const agora = new Date();
  return iso(new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())));
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function somarDias(isoStr, n) {
  const data = paraUTC(isoStr);
  data.setUTCDate(data.getUTCDate() + n);
  return iso(data);
}

function deslocarMes(isoStr, n) {
  const [ano, mes, dia] = isoStr.split('-').map(Number);
  let m = mes - 1 + n;
  let a = ano;
  while (m > 11) {
    m -= 12;
    a += 1;
  }
  while (m < 0) {
    m += 12;
    a -= 1;
  }
  const ultimoDia = ultimoDiaDoMes(a, m);
  const d = dia > ultimoDia ? ultimoDia : dia;
  return iso(new Date(Date.UTC(a, m, d)));
}

function periodoAnterior(inicio, fim) {
  const [anoInicio, mesInicio, diaInicio] = inicio.split('-').map(Number);
  const [anoFim, mesFim, diaFim] = fim.split('-').map(Number);
  const intervaloEhMesCompleto = diaInicio === 1 && diaFim === ultimoDiaDoMes(anoFim, mesFim - 1);

  if (!intervaloEhMesCompleto) {
    return {
      inicio: deslocarMes(inicio, -1),
      fim: deslocarMes(fim, -1)
    };
  }

  const inicioAnterior = deslocarMes(inicio, -1);
  const [anoAnterior, mesAnterior] = inicioAnterior.split('-').map(Number);
  return {
    inicio: inicioAnterior,
    fim: `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${ultimoDiaDoMes(anoAnterior, mesAnterior - 1)}`
  };
}

module.exports = {
  ehDataValida,
  paraUTC,
  ultimoDiaDoMes,
  dataSegura,
  hojeUTC,
  iso,
  somarDias,
  deslocarMes,
  periodoAnterior
};