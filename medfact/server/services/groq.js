const { pegarDoCache, salvarNoCache } = require('./cache');
const { criarLimitador } = require('./rateLimiter');

const GROQ_KEY = process.env.GROQ_API_KEY;
const podeChamarGroq = criarLimitador(25); // margem abaixo do limite do plano gratuito

const TIPOS_DESINFORMACAO = [
  'informação falsa',
  'informação verdadeira fora de contexto',
  'exagero',
  'informação parcialmente verdadeira',
  'fonte falsa',
  'estatística manipulada',
  'alegação sem evidência',
];

async function classificarComGroq(claimText, evidencias) {
  const cacheKey = `groq:${claimText}`;
  const cacheado = pegarDoCache(cacheKey);
  if (cacheado !== null) return cacheado;

  if (!podeChamarGroq()) {
    return {
      probabilidade_desinformacao: null,
      classificacao: 'indisponível',
      explicacao: 'Muitas verificações agora. Tente novamente em instantes.',
    };
  }

  const contextoEvidencias = evidencias
    .map((e) => `- ${e.titulo} (${e.revista}, ${e.data})`)
    .join('\n') || 'Nenhuma evidência científica encontrada.';

  const prompt = `
Você é um verificador de desinformação em saúde, especializado em vacinação, COVID-19 e doenças crônicas, atendendo um público idoso brasileiro.

Afirmação a analisar: "${claimText}"

Evidências científicas encontradas:
${contextoEvidencias}

Classifique a afirmação e responda SOMENTE em JSON, no formato:
{
  "probabilidade_desinformacao": <número de 0 a 100>,
  "classificacao": "<verdadeira | falsa | enganosa | não verificável>",
  "tipo": "<um destes: ${TIPOS_DESINFORMACAO.join(' | ')}>",
  "tema": "<vacinação | COVID-19 | doenças crônicas>",
  "nivel_risco": "<baixo | médio | alto>",
  "explicacao": "<explicação em linguagem simples, para um idoso sem conhecimento técnico>",
  "trecho_suspeito": "<o trecho exato da afirmação que motivou a classificação, ou null>"
}
`.trim();

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  const data = await response.json();
  console.log('Resposta da Groq:', JSON.stringify(data, null, 2)); // linha temporária pra debug
  const resultado = JSON.parse(data.choices[0].message.content);

  salvarNoCache(cacheKey, resultado);
  return resultado;
}

module.exports = { classificarComGroq };