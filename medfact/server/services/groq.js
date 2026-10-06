const {
    pegarDoCache,
    salvarNoCache
} = require('./cache');

const {
    criarLimitador
} = require('./rateLimiter');

const GROQ_KEY =
    process.env.GROQ_API_KEY;

const GROQ_MODEL =
    process.env.GROQ_MODEL ||
    'openai/gpt-oss-120b';

const podeChamarGroq =
    criarLimitador(25);

// Intervalo mínimo entre chamadas.
// Ajuda a reduzir problemas de TPM.
const INTERVALO_MINIMO_MS = 6000;

let ultimaChamadaGroq = 0;

const MAX_RETRIES_RATE_LIMIT = 3;


/* =========================================================
   UTILITÁRIOS
========================================================= */

function esperar(ms) {
    return new Promise(
        resolve =>
            setTimeout(resolve, ms)
    );
}


function normalizarClaimParaCache(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[?!.;,]+$/g, '')
        .replace(
            /[^\p{L}\p{N}\s-]/gu,
            ' '
        )
        .replace(/\s+/g, ' ')
        .trim();
}


function extrairSegundosRetryAfter(
    response,
    corpo = ''
) {
    const retryAfter =
        response.headers.get(
            'retry-after'
        );

    if (retryAfter) {
        const segundos =
            Number(retryAfter);

        if (
            Number.isFinite(
                segundos
            )
        ) {
            return segundos;
        }
    }

    const reset =
        response.headers.get(
            'x-ratelimit-reset-tokens'
        );

    if (reset) {
        const match =
            reset.match(
                /([0-9]+(?:\.[0-9]+)?)s/
            );

        if (match) {
            return Number(
                match[1]
            );
        }
    }

    const match =
        String(corpo).match(
            /(?:try again in|in)\s*([0-9]+(?:\.[0-9]+)?)s/i
        );

    if (match) {
        return Number(
            match[1]
        );
    }

    return null;
}


async function respeitarIntervalo() {
    const agora =
        Date.now();

    const espera =
        INTERVALO_MINIMO_MS -
        (
            agora -
            ultimaChamadaGroq
        );

    if (espera > 0) {
        await esperar(
            espera
        );
    }
}


function validarChave() {
    if (!GROQ_KEY) {
        throw new Error(
            'GROQ_API_KEY não configurada no .env.'
        );
    }
}


/* =========================================================
   CHAMADA GROQ
========================================================= */

async function chamarGroq(
    prompt,
    maxCompletionTokens,
    contexto = 'Groq'
) {
    validarChave();

    for (
        let tentativa = 1;
        tentativa <=
        MAX_RETRIES_RATE_LIMIT + 1;
        tentativa++
    ) {
        if (
            !podeChamarGroq()
        ) {
            throw new Error(
                'Limite local de requisições da Groq atingido.'
            );
        }

        await respeitarIntervalo();

        ultimaChamadaGroq =
            Date.now();

        const response =
            await fetch(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    method: 'POST',

                    headers: {
                        'Authorization':
                            `Bearer ${GROQ_KEY}`,

                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify({
                            model:
                                GROQ_MODEL,

                            messages: [
                                {
                                    role:
                                        'user',

                                    content:
                                        prompt
                                }
                            ],

                            temperature:
                                0.1,

                            reasoning_effort:
                                'low',

                            max_completion_tokens:
                                maxCompletionTokens,

                            response_format: {
                                type:
                                    'json_object'
                            }
                        })
                }
            );

        if (response.ok) {
            const data =
                await response.json();

            const conteudo =
                data
                    .choices?.[0]
                    ?.message
                    ?.content;

            if (!conteudo) {
                throw new Error(
                    `Resposta vazia da Groq em ${contexto}.`
                );
            }

            return conteudo;
        }

        const corpo =
            await response.text();

        if (
            response.status !== 429 ||
            tentativa >
                MAX_RETRIES_RATE_LIMIT
        ) {
            console.error(
                `❌ Groq ${contexto} HTTP ${response.status}: ${corpo.slice(0, 500)}`
            );

            throw new Error(
                `Groq ${contexto} API ${response.status}`
            );
        }

        const segundosInformados =
            extrairSegundosRetryAfter(
                response,
                corpo
            );

        const esperaRateLimit =
            segundosInformados != null
                ? Math.ceil(
                    segundosInformados *
                    1000
                ) + 500
                : Math.min(
                    65000,
                    5000 * tentativa
                );

        console.log(
            `⚠️ Groq 429 em ${contexto}. ` +
            `Tentativa ${tentativa}/${MAX_RETRIES_RATE_LIMIT + 1}. ` +
            `Aguardando ${Math.ceil(esperaRateLimit / 1000)}s...`
        );

        await esperar(
            esperaRateLimit
        );
    }

    throw new Error(
        `Groq ${contexto}: retries esgotados.`
    );
}


