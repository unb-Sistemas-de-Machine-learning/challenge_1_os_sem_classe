const { pegarDoCache, salvarNoCache } = require('./cache');
const { criarLimitador } = require('./rateLimiter');

const GOOGLE_KEY = process.env.GOOGLE_FACTCHECK_KEY;

const podeChamarGoogle = criarLimitador(15);

const CACHE_PREFIX = 'v5:google';

const MAPA_CLASSIFICACAO_AGENCIA = [
    {
        padrao: /falso|fake|mentira|enganad[oa]|incorret[oa]|errado/i,
        valor: 'falsa'
    },
    {
        padrao: /verdadeir[oa]|correto|confirmad[oa]|procede/i,
        valor: 'verdadeira'
    },
    {
        padrao: /engan|impreciso|distorcid[oa]|exager|parcialmente|fora de contexto/i,
        valor: 'enganosa'
    },
    {
        padrao: /nao verificav|indetermin|inconclus|sem comprova|contestad[oa]/i,
        valor: 'não verificável'
    }
];

function mapearClassificacaoAgencia(textualRating) {
    const texto = normalizarClaim(textualRating || '');

    for (const regra of MAPA_CLASSIFICACAO_AGENCIA) {
        if (regra.padrao.test(texto)) {
            return regra.valor;
        }
    }

    return 'não verificável';
}

function normalizarClaim(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[?!.;,]+$/g, '')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokensRelevantes(texto) {
    const stopwords = new Set([
        'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
        'de', 'da', 'do', 'das', 'dos',
        'em', 'no', 'na', 'nos', 'nas',
        'e', 'ou', 'que', 'se',
        'por', 'para', 'com', 'sem',
        'pode', 'podem',
        'ser',
        'causar', 'causa',
        'faz', 'fazer',
        'isso', 'essa', 'esse',
        'esta', 'este',
        'sao', 'são'
    ]);

    return [
        ...new Set(
            normalizarClaim(texto)
                .split(/\s+/)
                .filter(
                    token =>
                        token.length >= 4 &&
                        !stopwords.has(token)
                )
        )
    ];
}

/**
 * Calcula a correspondência entre duas alegações.
 *
 * Utilizamos três medidas:
 *
 * - coberturaOriginal:
 *   quantos termos relevantes da alegação do usuário
 *   aparecem na alegação encontrada;
 *
 * - coberturaEncontrada:
 *   quantos termos relevantes da alegação encontrada
 *   aparecem na alegação do usuário;
 *
 * - jaccard:
 *   proporção de termos compartilhados em relação à união
 *   dos termos das duas alegações.
 *
 * Para claims curtas, exigimos uma correspondência ainda
 * mais forte para evitar falsos positivos.
 */
function calcularCorrespondenciaClaim(original, encontrado) {
    const base = new Set(tokensRelevantes(original));
    const alvo = new Set(tokensRelevantes(encontrado));

    if (base.size === 0 || alvo.size === 0) {
        return {
            coberturaOriginal: 0,
            coberturaEncontrada: 0,
            jaccard: 0,
            score: 0,
            compatibilidade: false
        };
    }

    const comuns = [...base].filter(token =>
        alvo.has(token)
    );

    const coberturaOriginal =
        comuns.length / base.size;

    const coberturaEncontrada =
        comuns.length / alvo.size;

    const uniao = new Set([
        ...base,
        ...alvo
    ]);

    const jaccard =
        comuns.length / uniao.size;

    let compatibilidade = false;

    /*
     * Claims muito curtas exigem correspondência forte.
     *
     * Exemplo:
     *
     * "gripe mata"
     *
     * não deve ser considerada equivalente a:
     *
     * "Covid-19 é muito menos letal que a gripe"
     *
     * apenas porque ambas possuem "gripe".
     */
    if (base.size <= 2) {
        compatibilidade =
            coberturaOriginal === 1 &&
            coberturaEncontrada >= 0.5 &&
            jaccard >= 0.5;
    } else {
        /*
         * Para claims maiores:
         *
         * - pelo menos 60% da claim original;
         * - pelo menos 50% da claim encontrada;
         * - Jaccard de pelo menos 40%.
         */
        compatibilidade =
            coberturaOriginal >= 0.6 &&
            coberturaEncontrada >= 0.5 &&
            jaccard >= 0.4;
    }

    return {
        coberturaOriginal,
        coberturaEncontrada,
        jaccard,
        score: jaccard,
        compatibilidade
    };
}

