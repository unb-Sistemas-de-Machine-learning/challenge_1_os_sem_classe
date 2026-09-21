const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({
    path: path.join(
        __dirname,
        '..',
        '.env'
    ),
});

const { classificarComGroq } = require('../services/groq');
const { searchPubMed } = require('../services/pubmed');

/*
 * Como validar.js e pubhealth_amostra.json
 * estão dentro de server/scripts:
 *
 * server/
 * └── scripts/
 *     ├── validar.js
 *     └── pubhealth_amostra.json
 */
const CAMINHO_AMOSTRA = path.join(
    __dirname,
    'pubhealth_amostra.json'
);

const CAMINHO_RESULTADOS = path.join(
    __dirname,
    'resultados_validacao.json'
);


/*
 * Configuração da validação.
 */
const INTERVALO_ENTRE_ITENS =
    10000;

const MAX_TENTATIVAS = 4;


/*
 * E06:
 *
 * Exibe no terminal a configuração usada
 * para deixar o experimento reproduzível.
 */
console.log('\n========================================');
console.log('        VALIDAÇÃO MEDFACT — E06');
console.log('========================================');
console.log('Experimento: E06');
console.log('Dataset: PUBHEALTH — Gold Test Set');
console.log('Amostra: 10 claims');
console.log('PubMed: busca + ranking + filtro semântico');
console.log('Groq: classificação + conhecimento geral');
console.log('E05: reasoning_effort = low');
console.log('========================================\n');


/*
 * Mapeamento dos rótulos originais do PUBHEALTH
 * para a taxonomia usada pelo MedFact.
 */
function mapearRotulo(labelPubhealth) {
    const mapa = {
        true: 'verdadeira',
        false: 'falsa',
        mixture: 'enganosa',
        unproven: 'não verificável',
    };

    return (
        mapa[labelPubhealth] ||
        labelPubhealth
    );
}


/*
 * Espera entre uma claim e outra.
 */
function esperar(ms) {
    return new Promise(
        (resolve) =>
            setTimeout(resolve, ms)
    );
}


/*
 * Identifica erros relacionados a limite
 * de requisições/tokens.
 */
function ehRateLimit(erro) {
    const mensagem =
        erro?.message || '';

    return (
        mensagem.includes(
            'rate_limit_exceeded'
        ) ||
        mensagem.includes(
            'Rate limit'
        ) ||
        mensagem.includes(
            'rate limit'
        ) ||
        mensagem.includes(
            'TPM'
        ) ||
        mensagem.includes(
            'tokens per minute'
        ) ||
        mensagem.includes(
            'Too Many Requests'
        ) ||
        mensagem.includes(
            'HTTP 429'
        )
    );
}


/*
 * Classificação com retry.
 */
async function classificarComRetry(
    claim,
    evidencias
) {
    for (
        let tentativa = 1;
        tentativa <= MAX_TENTATIVAS;
        tentativa++
    ) {
        try {
            console.log(
                `  → Consultando Groq ` +
                `(tentativa ${tentativa}/${MAX_TENTATIVAS})...`
            );

            const resultado =
                await classificarComGroq(
                    claim,
                    evidencias
                );

            if (
                !resultado ||
                !resultado.classificacao
            ) {
                throw new Error(
                    'Groq não retornou uma classificação válida.'
                );
            }

            return resultado;
        } catch (erro) {
            const ultimaTentativa =
                tentativa ===
                MAX_TENTATIVAS;

            console.error(
                `  ⚠️ Erro na tentativa ${tentativa}: ` +
                `${erro.message}`
            );

            if (ultimaTentativa) {
                throw erro;
            }

            let espera;

            if (ehRateLimit(erro)) {
                /*
                 * Espera maior para rate limit.
                 */
                espera =
                    30000 *
                    tentativa;
            } else {
                espera =
                    5000 *
                    tentativa;
            }

            console.log(
                `  ⏳ Aguardando ${espera / 1000}s antes de tentar novamente...`
            );

            await esperar(espera);
        }
    }

    throw new Error(
        'Não foi possível classificar a claim.'
    );
}


