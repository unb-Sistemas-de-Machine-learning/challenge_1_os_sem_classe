const { pegarDoCache, salvarNoCache } = require('./cache');
const { criarLimitador } = require('./rateLimiter');

const GOOGLE_KEY = process.env.GOOGLE_FACTCHECK_KEY;
const podeChamarGoogle = criarLimitador(15);

async function searchFactCheck(claimText) {
    const cacheKey = `google:${claimText}`;

    const cacheado = pegarDoCache(cacheKey);

    if (cacheado !== null) {
        console.log('GOOGLE: resultado encontrado no cache.');
        return cacheado;
    }

    if (!podeChamarGoogle()) {
        console.log('GOOGLE: limite local atingido.');

        return {
            indisponivel: true,
            motivo: 'limite_local',
            evidencias: []
        };
    }

    const url = new URL(
        'https://factchecktools.googleapis.com/v1alpha1/claims:search'
    );

    url.searchParams.set('query', claimText);
    url.searchParams.set('languageCode', 'pt-BR');
    url.searchParams.set('pageSize', '5');
    url.searchParams.set('key', GOOGLE_KEY);

    console.log('----------------------------------------');
    console.log('GOOGLE FACT CHECK');
    console.log('CLAIM:', claimText);
    console.log('URL:', url.toString());

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log('STATUS GOOGLE:', response.status);

        if (!response.ok) {
            console.error(
                'RESPOSTA GOOGLE:',
                JSON.stringify(data, null, 2)
            );

            return {
                indisponivel: true,
                motivo: data.error?.status || 'erro_google',
                mensagem: data.error?.message,
                evidencias: []
            };
        }

        const claims = data.claims || [];

        console.log(
            'QUANTIDADE DE CLAIMS:',
            claims.length
        );

        if (claims.length === 0) {
            console.log(
                'GOOGLE: nenhuma checagem encontrada.'
            );

            const resultadoVazio = {
                encontrado: false,
                origem: 'camada_1',
                fonteEvidencia: 'Google Fact Check',
                evidencias: []
            };

            salvarNoCache(cacheKey, resultadoVazio);

            return resultadoVazio;
        }

        const evidencias = [];

        for (let i = 0; i < claims.length; i++) {
            const claim = claims[i];

            if (!claim.claimReview || claim.claimReview.length === 0) {
                continue;
            }

            for (let j = 0; j < claim.claimReview.length; j++) {
                const review = claim.claimReview[j];

                const evidencia = {
                    id: `factcheck-${i}-${j}`,

                    titulo:
                        review.title ||
                        'Checagem de fatos encontrada',

                    texto:
                        claim.text ||
                        claimText,

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

                    tipo: 'fact_check'
                };

                evidencias.push(evidencia);
            }
        }

        const resultado = {
            encontrado: evidencias.length > 0,

            origem: 'camada_1',

            fonteEvidencia: 'Google Fact Check',

            evidencias
        };

        console.log(
            'QUANTIDADE DE EVIDÊNCIAS:',
            evidencias.length
        );

        console.log(
            'EVIDÊNCIAS GOOGLE:',
            JSON.stringify(evidencias, null, 2)
        );

        salvarNoCache(cacheKey, resultado);

        return resultado;

    } catch (erro) {
        console.error(
            'ERRO AO CONSULTAR GOOGLE FACT CHECK:',
            erro.message
        );

        return {
            indisponivel: true,
            motivo: 'erro_requisicao',
            mensagem: erro.message,
            evidencias: []
        };
    }
}

module.exports = {
    searchFactCheck
};