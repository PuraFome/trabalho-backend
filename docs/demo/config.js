// Configuração da API — resolver de base URL
// Classic script (CommonJS-compatible), no ES modules

const LOCAL_API_BASE = 'http://localhost:3000';
const PROD_API_BASE = 'https://trabalho-backend-jrkv.onrender.com';

/**
 * Resolve a base da API baseada no hostname e porta.
 * @param {string} hostname - Hostname da página (ex.: location.hostname)
 * @param {string} port - Porta da página (ex.: location.port)
 * @returns {string} Base URL da API (local ou produção)
 */
function resolverApiBase(hostname, port, protocol) {
  if (protocol === 'file:' || !hostname) return LOCAL_API_BASE;

  const host = hostname.toLowerCase();
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
  const isLocalDomain = host.endsWith('.local');
  const isDockerInternal = host === 'host.docker.internal';
  const isPrivateIPv4 =
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    (host.startsWith('172.') && (() => {
      const parts = host.split('.');
      if (parts.length < 2) return false;
      const second = parseInt(parts[1], 10);
      return second >= 16 && second <= 31;
    })());
  const isDevPort = port === '4200';

  if (isLocalhost || isLocalDomain || isDockerInternal || isPrivateIPv4 || isDevPort) {
    return LOCAL_API_BASE;
  }
  return PROD_API_BASE;
}

// Browser: expõe API_BASE globalmente
if (typeof window !== 'undefined') {
  window.API_BASE = resolverApiBase(location.hostname, location.port, location.protocol);
}

// Node: exporta para testes
if (typeof module !== 'undefined') {
  module.exports = { resolverApiBase, PROD_API_BASE };
}