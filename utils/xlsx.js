'use strict';

// Geração e leitura de planilhas .xlsx SEM dependências externas.
// Usa apenas Buffer + node:zlib. Escreve o ZIP com método "stored" (sem compressão),
// o que dispensa deflate na escrita; na leitura aceita stored e deflate.

const zlib = require('node:zlib');
const { MODELO_CABECALHO, MODELO_EXEMPLO } = require('./importacaoLancamentos');

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';

// ---------- CRC32 (para o ZIP) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const d = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time: time & 0xffff, date: d & 0xffff };
}

// ---------- ZIP (escrita, método stored) ----------
function criarZip(entries) {
  const localParts = [];
  const centralParts = [];
  const { time, date } = dosDateTime();
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }

  const localBuf = Buffer.concat(localParts);
  const centralBuf = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

// ---------- ZIP (leitura) ----------
function lerZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('Arquivo .xlsx inválido (ZIP não encontrado).');
  }

  const total = buffer.readUInt16LE(eocd + 10);
  let cd = buffer.readUInt32LE(eocd + 16);
  const files = {};

  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(cd) !== 0x02014b50) {
      break;
    }
    const method = buffer.readUInt16LE(cd + 10);
    const compSize = buffer.readUInt32LE(cd + 20);
    const fnLen = buffer.readUInt16LE(cd + 28);
    const extraLen = buffer.readUInt16LE(cd + 30);
    const commentLen = buffer.readUInt16LE(cd + 32);
    const localOffset = buffer.readUInt32LE(cd + 42);
    const name = buffer.toString('utf8', cd + 46, cd + 46 + fnLen);

    const lFnLen = buffer.readUInt16LE(localOffset + 26);
    const lExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lFnLen + lExtraLen;
    const raw = buffer.subarray(dataStart, dataStart + compSize);

    let data;
    if (method === 0) {
      data = raw;
    } else if (method === 8) {
      data = zlib.inflateRawSync(raw);
    } else {
      throw new Error('Compressão não suportada no .xlsx.');
    }
    files[name] = data;

    cd += 46 + fnLen + extraLen + commentLen;
  }

  return files;
}

// ---------- XML helpers ----------
function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

function colLetra(index) {
  let s = '';
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function colIndex(letras) {
  let n = 0;
  for (const ch of letras) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function extrairTextoInline(content) {
  let out = '';
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(content))) {
    out += decodeXml(m[1]);
  }
  return out;
}

// Datas do Excel = número de série (dias desde 1899-12-30).
function isoParaSerial(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((Date.UTC(ano, mes - 1, dia) - epoch) / 86400000);
}

function serialParaIso(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  const data = new Date(epoch + Math.floor(serial) * 86400000);
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function ehFormatoData(code) {
  const limpo = String(code)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '');
  return /[ymd]/i.test(limpo);
}

// ---------- Geração ----------
function inlineCell(ref, text, style) {
  const s = style ? ` s="${style}"` : '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(text)}</t></is></c>`;
}

function dataCell(ref, iso, style) {
  const s = style ? ` s="${style}"` : '';
  return `<c r="${ref}"${s}><v>${isoParaSerial(iso)}</v></c>`;
}

