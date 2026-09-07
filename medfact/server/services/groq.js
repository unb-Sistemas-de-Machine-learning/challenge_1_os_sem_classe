const { pegarDoCache, salvarNoCache } = require('./cache');
const { criarLimitador } = require('./rateLimiter');

const GROQ_KEY = process.env.GROQ_API_KEY;

const podeChamarGroq = criarLimitador(25);

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

    if (cacheado !== null) {
        return cacheado;
    }

    if (!podeChamarGroq()) {
        return {
            probabilidade_desinformacao: null,
            classificacao: 'indisponível',
            explicacao: 'Muitas verificações agora. Tente novamente em instantes.',
        };
    }

    const contextoEvidencias = evidencias
        .map((e, index) => `
EVIDÊNCIA ${index + 1}:

Título: ${e.titulo || 'Não informado'}

Revista: ${e.revista || 'Não informado'}

Data: ${e.data || 'Não informada'}

Resumo científico:
${e.resumo || e.abstract || 'Resumo não disponível'}

URL: ${e.url || 'Não disponível'}
`)
        .join('\n')
        || 'Nenhuma evidência científica encontrada.';

    const prompt = `
Você é um sistema de verificação de alegações de saúde.

Sua tarefa é determinar se uma afirmação é:

- verdadeira
- falsa
- enganosa
- não verificável

A decisão deve ser baseada PRINCIPALMENTE nas evidências científicas fornecidas abaixo.

AFIRMAÇÃO:

"${claimText}"

EVIDÊNCIAS CIENTÍFICAS:

${contextoEvidencias}

REGRAS DE CLASSIFICAÇÃO:

1. VERDADEIRA

Classifique como "verdadeira" quando as evidências apoiam claramente a afirmação.

2. FALSA

Classifique como "falsa" quando as evidências contradizem claramente a afirmação.

3. ENGANOSA

Classifique como "enganosa" quando:

- existe uma parte verdadeira, mas a conclusão é exagerada;
- a afirmação generaliza um resultado;
- existe omissão importante de contexto;
- a interpretação da evidência está incorreta;
- uma associação é apresentada como causalidade.

4. NÃO VERIFICÁVEL

Classifique como "não verificável" SOMENTE quando as evidências fornecidas não forem suficientes para determinar se a afirmação é verdadeira ou falsa.

IMPORTANTE:

- Não escolha "não verificável" simplesmente porque o artigo utiliza palavras diferentes da afirmação.
- Compare o SIGNIFICADO da afirmação com os resultados apresentados nas evidências.
- Não invente resultados científicos.
- Não utilize conhecimento externo para preencher lacunas das evidências.
- Ausência de evidência não significa automaticamente que a afirmação é falsa.
- Se houver evidência suficiente para apoiar ou contradizer a afirmação, NÃO use "não verificável".
- Se diferentes evidências entrarem em conflito, considere isso na explicação e escolha a classificação mais adequada.
- Para afirmações absolutas como "sempre", "nunca", "cura", "garante" ou "100%", seja especialmente cuidadoso com exageros.

PROBABILIDADE DE DESINFORMAÇÃO:

0-20: provavelmente verdadeira

21-40: baixa suspeita

41-60: dúvida significativa

61-80: provavelmente desinformação

81-100: forte evidência de desinformação

TIPO:

Se for "falsa" ou "enganosa", escolha o tipo mais adequado:

${TIPOS_DESINFORMACAO.join(' | ')}

TEMA:

Escolha entre:

- vacinação
- COVID-19
- doenças crônicas

NÍVEL DE RISCO:

- baixo: pouca possibilidade de causar dano;
- médio: pode influenciar decisões de saúde;
- alto: pode incentivar comportamentos perigosos, desencorajar vacinas, tratamentos ou cuidados médicos.

EXPLICAÇÃO:

Explique de maneira simples, objetiva e compreensível para uma pessoa sem conhecimento técnico.

RESPONDA SOMENTE COM JSON VÁLIDO:

{
    "probabilidade_desinformacao": 0,
    "classificacao": "verdadeira",
    "tipo": "alegação sem evidência",
    "tema": "COVID-19",
    "nivel_risco": "baixo",
    "explicacao": "Explicação simples e objetiva.",
    "trecho_suspeito": null
}
`.trim();

    const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${GROQ_KEY}`,
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                response_format: {
                    type: 'json_object',
                },
                temperature: 0.1,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error(
            'Erro da Groq:',
            response.status,
            JSON.stringify(data)
        );

        throw new Error(
            `Groq retornou HTTP ${response.status}`
        );
    }

    if (!data.choices || !data.choices[0]?.message?.content) {
        console.error(
            'Resposta inesperada da Groq:',
            JSON.stringify(data)
        );

        throw new Error(
            'Groq não retornou uma classificação válida.'
        );
    }

    let resultado;

    try {
        resultado = JSON.parse(
            data.choices[0].message.content
        );
    } catch (error) {
        console.error(
            'JSON inválido retornado pela Groq:',
            data.choices[0].message.content
        );

        throw new Error(
            'Groq retornou um JSON inválido.'
        );
    }

    salvarNoCache(cacheKey, resultado);

    return resultado;
}

module.exports = {
    classificarComGroq,
};