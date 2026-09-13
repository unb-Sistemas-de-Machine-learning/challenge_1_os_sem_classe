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

const TEMAS = [
    'vacinação',
    'COVID-19',
    'doenças crônicas',
    'fora do escopo',
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
            tipo: 'alegação sem evidência',
            tema: 'fora do escopo',
            nivel_risco: 'baixo',
            explicacao:
                'Muitas verificações estão sendo realizadas agora. Tente novamente em instantes.',
            trecho_suspeito: null,
        };
    }

    const listaEvidencias = Array.isArray(evidencias)
        ? evidencias
        : [];

    const contextoEvidencias = listaEvidencias
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

A análise deve considerar as evidências científicas recuperadas e, quando necessário,
o conhecimento médico científico geral estabelecido.

AFIRMAÇÃO:
"${claimText}"

EVIDÊNCIAS CIENTÍFICAS RECUPERADAS:
${contextoEvidencias}

========================
REGRA PRINCIPAL
========================

A ausência de um artigo específico nas evidências recuperadas NÃO significa
automaticamente que a afirmação seja "não verificável".

Você deve distinguir entre:

1. uma afirmação que realmente não pode ser determinada com segurança;

2. uma afirmação sobre um conhecimento médico amplamente estabelecido,
   que pode ser classificada mesmo quando a busca recuperada não contém
   um artigo diretamente correspondente.

Quando uma afirmação refletir um consenso médico ou científico bem estabelecido,
você PODE utilizar esse conhecimento geral para classificá-la.

Por outro lado, NÃO invente evidências, estudos, números, autores ou resultados
científicos que não estejam nas evidências fornecidas.

========================
CLASSIFICAÇÃO
========================

1. VERDADEIRA

Classifique como "verdadeira" quando:

- as evidências fornecidas apoiam claramente a afirmação; OU
- a afirmação representa conhecimento médico ou científico geral bem estabelecido
  e não apresenta uma generalização indevida.

Exemplo conceitual:
Uma afirmação básica sobre um fator de risco médico amplamente reconhecido
pode ser classificada como verdadeira mesmo se a busca não retornar um artigo
perfeito para aquela frase.

2. FALSA

Classifique como "falsa" quando:

- as evidências contradizem claramente a afirmação; OU
- a afirmação contradiz conhecimento médico ou científico bem estabelecido.

3. ENGANOSA

Classifique como "enganosa" quando:

- existe uma parte verdadeira, mas a conclusão é exagerada;
- uma associação é apresentada como causalidade;
- existe omissão importante de contexto;
- um resultado específico é generalizado para toda a população;
- um resultado experimental é apresentado como tratamento comprovado;
- uma afirmação verdadeira é apresentada de maneira que induza a uma conclusão
  incorreta;
- utiliza palavras absolutas como "sempre", "nunca", "cura", "garante" ou "100%"
  sem que as evidências sustentem esse grau de certeza.

4. NÃO VERIFICÁVEL

Use "não verificável" SOMENTE quando:

- não houver evidência suficiente para apoiar ou contradizer a afirmação;
- a afirmação depender de uma informação específica que não pode ser determinada
  pelas evidências disponíveis;
- não existir consenso médico/científico suficiente para fazer uma classificação
  confiável.

IMPORTANTE:

Não use "não verificável" simplesmente porque:

- o artigo encontrado utiliza palavras diferentes da afirmação;
- a busca do PubMed não encontrou um artigo específico;
- não existe uma evidência textual que repita exatamente a frase da afirmação.

Porém, não transforme toda afirmação plausível em "verdadeira".
Se a afirmação exigir uma evidência específica que não está disponível e não puder
ser julgada pelo conhecimento médico geral, use "não verificável".

========================
CONFLITO ENTRE EVIDÊNCIAS
========================

Se diferentes evidências entrarem em conflito:

- considere a qualidade e a força das evidências;
- considere se os estudos tratam da mesma população;
- considere se tratam do mesmo desfecho;
- não escolha automaticamente a primeira evidência;
- explique resumidamente a existência do conflito.

========================
PROBABILIDADE DE DESINFORMAÇÃO
========================

A probabilidade representa o quanto a afirmação parece ser desinformação:

0-20: provavelmente verdadeira
21-40: baixa suspeita
41-60: dúvida significativa
61-80: provavelmente desinformação
81-100: forte evidência de desinformação

Sugestão:

- verdadeira normalmente deve ter probabilidade baixa;
- falsa normalmente deve ter probabilidade alta;
- enganosa normalmente deve ter probabilidade intermediária ou alta,
  dependendo da gravidade da distorção;
- não verificável não significa necessariamente desinformação.

========================
TIPO
========================

Se a classificação for "falsa" ou "enganosa", escolha o tipo mais adequado:

${TIPOS_DESINFORMACAO.join(' | ')}

Se a classificação for "verdadeira" ou "não verificável",
use "alegação sem evidência" como valor padrão.

========================
TEMA
========================

Escolha exatamente um:

${TEMAS.join(' | ')}

