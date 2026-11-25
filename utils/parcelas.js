// [Critério 8] Divisão em centavos: base = floor(total/qtd), resto na 1ª parcela.
function dividirEmParcelas(valorTotal, quantidade) {
  if (quantidade < 1 || quantidade > 48 || valorTotal <= 0) {
    throw new RangeError('Quantidade deve ser entre 1 e 48 e valor deve ser positivo');
  }

  const centavos = Math.round(valorTotal * 100);
  const base = Math.floor(centavos / quantidade);
  const resto = centavos - base * quantidade;

  return Array.from({ length: quantidade }, (_, i) => {
    const valorCentavos = base + (i === 0 ? resto : 0);
    return valorCentavos / 100;
  });
}

module.exports = { dividirEmParcelas };