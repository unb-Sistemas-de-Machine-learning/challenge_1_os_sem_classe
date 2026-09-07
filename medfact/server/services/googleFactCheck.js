const { pegarDoCache, salvarNoCache } = require('./cache');
const { criarLimitador } = require('./rateLimiter');

const GOOGLE_KEY = process.env.GOOGLE_FACTCHECK_KEY;
const podeChamarGoogle = criarLimitador(15); // margem de segurança abaixo da cota diária/minuto do seu projeto

async function searchFactCheck(claimText) {
  const cacheKey = `google:${claimText}`;
  const cacheado = pegarDoCache(cacheKey);
  if (cacheado !== null) return cacheado;

  if (!podeChamarGoogle()) {
    // Não trava o fluxo: só avisa que a camada 1 não pôde ser consultada agora,
    // e a rota principal decide seguir pra camada 2.
    return { indisponivel: true };
  }

  const url = new URL('https://factchecktools.googleapis.com/v1alpha1/claims:search');
  url.searchParams.set('query', claimText);
  url.searchParams.set('languageCode', 'pt');
  url.searchParams.set('key', GOOGLE_KEY);

  const response = await fetch(url);
  const data = await response.json();

  let resultado = null;
  if (data.claims && data.claims.length > 0) {
    const claim = data.claims[0];
    const review = claim.claimReview?.[0];
    resultado = {
      encontrado: true,
      textoOriginal: claim.text,
      classificacao: review?.textualRating,
      agencia: review?.publisher?.name,
      url: review?.url,
    };
  }

  salvarNoCache(cacheKey, resultado);
  return resultado;
}

module.exports = { searchFactCheck };