Use "fora do escopo" quando a afirmação não tratar de:

- vacinação;
- COVID-19;
- doenças crônicas.

Não force uma afirmação para um dos três temas apenas para preencher o campo.

========================
NÍVEL DE RISCO
========================

- baixo: pouca possibilidade de causar dano;
- médio: pode influenciar decisões de saúde;
- alto: pode incentivar comportamentos perigosos, desencorajar vacinas,
  tratamentos ou cuidados médicos.

Considere o possível impacto da afirmação sobre uma pessoa,
especialmente uma pessoa idosa.

========================
EXPLICAÇÃO
========================

Explique de maneira simples, objetiva e compreensível para uma pessoa
sem conhecimento técnico.

Não invente estudos ou resultados.

Quando houver evidência científica relevante, explique como ela se relaciona
com a afirmação.

Quando utilizar conhecimento médico geral por ser uma questão de consenso,
deixe isso claro de forma simples, sem inventar uma referência específica.

========================
TRECHO SUSPEITO
========================

Se existir uma parte específica da afirmação que seja enganosa ou falsa,
retorne esse trecho.

Caso contrário, use null.

========================
FORMATO
========================

Responda SOMENTE com JSON válido:

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

                // E05
                reasoning_effort: 'low',
                max_completion_tokens: 700,
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

    if (
        !data.choices ||
        !data.choices[0]?.message?.content
    ) {
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


/*
 * E04b
 *
 * Avalia se os artigos recuperados pelo PubMed são realmente
 * relevantes para a afirmação.
 */
async function filtrarRelevancia(
    claimText,
    artigos,
    max = 3
) {
    if (!Array.isArray(artigos) || artigos.length === 0) {
        return [];
    }

    const cacheKey =
        `groq:relevancia:${claimText}:` +
        artigos.map((a) => a.id).join(',');

    const cacheado = pegarDoCache(cacheKey);

    if (cacheado !== null) {
        return cacheado;
    }

    if (!podeChamarGroq()) {
        console.log(
            '⚠️ Limite de taxa da Groq atingido ' +
            '(filtro de relevância) — ' +
            'usando pré-filtro por keyword.'
        );

        return artigos.slice(0, max);
    }

    const candidatos = artigos
        .map(
            (artigo, i) =>
                `[${i}] ${artigo.titulo}\n` +
                `Resumo: ${(artigo.resumo || '').slice(0, 300)}`
        )
        .join('\n\n');

    const prompt = `
Você está filtrando evidências científicas para um sistema
de verificação de alegações de saúde.

AFIRMAÇÃO:
"${claimText}"

CANDIDATOS DE EVIDÊNCIA:
${candidatos}

Para cada candidato, avalie se ele responde DIRETAMENTE à afirmação.

Um artigo é relevante quando:

- confirma a afirmação;
- contradiz a afirmação;
- ou fornece contexto científico diretamente relacionado ao ponto principal.

NÃO considere relevante um artigo apenas porque compartilha palavras-chave.

Exemplo:
Um estudo sobre atividade anticâncer de um composto em laboratório
NÃO é evidência direta de que um alimento caseiro cure câncer em humanos.

Considere também:

- população estudada;
- doença ou condição;
- intervenção;
- desfecho;
- contexto clínico;
- diferença entre estudos laboratoriais e estudos em humanos.

Retorne somente os candidatos realmente relevantes.

Responda SOMENTE em JSON:

{
    "relevantes": [0, 2]
}

Inclua no máximo ${max} índices.
Coloque os índices em ordem de relevância.
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

                // E05
                reasoning_effort: 'low',
                max_completion_tokens: 300,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error(
            'Erro da Groq no filtro de relevância:',
            response.status,
            JSON.stringify(data)
        );

        return artigos.slice(0, max);
    }

    if (
        !data.choices ||
        !data.choices[0]?.message?.content
    ) {
        console.error(
            'Resposta inesperada da Groq (relevância):',
            JSON.stringify(data)
        );

        return artigos.slice(0, max);
    }

    let indices = [];

    try {
        const resultado = JSON.parse(
            data.choices[0].message.content
        );

        if (Array.isArray(resultado.relevantes)) {
            indices = resultado.relevantes;
        }
    } catch (erro) {
        console.error(
            'Não consegui interpretar o JSON de relevância:',
            erro.message
        );

        return artigos.slice(0, max);
    }

    const selecionados = indices
        .map((indice) => artigos[indice])
        .filter(Boolean)
        .slice(0, max);

    /*
     * Se o filtro retornar zero artigos, mantemos os artigos
     * pré-selecionados em vez de transformar automaticamente
     * a ausência de evidência em ausência total de contexto.
     */
    if (selecionados.length === 0) {
        console.log(
            '⚠️ Filtro de relevância não selecionou artigos. ' +
            'Mantendo pré-seleção.'
        );

        return artigos.slice(0, max);
    }

    salvarNoCache(cacheKey, selecionados);

    return selecionados;
}


module.exports = {
    classificarComGroq,
    filtrarRelevancia,
};