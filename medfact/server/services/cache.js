// Cache simples em memória. Pra produção de verdade, troque por Redis ou SQLite —
// em memória, o cache zera toda vez que o servidor reinicia.
const cache = new Map();
const TTL_MS = 1000 * 60 * 60 * 24; // 24 horas

function normalizarClaim(texto) {
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pegarDoCache(texto) {
  const chave = normalizarClaim(texto);
  const item = cache.get(chave);
  if (!item) return null;
  if (Date.now() - item.timestamp > TTL_MS) {
    cache.delete(chave);
    return null;
  }
  return item.valor;
}

function salvarNoCache(texto, valor) {
  const chave = normalizarClaim(texto);
  cache.set(chave, { valor, timestamp: Date.now() });
}

module.exports = { pegarDoCache, salvarNoCache };