const { pegarDoCache, salvarNoCache } = require('./cache');
const { criarLimitador } = require('./rateLimiter');

const GOOGLE_KEY = process.env.GOOGLE_FACTCHECK_KEY;
const podeChamarGoogle = criarLimitador(15);
const CACHE_PREFIX = 'v4:google';

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
        'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
        'e', 'ou', 'que', 'se', 'por', 'para', 'com', 'sem',
        'pode', 'podem', 'ser', 'causar', 'causa', 'faz', 'fazer',
        'é', 'sao', 'são'
    ]);

    return [...new Set(
        normalizarClaim(texto)
            .split(/\s+/)
            .filter(token => token.length >= 4 && !stopwords.has(token))
    )];
}

function sobreposicaoClaim(original, encontrado) {
    const base = tokensRelevantes(original);
    const alvo = new Set(tokensRelevantes(encontrado));

    if (base.length === 0 || alvo.size === 0) return 0;

    const comuns = base.filter(token => alvo.has(token)).length;
    return comuns / base.length;
}

function gerarVariantesBusca(claimText) {
    const original = normalizarClaim(claimText);

    if (!original) return [];

    const variantes = [original];
    const tokens = tokensRelevantes(original);

    // A primeira tentativa preserva a claim inteira.
    // A segunda remove palavras funcionais para aumentar a chance de
    // encontrar um ClaimReview com redação ligeiramente diferente.
    if (tokens.length >= 2) {
        variantes.push(tokens.join(' '));
    }

    return [...new Set(variantes)];
}

async function consultarGoogle(query) {
    if (!podeChamarGoogle()) {
        console.log('GOOGLE: limite local atingido.');
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

    // Nunca exibe a API key no terminal.
    console.log(
        'URL GOOGLE:',
        url.origin + url.pathname
    );

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log('STATUS GOOGLE:', response.status);

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

        // Evita aceitar automaticamente um ClaimReview apenas porque
        // compartilha uma palavra com a busca.
        const similaridade = sobreposicaoClaim(
            claimOriginal,
            textoClaim
        );

        if (similaridade < 0.40) {
            console.log(
                `GOOGLE: ClaimReview descartado por baixa correspondência (${similaridade.toFixed(2)}): ${textoClaim}`
            );

            continue;
        }

        const reviews = claim.claimReview || [];

        for (let j = 0; j < reviews.length; j++) {
            const review = reviews[j];

            evidencias.push({
                id: `factcheck-${i}-${j}`,

                titulo:
                    review.title ||
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

                data:
                    review.reviewDate ||
                    claim.claimDate ||
                    null,

                url:
                    review.url ||
                    null,

                tipo: 'fact_check',

                correspondencia:
                    Number(similaridade.toFixed(2))
            });
        }
    }

    return evidencias;
}

async function searchFactCheck(claimText) {
    const claimNormalizada = normalizarClaim(claimText);

    if (!claimNormalizada) {
        return {
            encontrado: false,
            origem: 'camada_1',
            fonteEvidencia: 'Google Fact Check',
            evidencias: []
        };
    }

    const cacheKey =
        `${CACHE_PREFIX}:${claimNormalizada}`;

    const cacheado = pegarDoCache(cacheKey);

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
        gerarVariantesBusca(claimNormalizada);

    const todasEvidencias = [];

    for (const variante of variantes) {
        const data =
            await consultarGoogle(variante);

        if (!data) continue;

        const evidencias =
            extrairEvidencias(
                data,
                claimNormalizada
            );

        todasEvidencias.push(...evidencias);

        console.log(
            'QUANTIDADE DE EVIDÊNCIAS VÁLIDAS:',
            evidencias.length
        );

        // Se a primeira busca já encontrou uma checagem
        // realmente compatível, não precisamos gastar
        // outra chamada à API.
        if (evidencias.length > 0) {
            break;
        }
    }

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
        evidenciasUnicas.push(evidencia);
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
            `✓ GOOGLE: ${resultado.evidencias.length} checagem(ns) compatível(is).`
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
    gerarVariantesBusca
};