function parsearJSON(
    conteudo,
    contexto
) {
    try {
        return JSON.parse(
            conteudo
        );
    } catch (erro) {
        console.error(
            `❌ JSON inválido retornado pela Groq em ${contexto}.`
        );

        console.error(
            conteudo
        );

        throw new Error(
            `JSON inválido retornado pela Groq em ${contexto}.`
        );
    }
}


/* =========================================================
   CLASSIFICAÇÃO
========================================================= */

function normalizarClassificacao(
    resultado
) {
    const classificacoesValidas = [
        'verdadeira',
        'falsa',
        'enganosa',
        'não verificável'
    ];

    if (
        !classificacoesValidas.includes(
            resultado.classificacao
        )
    ) {
        throw new Error(
            `Classificação inválida retornada pela Groq: ${resultado.classificacao}`
        );
    }

    if (!resultado.tipo) {
        resultado.tipo =
            'alegação sem evidência';
    }

    if (!resultado.tema) {
        resultado.tema =
            'outro';
    }

    if (!resultado.explicacao) {
        resultado.explicacao =
            'Não foi possível obter uma explicação adequada.';
    }

    return resultado;
}


function formatarEvidenciasParaClassificacao(
    evidencias
) {
    return evidencias.map(
        (artigo, index) => ({
            id:
                index + 1,

            pmid:
                artigo.id || '',

            titulo:
                artigo.titulo || '',

            revista:
                artigo.revista || '',

            data:
                artigo.data || '',

            resumo:
                (
                    artigo.resumo ||
                    ''
                ).slice(0, 700),

            url:
                artigo.url || '',

            avaliacaoEvidencia:
                artigo.avaliacaoEvidencia ||
                ''
        })
    );
}


async function classificarComGroq(
    claimText,
    evidencias = []
) {
    const ids =
        evidencias
            .map(
                item =>
                    item.id
            )
            .join(',');

    const claimCache =
        normalizarClaimParaCache(
            claimText
        );

    /*
     * V5:
     * Mudamos a versão para impedir que
     * resultados antigos da avaliação v4
     * sejam reutilizados.
     */
    const cacheKey =
        `v5:groq:classificacao:${claimCache}:${ids}`;

    const cacheado =
        pegarDoCache(
            cacheKey
        );

    if (cacheado !== null) {
        console.log(
            '💾 Resultado encontrado no cache da Groq.'
        );

        return cacheado;
    }

    const evidenciasFormatadas =
        formatarEvidenciasParaClassificacao(
            evidencias
        );

    const prompt = `
Você é um verificador rigoroso de alegações médicas e científicas.

Analise a alegação abaixo usando as evidências fornecidas e conhecimento científico estabelecido.

CLASSIFICAÇÕES POSSÍVEIS:
- verdadeira
- falsa
- enganosa
- não verificável

REGRAS DE CLASSIFICAÇÃO:

1. "verdadeira":
   A proposição completa possui suporte científico suficiente.

2. "falsa":
   Há evidência suficiente contradizendo a proposição,
   ou a proposição contradiz conhecimento científico
   estabelecido.

3. "enganosa":
   Existe um núcleo verdadeiro ou plausível,
   mas a alegação exagera, generaliza, distorce
   o contexto ou transforma evidência limitada
   em uma conclusão muito mais ampla.

4. "não verificável":
   As evidências disponíveis são insuficientes,
   indiretas, conflitantes ou preliminares para
   confirmar ou refutar adequadamente a proposição.

5. A ausência de artigos do PubMed NÃO significa
   automaticamente que uma alegação é falsa.

6. Associação não prova causalidade.

7. Estudos in vitro, celulares ou animais não são
   automaticamente evidência clínica em humanos.

8. Um estudo sobre um composto, extrato, molécula,
   vesícula, nanovesícula ou derivado não prova
   automaticamente uma alegação sobre o alimento,
   bebida ou tratamento completo.

9. Alegações absolutas como "cura", "completamente",
   "sempre", "nunca" ou "comprovado" exigem
   evidência proporcionalmente forte.

10. Não invente estudos, resultados, números ou
    conclusões que não estejam disponíveis.

11. Se as evidências fornecidas forem indiretas,
    deixe isso claro na explicação.

12. Não diga que uma fonte prova a alegação
    quando ela não investigou a proposição completa.

TIPOS DE DESINFORMAÇÃO:
- informação falsa
- informação verdadeira fora de contexto
- exagero
- informação parcialmente verdadeira
- fonte falsa
- estatística manipulada
- alegação sem evidência

EXPLICAÇÃO:
- seja curta;
- seja objetiva;
- explique por que a classificação foi escolhida;
- mencione a principal evidência quando houver;
- não invente informações;
- diferencie ausência de evidência de evidência de ausência.

EVIDÊNCIAS:
${JSON.stringify(
    evidenciasFormatadas,
    null,
    2
)}

ALEGACAO:
"${claimText}"

Retorne SOMENTE JSON válido:

{
  "classificacao": "verdadeira | falsa | enganosa | não verificável",
  "tipo": "tipo de desinformação",
  "tema": "tema principal",
  "explicacao": "explicação objetiva"
}
`;

    try {
        const conteudo =
            await chamarGroq(
                prompt,
                450,
                'classificação'
            );

        const resultado =
            normalizarClassificacao(
                parsearJSON(
                    conteudo,
                    'classificação'
                )
            );

        salvarNoCache(
            cacheKey,
            resultado
        );

        return resultado;

    } catch (erro) {
        console.error(
            `❌ Falha ao classificar alegação: ${erro.message}`
        );

        throw erro;
    }
}


