const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// ============================================================
// CONFIGURAÇÕES
// ============================================================

dotenv.config({
    path: path.join(__dirname, '..', '.env')
});

const { classificarComGroq } = require('../services/groq');
const { searchPubMed } = require('../services/pubmed');

const CAMINHO_AMOSTRA = path.join(__dirname, '..', 'pubhealth_amostra.json');
const CAMINHO_RESULTADOS = path.join(
    __dirname,
    '..',
    'resultados_validacao.json'
);

// Tempo entre cada item.
// 10 segundos ajuda a evitar o limite de tokens da Groq.
const INTERVALO_ENTRE_ITENS = 10000;

// Número máximo de tentativas para uma classificação.
const MAX_TENTATIVAS = 4;

// ============================================================
// CARREGAMENTO DA AMOSTRA
// ============================================================

if (!fs.existsSync(CAMINHO_AMOSTRA)) {
    console.error('Arquivo da amostra não encontrado:');
    console.error(CAMINHO_AMOSTRA);
    process.exit(1);
}

const amostra = JSON.parse(
    fs.readFileSync(CAMINHO_AMOSTRA, 'utf-8')
);

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function mapearRotulo(labelPubhealth) {
    const mapa = {
        true: 'verdadeira',
        false: 'falsa',
        mixture: 'enganosa',
        unproven: 'não verificável',
    };

    return mapa[labelPubhealth] || labelPubhealth;
}

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tenta descobrir se o erro veio de Rate Limit.
 */
function ehRateLimit(erro) {
    const mensagem = erro?.message || '';

    return (
        mensagem.includes('rate_limit_exceeded') ||
        mensagem.includes('Rate limit') ||
        mensagem.includes('rate limit') ||
        mensagem.includes('TPM') ||
        mensagem.includes('tokens per minute')
    );
}

/**
 * Classifica uma claim usando retry automático.
 *
 * Se o Groq estiver temporariamente limitado,
 * espera e tenta novamente.
 */
async function classificarComRetry(claim, evidencias) {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
        try {
            console.log(
                `  → Consultando Groq (tentativa ${tentativa}/${MAX_TENTATIVAS})...`
            );

            const resultado = await classificarComGroq(
                claim,
                evidencias
            );

            // Verificação básica da resposta
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
                tentativa === MAX_TENTATIVAS;

            if (ultimaTentativa) {
                throw erro;
            }

            // Se for Rate Limit, espera mais tempo.
            if (ehRateLimit(erro)) {

                // Backoff progressivo:
                // 1ª falha → 5s
                // 2ª falha → 10s
                // 3ª falha → 15s
                const espera = tentativa * 5000;

                console.log(
                    `  ⚠ Rate Limit da Groq.`
                );

                console.log(
                    `  → Aguardando ${espera / 1000}s antes de tentar novamente...`
                );

                await esperar(espera);

            } else {

                // Para outros erros, espera um pouco
                // antes de tentar novamente.
                const espera = 3000;

                console.log(
                    `  ⚠ Erro na Groq: ${erro.message}`
                );

                console.log(
                    `  → Tentando novamente em ${espera / 1000}s...`
                );

                await esperar(espera);
            }
        }
    }
}

// ============================================================
// VALIDAÇÃO
// ============================================================

