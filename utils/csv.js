function parseCsv(texto) {
  if (typeof texto !== 'string') {
    return [];
  }

  let s = texto;
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }

  const linhas = [];
  let linha = [];
  let campo = '';
  let dentroDeAspas = false;
  let i = 0;

  while (i < s.length) {
    const c = s[i];

    if (dentroDeAspas) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        dentroDeAspas = false;
        i += 1;
        continue;
      }
      campo += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      dentroDeAspas = true;
      i += 1;
      continue;
    }

    if (c === ',') {
      linha.push(campo);
      campo = '';
      i += 1;
      continue;
    }

    if (c === '\r') {
      linha.push(campo);
      campo = '';
      linhas.push(linha);
      linha = [];
      i += s[i + 1] === '\n' ? 2 : 1;
      continue;
    }

    if (c === '\n') {
      linha.push(campo);
      campo = '';
      linhas.push(linha);
      linha = [];
      i += 1;
      continue;
    }

    campo += c;
    i += 1;
  }

  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas;
}

module.exports = { parseCsv };