/* =========================================================
   FILTRO DE RELEVÂNCIA
========================================================= */

async function filtrarRelevancia(
    claimText,
    artigos,
    max = 3
) {
    if (
        !artigos ||
        artigos.length === 0
    ) {
        return [];
    }

    const ids =
        artigos
            .map(
                artigo =>
                    artigo.id
            )
            .join(',');

    const claimCache =
        normalizarClaimParaCache(
            claimText
        );

    const cacheKey =
        `v5:groq:relevancia:${claimCache}:${ids}`;

    const cacheado =
        pegarDoCache(
            cacheKey
        );

    if (cacheado !== null) {
        return cacheado;
    }

    const candidatos =
        artigos.map(
            (artigo, index) => ({
                indice:
                    index + 1,

                titulo:
                    artigo.titulo ||
                    '',

                resumo:
                    (
                        artigo.resumo ||
                        ''
                    ).slice(0, 600)
            })
        );

    const prompt = `
Determine quais artigos são semanticamente relevantes
para analisar a alegação.

ALEGACAO:
"${claimText}"

ARTIGOS:
${JSON.stringify(
    candidatos,
    null,
    2
)}

REGRAS:

- Compartilhar palavras-chave não basta.
- Compartilhar apenas o mesmo tema não basta.
- O artigo precisa ajudar a analisar a proposição.
- Não selecione um artigo apenas porque contém
  palavras como "limão" e "câncer".
- Não selecione automaticamente estudos de compostos,
  extratos ou derivados quando a alegação trata
  do alimento ou tratamento completo.
- Se nenhum artigo for realmente relevante,
  retorne uma lista vazia.
- Máximo: ${max} artigos.

Retorne SOMENTE:

{
  "relevantes": [1, 2]
}
`;

    try {
        const conteudo =
            await chamarGroq(
                prompt,
                120,
                'relevância'
            );

        const resultado =
            parsearJSON(
                conteudo,
                'relevância'
            );

        const indices =
            Array.isArray(
                resultado.relevantes
            )
                ? resultado.relevantes
                : [];

        const selecionados =
            indices
                .filter(
                    indice =>
                        Number.isInteger(
                            indice
                        ) &&
                        indice >= 1 &&
                        indice <=
                            artigos.length
                )
                .map(
                    indice =>
                        artigos[
                            indice - 1
                        ]
                )
                .filter(Boolean)
                .slice(
                    0,
                    max
                );

        salvarNoCache(
            cacheKey,
            selecionados
        );

        return selecionados;

    } catch (erro) {
        console.error(
            `❌ Falha no filtro de relevância: ${erro.message}`
        );

        return [];
    }
}


/* =========================================================
   AVALIAÇÃO DE EVIDÊNCIA
========================================================= */