async function validar() {

    console.log('==========================================');
    console.log('VALIDAÇÃO DO MODELO');
    console.log('==========================================');

    console.log(`Amostra: ${amostra.length} claims`);
    console.log(`Intervalo: ${INTERVALO_ENTRE_ITENS / 1000}s`);
    console.log(`Máximo de tentativas: ${MAX_TENTATIVAS}`);
    console.log('==========================================\n');

    let acertos = 0;
    let classificacoesValidas = 0;
    let erros = 0;

    const resultados = [];

    const inicioTotal = Date.now();

    for (let i = 0; i < amostra.length; i++) {

        const item = amostra[i];

        const numero = i + 1;

        const esperado = mapearRotulo(item.label);

        console.log('------------------------------------------');
        console.log(`Processando ${numero}/${amostra.length}`);
        console.log(`Claim: ${item.claim}`);
        console.log(`Esperado: ${esperado}`);

        try {

            // ====================================================
            // 1. BUSCA NO PUBMED
            // ====================================================

            console.log('  → Buscando evidências no PubMed...');

            const inicioPubMed = Date.now();

            const evidencias = await searchPubMed(item.claim, 3);

            console.dir(evidencias, {
                depth: null
            });

            const tempoPubMed =
                ((Date.now() - inicioPubMed) / 1000).toFixed(1);

            console.log(
                `  ✓ PubMed respondeu em ${tempoPubMed}s`
            );

            // ====================================================
            // 2. CLASSIFICAÇÃO PELO GROQ
            // ====================================================

            const inicioGroq = Date.now();

            const predicao = await classificarComRetry(
                item.claim,
                evidencias
            );

            const tempoGroq =
                ((Date.now() - inicioGroq) / 1000).toFixed(1);

            console.log(
                `  ✓ Groq respondeu em ${tempoGroq}s`
            );

            // ====================================================
            // 3. COMPARAÇÃO
            // ====================================================

            const predito = predicao.classificacao;

            const correto =
                predito === esperado;

            classificacoesValidas++;

            if (correto) {
                acertos++;
                console.log('  ✓ CLASSIFICAÇÃO CORRETA');
            } else {
                console.log('  ✗ CLASSIFICAÇÃO INCORRETA');
            }

            console.log(`  Predito: ${predito}`);

            resultados.push({
                indice: numero,
                claim: item.claim,
                esperado: esperado,
                predito: predito,
                correto: correto,
                status: 'sucesso'
            });

        } catch (erro) {

            // ====================================================
            // ERRO
            // ====================================================

            erros++;

            console.error(
                `  ✗ Falhou nessa claim: "${item.claim}"`
            );

            console.error(
                `  Motivo: ${erro.message}`
            );

            /*
             * IMPORTANTE:
             *
             * Não colocamos "correto: false".
             *
             * Isso impediria diferenciar:
             *
             *   - modelo errou
             *   - API falhou
             *
             * O erro será ignorado no cálculo do F1.
             */

            resultados.push({
                indice: numero,
                claim: item.claim,
                esperado: esperado,
                predito: null,
                correto: null,
                status: 'erro',
                erro: erro.message
            });
        }

        // ========================================================
        // INTERVALO ENTRE OS ITENS
        // ========================================================

        if (i < amostra.length - 1) {

            console.log(
                `  → Aguardando ${INTERVALO_ENTRE_ITENS / 1000}s...`
            );

            await esperar(INTERVALO_ENTRE_ITENS);
        }
    }

    // ============================================================
    // MÉTRICAS
    // ============================================================

    const tempoTotal =
        ((Date.now() - inicioTotal) / 1000).toFixed(1);

    const acuracia =
        classificacoesValidas > 0
            ? (acertos / classificacoesValidas) * 100
            : 0;

    console.log('\n');
    console.log('==========================================');
    console.log('RESULTADO DA VALIDAÇÃO');
    console.log('==========================================');

    console.log(
        `Total de claims: ${amostra.length}`
    );

    console.log(
        `Classificações válidas: ${classificacoesValidas}`
    );

    console.log(
        `Erros de API: ${erros}`
    );

    console.log(
        `Acertos: ${acertos}`
    );

    console.log(
        `Erros do modelo: ${classificacoesValidas - acertos}`
    );

    console.log(
        `Acurácia: ${acuracia.toFixed(1)}%`
    );

    console.log(
        `Tempo total: ${tempoTotal}s`
    );

    console.log('==========================================');

    // ============================================================
    // SALVAR RESULTADOS
    // ============================================================

    const dadosFinais = {
        resumo: {
            total: amostra.length,
            classificacoes_validas: classificacoesValidas,
            erros_api: erros,
            acertos: acertos,
            erros_modelo: classificacoesValidas - acertos,
            acuracia: Number(acuracia.toFixed(4)),
            tempo_total_segundos: Number(tempoTotal)
        },

        resultados: resultados
    };

    fs.writeFileSync(
        CAMINHO_RESULTADOS,
        JSON.stringify(dadosFinais, null, 2),
        'utf-8'
    );

    console.log('\nArquivo salvo em:');
    console.log(CAMINHO_RESULTADOS);
}

// ============================================================
// EXECUTAR
// ============================================================

validar().catch((erro) => {
    console.error('\nErro inesperado na validação:');
    console.error(erro);
    process.exit(1);
});