/*
 * Carrega a amostra.
 */
function carregarAmostra() {
    if (
        !fs.existsSync(
            CAMINHO_AMOSTRA
        )
    ) {
        console.error(
            'Arquivo da amostra não encontrado:'
        );

        console.error(
            CAMINHO_AMOSTRA
        );

        process.exit(1);
    }

    try {
        const conteudo =
            fs.readFileSync(
                CAMINHO_AMOSTRA,
                'utf8'
            );

        return JSON.parse(
            conteudo
        );
    } catch (erro) {
        console.error(
            'Erro ao ler o arquivo da amostra:'
        );

        console.error(
            erro.message
        );

        process.exit(1);
    }
}


/*
 * Calcula as métricas da validação.
 */
function calcularMetricas(
    resultados
) {
    const validos =
        resultados.filter(
            (resultado) =>
                resultado.status ===
                'ok'
        );

    const errosApi =
        resultados.filter(
            (resultado) =>
                resultado.status ===
                'erro_api'
        );

    const corretos =
        validos.filter(
            (resultado) =>
                resultado.predicao ===
                resultado.esperado
        );

    const incorretos =
        validos.filter(
            (resultado) =>
                resultado.predicao !==
                resultado.esperado
        );

    const acuracia =
        validos.length > 0
            ? (
                  corretos.length /
                  validos.length
              ) * 100
            : 0;

    const taxaErroApi =
        resultados.length > 0
            ? (
                  errosApi.length /
                  resultados.length
              ) * 100
            : 0;

    return {
        total: resultados.length,

        validos:
            validos.length,

        corretos:
            corretos.length,

        incorretos:
            incorretos.length,

        erros_api:
            errosApi.length,

        acuracia:
            Number(
                acuracia.toFixed(1)
            ),

        taxa_erro_api:
            Number(
                taxaErroApi.toFixed(1)
            ),
    };
}


/*
 * Execução principal.
 */