function sobreposicaoClaim(original, encontrado) {
    return calcularCorrespondenciaClaim(
        original,
        encontrado
    ).score;
}

function gerarVariantesBusca(claimText) {
    const original = normalizarClaim(claimText);

    if (!original) {
        return [];
    }

    const variantes = [original];

    const tokens = tokensRelevantes(original);

    /*
     * A primeira tentativa preserva a claim inteira.
     *
     * A segunda remove palavras funcionais para aumentar
     * a chance de encontrar um ClaimReview com redação
     * ligeiramente diferente.
     */
    if (tokens.length >= 2) {
        variantes.push(tokens.join(' '));
    }

    return [
        ...new Set(variantes)
    ];
}

async function consultarGoogle(query) {
    if (!podeChamarGoogle()) {
        console.log(
            'GOOGLE: limite local atingido.'
        );

        return null;
    }

    const url = new URL(
        'https://factchecktools.googleapis.com/v1alpha1/claims:search'
    );

    url.searchParams.set('query', query);
    url.searchParams.set('languageCode', 'pt-BR');
    url.searchParams.set('pageSize', '5');
    url.searchParams.set('key', GOOGLE_KEY);

    console.log('----------------------------------------');
    console.log('GOOGLE FACT CHECK');
    console.log('QUERY:', query);

    /*
     * Nunca exibe a API key no terminal.
     */
    console.log(
        'URL GOOGLE:',
        url.origin + url.pathname
    );

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log(
            'STATUS GOOGLE:',
            response.status
        );

        if (!response.ok) {
            console.error(
                'RESPOSTA GOOGLE:',
                JSON.stringify(data, null, 2)
            );

            return null;
        }

        return data;
    } catch (erro) {
        console.error(
            'ERRO AO CONSULTAR GOOGLE FACT CHECK:',
            erro.message
        );

        return null;
    }
}

function extrairEvidencias(data, claimOriginal) {
    const claims = data?.claims || [];
    const evidencias = [];

    for (let i = 0; i < claims.length; i++) {
        const claim = claims[i];

        const textoClaim = claim.text || '';
        const reviews = claim.claimReview || [];

        /*
         * Um mesmo ClaimReview pode possuir um título
         * muito mais próximo da alegação do usuário do que
         * o claim.text retornado pela API.
         *
         * Exemplo real:
         *
         * claim.text:
         * "Muitas pessoas todos os anos, às vezes mais de
         * 100 mil... morrem de gripe..."
         *
         * review.title:
         * "Fact Check. Covid-19 é 'muito menos letal'
         * que a gripe?"
         *
         * O segundo é a formulação que precisamos comparar
         * com a alegação do usuário.
         */
        for (let j = 0; j < reviews.length; j++) {
            const review = reviews[j];

            const tituloReview =
                review.title || '';

            const correspondenciaClaim =
                calcularCorrespondenciaClaim(
                    claimOriginal,
                    textoClaim
                );

            const correspondenciaTitulo =
                calcularCorrespondenciaClaim(
                    claimOriginal,
                    tituloReview
                );

            /*
             * O ClaimReview é aceito se a alegação do usuário
             * for suficientemente equivalente:
             *
             * 1. ao claim.text retornado pelo Google; OU
             * 2. ao título do próprio fact-check.
             *
             * Isso evita o problema em que o Google encontra
             * o fact-check correto, mas o claim.text associado
             * possui uma redação completamente diferente.
             */
            const correspondenciaValida =
                correspondenciaClaim.compatibilidade ||
                correspondenciaTitulo.compatibilidade;

            /*
             * Utilizamos a maior correspondência encontrada
             * para representar a confiança da associação.
             */
            const melhorCorrespondencia =
                correspondenciaClaim.score >=
                correspondenciaTitulo.score
                    ? correspondenciaClaim
                    : correspondenciaTitulo;

            if (!correspondenciaValida) {
                console.log(
                    `GOOGLE: ClaimReview descartado por baixa correspondência.`
                );

                console.log(
                    `   Claim original: ${claimOriginal}`
                );

                console.log(
                    `   Claim Google: ${textoClaim}`
                );

                console.log(
                    `   Título: ${tituloReview}`
                );

                console.log(
                    `   Correspondência claim.text: ${correspondenciaClaim.score.toFixed(2)}`
                );

                console.log(
                    `   Correspondência título: ${correspondenciaTitulo.score.toFixed(2)}`
                );

                continue;
            }

            console.log(
                `GOOGLE: ClaimReview compatível encontrado.`
            );

            console.log(
                `   Claim original: ${claimOriginal}`
            );

            console.log(
                `   Claim Google: ${textoClaim}`
            );

            console.log(
                `   Título: ${tituloReview}`
            );

            console.log(
                `   Correspondência utilizada: ${melhorCorrespondencia.score.toFixed(2)}`
            );

            /*
             * Mantemos o textualRating original fornecido
             * pelo veículo de checagem.
             *
             * Não transformamos "Errado" em "falsa" aqui,
             * porque o frontend pode querer mostrar exatamente
             * o resultado dado pela agência.
             */
            evidencias.push({
                id: `factcheck-${i}-${j}`,

                titulo:
                    tituloReview ||
                    'Checagem de fatos encontrada',

                texto:
                    textoClaim ||
                    claimOriginal,

                fonte:
                    review.publisher?.name ||
                    'Fonte não informada',

                site:
                    review.publisher?.site ||
                    null,

                classificacao:
                    review.textualRating ||
                    'Classificação não informada',

                classificacaoNormalizada:
                    mapearClassificacaoAgencia(
                        review.textualRating
                    ),

                data:
                    review.reviewDate ||
                    claim.claimDate ||
                    null,

                url:
                    review.url ||
                    null,

                tipo: 'fact_check',

                correspondencia:
                    Number(
                        melhorCorrespondencia.score.toFixed(2)
                    ),

                coberturaOriginal:
                    Number(
                        melhorCorrespondencia.coberturaOriginal.toFixed(2)
                    ),

                coberturaEncontrada:
                    Number(
                        melhorCorrespondencia.coberturaEncontrada.toFixed(2)
                    )
            });
        }
    }

    return evidencias;
}