function montarSheet1(catNomes, fonteNomes) {
  const row1 = MODELO_CABECALHO.map((h, i) => inlineCell(colLetra(i) + '1', h)).join('');
  const row2 = MODELO_EXEMPLO
    .map((v, i) => (i === 0 ? dataCell('A2', v, 1) : inlineCell(colLetra(i) + '2', v)))
    .join('');

  const validations = [
    '<dataValidation type="date" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1"' +
    ' errorTitle="Data inválida" error="Informe uma data válida usando o calendário."' +
    ' promptTitle="Data" prompt="Clique na célula e escolha a data no calendário." sqref="A2:A1000">' +
    '<formula1>DATE(1900,1,1)</formula1><formula2>DATE(2100,12,31)</formula2></dataValidation>'
  ];
  if (catNomes.length > 0) {
    validations.push(
      '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"' +
      ' errorTitle="Categoria inválida" error="Selecione uma categoria da lista." sqref="C2:C1000">' +
      '<formula1>Categorias</formula1></dataValidation>'
    );
  }
  if (fonteNomes.length > 0) {
    validations.push(
      '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"' +
      ' errorTitle="Fonte/Destino inválida" error="Selecione uma fonte/destino da lista." sqref="D2:D1000">' +
      '<formula1>Fontes</formula1></dataValidation>'
    );
  }
  const dv = validations.length
    ? `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
    : '';

  const cols =
    '<cols>' +
    '<col min="1" max="1" width="14" customWidth="1" style="1"/>' +
    '<col min="2" max="2" width="30" customWidth="1"/>' +
    '<col min="3" max="3" width="24" customWidth="1"/>' +
    '<col min="4" max="4" width="24" customWidth="1"/>' +
    '<col min="5" max="5" width="10" customWidth="1"/>' +
    '<col min="6" max="6" width="12" customWidth="1"/>' +
    '</cols>';

  return (
    XML_DECL +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    cols +
    `<sheetData><row r="1">${row1}</row><row r="2">${row2}</row></sheetData>` +
    dv +
    '</worksheet>'
  );
}

function montarSheet2(catNomes, fonteNomes) {
  const max = Math.max(catNomes.length, fonteNomes.length);
  let rows = `<row r="1">${inlineCell('A1', 'Categorias')}${inlineCell('B1', 'Fontes')}</row>`;
  for (let i = 0; i < max; i++) {
    const r = i + 2;
    const a = catNomes[i] ? inlineCell('A' + r, catNomes[i]) : '';
    const b = fonteNomes[i] ? inlineCell('B' + r, fonteNomes[i]) : '';
    if (a || b) {
      rows += `<row r="${r}">${a}${b}</row>`;
    }
  }
  return XML_DECL + `<worksheet xmlns="${NS_MAIN}"><sheetData>${rows}</sheetData></worksheet>`;
}

function montarWorkbook(catNomes, fonteNomes) {
  const names = [];
  if (catNomes.length > 0) {
    names.push(`<definedName name="Categorias">Opcoes!$A$2:$A$${catNomes.length + 1}</definedName>`);
  }
  if (fonteNomes.length > 0) {
    names.push(`<definedName name="Fontes">Opcoes!$B$2:$B$${fonteNomes.length + 1}</definedName>`);
  }
  const defined = names.length ? `<definedNames>${names.join('')}</definedNames>` : '';
  return (
    XML_DECL +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<sheets>' +
    '<sheet name="Lançamentos" sheetId="1" r:id="rId1"/>' +
    '<sheet name="Opcoes" sheetId="2" state="hidden" r:id="rId2"/>' +
    '</sheets>' +
    defined +
    '</workbook>'
  );
}

function montarStyles() {
  return (
    XML_DECL +
    `<styleSheet xmlns="${NS_MAIN}">` +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

function gerarModeloXlsx({ categorias = [], fontes = [] } = {}) {
  const catNomes = [...new Set(categorias.map((c) => c && c.nome).filter(Boolean))];
  const fonteNomes = [...new Set(fontes.map((f) => f && f.nome).filter(Boolean))];

  const contentTypes =
    XML_DECL +
    `<Types xmlns="${NS_CT}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rootRels =
    XML_DECL +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbookRels =
    XML_DECL +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const entries = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(montarWorkbook(catNomes, fonteNomes), 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(montarStyles(), 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(montarSheet1(catNomes, fonteNomes), 'utf8') },
    { name: 'xl/worksheets/sheet2.xml', data: Buffer.from(montarSheet2(catNomes, fonteNomes), 'utf8') }
  ];

  return criarZip(entries);
}

function celulaXlsx(ref, valor, tipo) {
  if (tipo === 'data' && typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return `<c r="${ref}" s="1"><v>${isoParaSerial(valor)}</v></c>`;
  }
  if (tipo === 'numero') {
    const n = Number(valor);
    if (Number.isFinite(n)) {
      return `<c r="${ref}"><v>${n}</v></c>`;
    }
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(valor == null ? '' : valor)}</t></is></c>`;
}

function gerarXlsxSimples({ nomeAba = 'Planilha', cabecalho = [], linhas = [], tipos = {} } = {}) {
  const header = cabecalho
    .map((h, i) => `<c r="${colLetra(i)}1" t="inlineStr"><is><t xml:space="preserve">${escXml(h)}</t></is></c>`)
    .join('');

  const corpo = linhas
    .map((linha, r) => {
      const num = r + 2;
      const cells = linha.map((valor, c) => celulaXlsx(colLetra(c) + num, valor, tipos[c])).join('');
      return `<row r="${num}">${cells}</row>`;
    })
    .join('');

  const cols = cabecalho
    .map((_, i) => {
      const style = tipos[i] === 'data' ? ' style="1"' : '';
      const width = i === 0 ? 14 : (tipos[i] === 'numero' ? 12 : 24);
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"${style}/>`;
    })
    .join('');

  const sheet =
    XML_DECL +
    `<worksheet xmlns="${NS_MAIN}">` +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1">${header}</row>${corpo}</sheetData>` +
    '</worksheet>';

  const workbook =
    XML_DECL +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<sheets><sheet name="${escXml(nomeAba)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>';

  const contentTypes =
    XML_DECL +
    `<Types xmlns="${NS_CT}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rootRels =
    XML_DECL +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbookRels =
    XML_DECL +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  return criarZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(montarStyles(), 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') }
  ]);
}

// ---------- Leitura ----------
function extrairSharedStrings(xml) {
  const out = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    out.push(extrairTextoInline(m[1]));
  }
  return out;
}

function resolverSheetPath(files) {
  try {
    const wb = files['xl/workbook.xml'] ? files['xl/workbook.xml'].toString('utf8') : '';
    const rels = files['xl/_rels/workbook.xml.rels'] ? files['xl/_rels/workbook.xml.rels'].toString('utf8') : '';
    if (wb && rels) {
      const sheet = /<sheet\b[^>]*r:id="([^"]+)"/.exec(wb);
      if (sheet) {
        const rel = new RegExp(`<Relationship\\b[^>]*Id="${sheet[1]}"[^>]*Target="([^"]+)"`).exec(rels);
        if (rel) {
          const target = rel[1].replace(/^\//, '').replace(/^xl\//, '');
          return 'xl/' + target;
        }
      }
    }
  } catch (_) {
    // usa fallback abaixo
  }
  return 'xl/worksheets/sheet1.xml';
}

