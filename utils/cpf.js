function cpfValido(cpf) {
  if (typeof cpf !== 'string') {
    return false;
  }

  if (cpf === null || cpf === undefined) {
    return false;
  }

  const digitos = cpf.replace(/\D/g, '');

  if (digitos.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(digitos)) {
    return false;
  }

  function calcularDigito(tamanho) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(digitos[i]) * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  const digito9 = calcularDigito(9);
  const digito10 = calcularDigito(10);

  return digito9 === Number(digitos[9]) && digito10 === Number(digitos[10]);
}

module.exports = { cpfValido };