async function searchFactCheck(claimText) {
    const claimNormalizada =
        normalizarClaim(claimText);

    if (!claimNormalizada) {
        return {
            encontrado: false,
            origem: 'camada_1',
            fonteEvidencia: 'Google Fact Check',
            evidencias: []
        };
    }

    /*
     * A versão do cache foi alterada para v5 porque
     * a regra de correspondência agora considera também
     * o título do ClaimReview.
     */
    const cacheKey =
        `${CACHE_PREFIX}:${claimNormalizada}`;

    const cacheado =
        pegarDoCache(cacheKey);

    if (cacheado !== null) {
        console.log(
            'GOOGLE: resultado encontrado no cache.'
        );

        return cacheado;
    }

    if (!GOOGLE_KEY) {
        console.error(
            'GOOGLE: GOOGLE_FACTCHECK_KEY não configurada.'
        );

        return {
            indisponivel: true,
            motivo: 'chave_nao_configurada',
            evidencias: []
        };
    }

    const variantes =
        gerarVariantesBusca(
            claimNormalizada
        );

    const todasEvidencias = [];

    for (const variante of variantes) {
        const data =
            await consultarGoogle(variante);

        if (!data) {
            continue;
        }

        const evidencias =
            extrairEvidencias(
                data,
                claimNormalizada
            );

        todasEvidencias.push(
            ...evidencias
        );

        console.log(
            'QUANTIDADE DE EVIDÊNCIAS VÁLIDAS:',
            evidencias.length
        );

        /*
         * Se a busca já encontrou uma checagem
         * realmente compatível, não precisamos gastar
         * outra chamada à API.
         */
        if (evidencias.length > 0) {
            break;
        }
    }

    /*
     * Remove evidências duplicadas.
     */
    const evidenciasUnicas = [];
    const vistos = new Set();

    for (const evidencia of todasEvidencias) {
        const chave =
            evidencia.url ||
            `${evidencia.titulo}:${evidencia.fonte}`;

        if (vistos.has(chave)) {
            continue;
        }

        vistos.add(chave);

        evidenciasUnicas.push(
            evidencia
        );
    }

    const resultado = {
        encontrado:
            evidenciasUnicas.length > 0,

        origem: 'camada_1',

        fonteEvidencia:
            'Google Fact Check',

        evidencias:
            evidenciasUnicas.slice(0, 5)
    };

    if (resultado.encontrado) {
        console.log(
            `✓ GOOGLE: ${resultado.evidencias.length} ` +
            `checagem(ns) compatível(is).`
        );
    } else {
        console.log(
            'GOOGLE: nenhuma checagem compatível encontrada.'
        );
    }

    salvarNoCache(
        cacheKey,
        resultado
    );

    return resultado;
}

module.exports = {
    searchFactCheck,
    normalizarClaim,
    gerarVariantesBusca,
    mapearClassificacaoAgencia,
    calcularCorrespondenciaClaim
};