function extrairLinhas(xml, sharedStrings, dateStyles) {
  const rows = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const rowAttrs = m[1] || '';
    const inner = m[2] || '';
    const rowNumMatch = /\br="(\d+)"/.exec(rowAttrs);
    const rowIndex = rowNumMatch ? parseInt(rowNumMatch[1], 10) - 1 : rows.length;

    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(inner))) {
      const attrs = cm[1] || '';
      const content = cm[2] || '';
      const refMatch = /r="([A-Z]+)\d+"/.exec(attrs);
      const col = refMatch ? colIndex(refMatch[1]) : cells.length;
      const tMatch = /t="([^"]+)"/.exec(attrs);
      const t = tMatch ? tMatch[1] : '';
      const sMatch = /s="(\d+)"/.exec(attrs);
      const styleIdx = sMatch ? Number(sMatch[1]) : -1;

      let value = '';
      if (t === 'inlineStr') {
        value = extrairTextoInline(content);
      } else {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(content);
        if (vMatch) {
          if (t === 's') {
            const idx = Number(vMatch[1]);
            value = sharedStrings[idx] === undefined ? '' : sharedStrings[idx];
          } else if (t === 'd') {
            value = decodeXml(vMatch[1]).slice(0, 10);
          } else {
            value = decodeXml(vMatch[1]);
            if ((t === '' || t === 'n') && dateStyles && dateStyles.has(styleIdx)) {
              const numero = Number(value);
              if (Number.isFinite(numero) && numero > 0) {
                value = serialParaIso(numero);
              }
            }
          }
        }
      }
      cells[col] = value;
    }

    const arr = [];
    for (let i = 0; i < cells.length; i++) {
      arr[i] = cells[i] === undefined ? '' : cells[i];
    }
    rows[rowIndex] = arr;
  }

  for (let i = 0; i < rows.length; i++) {
    if (!Array.isArray(rows[i])) {
      rows[i] = [];
    }
  }
  return rows;
}

function extrairEstilos(xml) {
  const formatosData = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

  const numFmtsRe = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"[^>]*\/>/g;
  let m;
  while ((m = numFmtsRe.exec(xml))) {
    if (ehFormatoData(m[2])) {
      formatosData.add(Number(m[1]));
    }
  }

  const dateStyles = new Set();
  const xfsMatch = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (xfsMatch) {
    const xfRe = /<xf\b[^>]*>/g;
    let idx = 0;
    let xm;
    while ((xm = xfRe.exec(xfsMatch[1]))) {
      const idm = /numFmtId="(\d+)"/.exec(xm[0]);
      if (idm && formatosData.has(Number(idm[1]))) {
        dateStyles.add(idx);
      }
      idx += 1;
    }
  }
  return dateStyles;
}

function lerXlsx(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Conteúdo .xlsx inválido.');
  }
  const files = lerZip(buffer);
  const sharedStrings = files['xl/sharedStrings.xml']
    ? extrairSharedStrings(files['xl/sharedStrings.xml'].toString('utf8'))
    : [];
  const dateStyles = files['xl/styles.xml']
    ? extrairEstilos(files['xl/styles.xml'].toString('utf8'))
    : new Set();
  const sheetPath = resolverSheetPath(files);
  const sheet = files[sheetPath] || files['xl/worksheets/sheet1.xml'];
  if (!sheet) {
    throw new Error('Planilha não encontrada no .xlsx.');
  }
  return extrairLinhas(sheet.toString('utf8'), sharedStrings, dateStyles);
}

module.exports = {
  gerarModeloXlsx,
  gerarXlsxSimples,
  lerXlsx,
  // exportados para testes
  criarZip,
  crc32
};