async function main() {
    const inicio =
        Date.now();

    const amostra =
        carregarAmostra();

    console.log(
        `📂 Amostra carregada: ${CAMINHO_AMOSTRA}`
    );

    console.log(
        `📊 Total de claims: ${amostra.length}`
    );

    console.log(
        `⏱️ Intervalo entre itens: ` +
        `${INTERVALO_ENTRE_ITENS / 1000}s`
    );

    console.log(
        `🔁 Máximo de tentativas Groq: ` +
        `${MAX_TENTATIVAS}`
    );

    const resultados = [];


    for (
        let i = 0;
        i < amostra.length;
        i++
    ) {
        const item =
            amostra[i];

        const claim =
            item.claim;

        const esperado =
            mapearRotulo(
                item.label
            );

        console.log(
            '\n----------------------------------------'
        );

        console.log(
            `CLAIM ${i + 1}/${amostra.length}`
        );

        console.log(
            `Afirmação: ${claim}`
        );

        console.log(
            `Esperado: ${esperado}`
        );


        try {
            /*
             * Busca direcionada do PubMed.
             *
             * O dataset pode possuir pubmedQuery.
             * Se não possuir, usa a própria claim.
             */
            const query =
                item.pubmedQuery ||
                item.claim;

            console.log(
                `\n🔎 Query PubMed: ${query}`
            );

            const evidencias =
                await searchPubMed(
                    query,
                    3
                );

            /*
             * Segurança adicional:
             *
             * searchPubMed deve sempre retornar array.
             */
            const evidenciasSeguras =
                Array.isArray(
                    evidencias
                )
                    ? evidencias
                    : [];

            console.log(
                `📚 Evidências utilizadas na classificação: ` +
                `${evidenciasSeguras.length}`
            );


            const predicao =
                await classificarComRetry(
                    claim,
                    evidenciasSeguras
                );


            const classificacao =
                predicao.classificacao;

            const acertou =
                classificacao ===
                esperado;


            console.log(
                `\n🤖 Predito: ${classificacao}`
            );

            console.log(
                `🎯 Esperado: ${esperado}`
            );

            console.log(
                acertou
                    ? '✅ CORRETO'
                    : '❌ INCORRETO'
            );


            if (predicao.explicacao) {
                console.log(
                    `💬 ${predicao.explicacao}`
                );
            }


            resultados.push({
                indice:
                    i + 1,

                claim,

                esperado,

                predicao:
                    classificacao,

                probabilidade_desinformacao:
                    predicao.probabilidade_desinformacao ??
                    null,

                tipo:
                    predicao.tipo ??
                    null,

                tema:
                    predicao.tema ??
                    null,

                nivel_risco:
                    predicao.nivel_risco ??
                    null,

                explicacao:
                    predicao.explicacao ??
                    null,

                trecho_suspeito:
                    predicao.trecho_suspeito ??
                    null,

                evidencias:
                    evidenciasSeguras.map(
                        (e) => ({
                            id:
                                e.id,

                            titulo:
                                e.titulo,

                            revista:
                                e.revista,

                            data:
                                e.data,

                            url:
                                e.url,
                        })
                    ),

                status:
                    'ok',

                acertou,
            });
        } catch (erro) {
            console.error(
                `❌ Erro na claim ${i + 1}:`,
                erro.message
            );

            resultados.push({
                indice:
                    i + 1,

                claim,

                esperado,

                predicao:
                    null,

                probabilidade_desinformacao:
                    null,

                tipo:
                    null,

                tema:
                    null,

                nivel_risco:
                    null,

                explicacao:
                    null,

                trecho_suspeito:
                    null,

                evidencias:
                    [],

                status:
                    'erro_api',

                erro:
                    erro.message,

                acertou:
                    false,
            });
        }


        /*
         * Não espera depois do último item.
         */
        if (
            i <
            amostra.length - 1
        ) {
            console.log(
                `\n⏳ Aguardando ` +
                `${INTERVALO_ENTRE_ITENS / 1000}s...`
            );

            await esperar(
                INTERVALO_ENTRE_ITENS
            );
        }
    }


    /*
     * Métricas finais.
     */
    const metricas =
        calcularMetricas(
            resultados
        );

    const tempoTotal =
        (
            Date.now() -
            inicio
        ) / 1000;


    console.log(
        '\n========================================'
    );

    console.log(
        '          RESULTADO FINAL — E06'
    );

    console.log(
        '========================================'
    );

    console.log(
        `Total: ${metricas.total}`
    );

    console.log(
        `Válidos: ${metricas.validos}`
    );

    console.log(
        `Corretos: ${metricas.corretos}`
    );

    console.log(
        `Incorretos: ${metricas.incorretos}`
    );

    console.log(
        `Erros de API: ${metricas.erros_api}`
    );

    console.log(
        `Acurácia: ${metricas.acuracia}%`
    );

    console.log(
        `Taxa de erro de API: ${metricas.taxa_erro_api}%`
    );

    console.log(
        `Tempo total: ${tempoTotal.toFixed(1)}s`
    );

    console.log(
        '========================================\n'
    );


    /*
     * Salva os resultados.
     */
    const saida = {
        experimento: 'E06',

        configuracao: {
            filtro_relevancia:
                true,

            reasoning_effort:
                'low',

            max_completion_tokens:
                700,

            candidatos_pubmed:
                10,

            pre_selecionados:
                5,

            evidencias_finais:
                3,
        },

        resumo: {
            ...metricas,

            tempo_segundos:
                Number(
                    tempoTotal.toFixed(1)
                ),
        },

        resultados,
    };


    fs.writeFileSync(
        CAMINHO_RESULTADOS,
        JSON.stringify(
            saida,
            null,
            4
        ),
        'utf8'
    );


    console.log(
        `💾 Resultados salvos em:`
    );

    console.log(
        CAMINHO_RESULTADOS
    );
}


main().catch(
    (erro) => {
        console.error(
            '\n❌ Erro fatal na validação:'
        );

        console.error(
            erro
        );

        process.exit(1);
    }
);