/*
 * Esta é a parte mais importante da correção.
 *
 * Um artigo pode ser:
 *
 * 1. DIRETO
 *    → testa essencialmente a mesma proposição.
 *
 * 2. INDIRETO
 *    → possui relação científica, mas não testa
 *      a proposição completa.
 *
 * 3. NAO_EVIDENCIA
 *    → apenas relacionado ao tema.
 *
 * SOMENTE "DIRETA" será enviada para o frontend
 * como evidência.
 */

async function avaliarEvidenciaDaClaim(
    claimText,
    artigos,
    max = 3
) {
    if (
        !artigos ||
        artigos.length === 0
    ) {
        return [];
    }

    const ids =
        artigos
            .map(
                artigo =>
                    artigo.id
            )
            .join(',');

    const claimCache =
        normalizarClaimParaCache(
            claimText
        );

    /*
     * V5:
     * invalida o resultado antigo da v4.
     */
    const cacheKey =
        `v5:groq:evidencia:${claimCache}:${ids}`;

    const cacheado =
        pegarDoCache(
            cacheKey
        );

    if (cacheado !== null) {
        console.log(
            '💾 Avaliação de evidência encontrada no cache V5 da Groq.'
        );

        return cacheado;
    }

    const candidatos =
        artigos.map(
            (artigo, index) => ({
                indice:
                    index + 1,

                id:
                    artigo.id,

                titulo:
                    artigo.titulo ||
                    '',

                resumo:
                    (
                        artigo.resumo ||
                        ''
                    ).slice(0, 1000)
            })
        );

    const prompt = `
Você é um avaliador extremamente rigoroso de evidências científicas.

Sua tarefa é determinar se cada artigo realmente fornece
EVIDÊNCIA para a alegação apresentada.

ALEGACAO:
"${claimText}"

ARTIGOS:
${JSON.stringify(
    candidatos,
    null,
    2
)}

Para cada artigo escolha EXATAMENTE uma destas categorias:

- "direta"
- "indireta"
- "nao_evidencia"

==================================================
DEFINIÇÃO DE "DIRETA"
==================================================

Use "direta" SOMENTE quando o artigo investigar
essencialmente a mesma proposição central da alegação.

Para isso, considere obrigatoriamente:

1. MESMA intervenção/exposição;
2. MESMO desfecho;
3. contexto suficientemente semelhante;
4. população adequada quando isso for essencial;
5. desenho do estudo permite avaliar a relação alegada.

O artigo não precisa usar exatamente as mesmas palavras,
mas precisa investigar efetivamente a relação central
da alegação.

==================================================
DEFINIÇÃO DE "INDIRETA"
==================================================

Use "indireta" quando existir uma relação científica
real com a alegação, MAS o artigo não testar a proposição
completa.

Exemplos:

- estudo de nanovesículas de limão quando a alegação
  é sobre beber água com limão;

- estudo de extrato de uma planta quando a alegação
  é sobre consumir o alimento inteiro;

- estudo em células quando a alegação afirma eficácia
  de tratamento em humanos;

- estudo em animais quando a alegação afirma eficácia
  clínica em humanos;

- estudo sobre um mecanismo biológico quando a alegação
  afirma que uma intervenção cura uma doença;

- estudo sobre um componente de um alimento quando
  a alegação afirma que o alimento completo cura uma
  doença.

==================================================
DEFINIÇÃO DE "NAO_EVIDENCIA"
==================================================

Use "nao_evidencia" quando o artigo apenas compartilha
palavras-chave ou possui relação temática insuficiente.

Exemplo:

Alegação:
"Beber água morna com limão cura câncer."

Artigo:
"Citrus limon-derived nanovesicles inhibit cancer cell
proliferation..."

Resultado:
"indireta" ou "nao_evidencia", NUNCA "direta".

Outro exemplo:

Alegação:
"Beber água morna com limão cura câncer."

Artigo:
"An efficient method to isolate lemon derived
extracellular vesicles for gastric cancer therapy."

Resultado:
"indireta" ou "nao_evidencia", NUNCA "direta".

==================================================
REGRA ESPECIAL PARA AÇÕES CONCRETAS
==================================================

Quando a alegação descreve uma ação concreta de uma pessoa,
como:

- beber;
- comer;
- tomar;
- ingerir;
- aplicar;
- usar;
- consumir;

um estudo sobre uma substância isolada, extrato, molécula,
nanopartícula, nanovesícula, vesícula extracelular ou
derivado NÃO deve ser classificado como "direta" se não
testar a ação concreta descrita.

==================================================
REGRA ESPECIAL PARA CURA
==================================================

Se a alegação disser que algo:

- cura;
- elimina;
- reverte completamente;
- impede totalmente;

o artigo precisa fornecer evidência compatível com
essa afirmação forte.

Um artigo que apenas demonstra:

- redução de células;
- atividade anticancerígena;
- efeito potencial;
- mecanismo biológico;
- associação;
- resultado in vitro;
- resultado em animais;

não é evidência direta de que a intervenção "cura"
a doença em humanos.

==================================================
REGRA FUNDAMENTAL
==================================================

NÃO use "direta" simplesmente porque:

- o título contém as mesmas palavras;
- o artigo fala da mesma doença;
- o artigo fala do mesmo alimento;
- o artigo fala do mesmo composto;
- o artigo apresenta algum efeito relacionado.

A pergunta é:

"Se eu mostrar SOMENTE este artigo para um pesquisador,
ele conseguiria usar este estudo para avaliar diretamente
a alegação completa?"

Se a resposta for não:
NÃO use "direta".

==================================================
RETORNO
==================================================

Retorne SOMENTE JSON válido:

{
  "avaliacoes": [
    {
      "indice": 1,
      "evidencia": "direta | indireta | nao_evidencia",
      "justificativa": "explicação curta e objetiva"
    }
  ]
}

Avalie TODOS os artigos.
`;

    try {
        const conteudo =
            await chamarGroq(
                prompt,
                350,
                'avaliação de evidência'
            );

        const resultado =
            parsearJSON(
                conteudo,
                'avaliação de evidência'
            );

        const avaliacoes =
            Array.isArray(
                resultado.avaliacoes
            )
                ? resultado.avaliacoes
                : [];

        /*
         * PRIMEIRA BARREIRA:
         *
         * Somente "direta" pode continuar.
         *
         * "indireta" é descartada.
         * "nao_evidencia" é descartada.
         */
        const avaliadasDiretas =
            avaliacoes.filter(
                item =>
                    item &&
                    item.evidencia ===
                        'direta'
            );

        /*
         * SEGUNDA BARREIRA:
         *
         * O índice precisa apontar para um
         * artigo existente.
         */
        const evidencias =
            avaliadasDiretas
                .filter(
                    item =>
                        Number.isInteger(
                            item.indice
                        ) &&
                        item.indice >= 1 &&
                        item.indice <=
                            artigos.length
                )
                .map(
                    item => ({
                        ...artigos[
                            item.indice - 1
                        ],

                        avaliacaoEvidencia:
                            'direta',

                        justificativaEvidencia:
                            item.justificativa ||
                            ''
                    })
                )
                .filter(Boolean)
                .slice(
                    0,
                    max
                );

        /*
         * Log detalhado para sabermos exatamente
         * o que foi descartado.
         */
        console.log(
            '\n🔬 AVALIAÇÃO DE EVIDÊNCIA'
        );

        avaliacoes.forEach(
            item => {
                const artigo =
                    artigos[
                        item.indice - 1
                    ];

                if (!artigo) {
                    return;
                }

                console.log(
                    `${item.indice}. ${item.evidencia} → ${artigo.titulo}`
                );

                console.log(
                    `   ${item.justificativa || ''}`
                );
            }
        );

        console.log(
            `\n✓ EVIDÊNCIAS DIRETAS FINAIS: ${evidencias.length}`
        );

        if (
            avaliacoes.some(
                item =>
                    item.evidencia ===
                    'indireta'
            )
        ) {
            console.log(
                'ℹ️ Evidências indiretas foram descartadas e NÃO serão enviadas ao frontend.'
            );
        }

        if (
            avaliacoes.some(
                item =>
                    item.evidencia ===
                    'nao_evidencia'
            )
        ) {
            console.log(
                'ℹ️ Artigos sem evidência foram descartados.'
            );
        }

        /*
         * SALVA SOMENTE O RESULTADO FINAL.
         *
         * Portanto, o cache V5 nunca vai armazenar
         * artigos indiretos como evidência.
         */
        salvarNoCache(
            cacheKey,
            evidencias
        );

        return evidencias;

    } catch (erro) {
        console.error(
            `❌ Falha na avaliação de evidência: ${erro.message}`
        );

        /*
         * IMPORTANTE:
         *
         * Em caso de erro, não fazemos fallback
         * para os candidatos.
         *
         * Isso evita que artigos apenas relacionados
         * apareçam como evidência.
         */
        return [];
    }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
    classificarComGroq,
    filtrarRelevancia,
    avaliarEvidenciaDaClaim
};