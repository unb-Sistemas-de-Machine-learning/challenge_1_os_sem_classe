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
     * V7:
     * Ajusta a decisão entre falsa e não verificável.
     *
     * Em especial:
     * - alegações sobre produtos/medicamentos novos e específicos;
     * - alegações extraordinárias sem evidência suficiente;
     * - evidências que apenas sugerem associação;
     * - evidências relacionadas, mas que não demonstram exatamente
     *   o que a alegação afirma.
     */
    const cacheKey =
        `v7:groq:classificacao:${claimCache}:${ids}`;

    const cacheado =
        pegarDoCache(
            cacheKey
        );

    if (cacheado !== null) {
        console.log(
            '💾 Resultado encontrado no cache da Groq V7.'
        );

        return cacheado;
    }

    const evidenciasFormatadas =
        formatarEvidenciasParaClassificacao(
            evidencias
        );

    const prompt = `Você é um verificador rigoroso de alegações médicas e científicas.

Sua tarefa é classificar a alegação COMPLETA, considerando exatamente o que ela afirma.

Não classifique apenas pelas palavras-chave.

Use as evidências fornecidas e, quando apropriado, conhecimento científico estabelecido.

CLASSIFICAÇÕES POSSÍVEIS:

- verdadeira
- falsa
- enganosa
- não verificável


==================================================
REGRA PRINCIPAL
==================================================

A classificação deve corresponder ao conteúdo EXATO da alegação.

Uma evidência relacionada ao mesmo tema não é suficiente.

Não transforme:

- associação em causa;
- possibilidade em certeza;
- estudo preliminar em tratamento comprovado;
- estudo em células em eficácia em humanos;
- estudo em animais em eficácia clínica;
- efeito de um componente em efeito comprovado do alimento inteiro;
- resultado de um grupo específico em conclusão para toda a população.


==================================================
1. VERDADEIRA
==================================================

Use "verdadeira" quando a afirmação completa for sustentada por evidência confiável ou por conhecimento científico muito bem estabelecido.

A evidência ou o conhecimento deve corresponder ao que a alegação realmente afirma.

Exemplo:

"Pessoas vacinadas contra a gripe ainda podem pegar a doença, mas geralmente apresentam sintomas mais leves."

Se essa tendência for bem estabelecida, classifique como "verdadeira".

A palavra "geralmente" indica uma tendência e não uma regra sem exceções.


==================================================
2. FALSA
==================================================

Use "falsa" quando:

- a afirmação completa for contradita por evidências confiáveis;
- ou a afirmação contrariar um conhecimento científico muito bem estabelecido;
- ou a alegação afirmar algo que a ciência já permite rejeitar com segurança.

Exemplo:

"Beber água morna com limão cura câncer."

Essa é uma alegação de cura absoluta.

Não existe tratamento reconhecido pela medicina em que água morna com limão seja uma cura para câncer.

Portanto, pode ser classificada como "falsa".


==================================================
3. ENGANOSA
==================================================

Use "enganosa" quando existe uma parte verdadeira ou plausível, mas a afirmação vai além do que as evidências permitem.

Exemplos:

- transformar associação em causa;
- transformar possibilidade em certeza;
- exagerar o resultado de um estudo;
- generalizar uma descoberta limitada;
- apresentar uma condição específica como se fosse universal;
- dizer que uma intervenção pode reverter completamente algo quando os estudos mostram apenas melhora parcial.


==================================================
4. NÃO VERIFICÁVEL
==================================================

Use "não verificável" quando não houver informação suficiente para determinar com segurança se a alegação específica é verdadeira ou falsa.

IMPORTANTE:

Não use "não verificável" apenas porque não encontrou um artigo.

Mas também NÃO use conhecimento geral para inventar uma conclusão quando a alegação for específica, nova ou depender de informações que não estão disponíveis.


==================================================
REGRA CRÍTICA PARA ALEGAÇÕES NOVAS OU ESPECÍFICAS
==================================================

Quando a alegação mencionar:

- um medicamento experimental específico;
- um tratamento novo;
- uma descoberta recente;
- um produto novo;
- uma tecnologia nova;
- uma intervenção específica que não possa ser identificada ou avaliada pelas informações fornecidas;

e não houver evidência suficiente sobre essa intervenção específica, prefira:

"não verificável"

em vez de "falsa".

Isso é especialmente importante quando a alegação apresenta uma situação hipotética ou uma descoberta que não pode ser confirmada apenas pelo conhecimento médico geral.

Exemplo:

"Existe um novo medicamento experimental capaz de reverter completamente a perda de memória causada pelo Alzheimer."

Se não houver evidências suficientes sobre esse medicamento específico:

→ "não verificável"

NÃO conclua "falsa" apenas porque atualmente não existe uma cura conhecida para Alzheimer.

A existência ou não de uma nova droga específica precisa ser verificada.


==================================================
REGRA CRÍTICA PARA EVIDÊNCIA INSUFICIENTE
==================================================

Quando não houver evidências diretas adequadas:

- uma alegação médica básica e muito bem estabelecida ainda pode ser verdadeira;
- uma alegação que contradiz conhecimento médico muito bem estabelecido pode ser falsa;
- uma alegação específica, nova ou extraordinária pode ser não verificável;
- não invente evidências para preencher a ausência de dados.


==================================================
EVIDÊNCIA RECUPERADA
==================================================

As evidências abaixo são artigos que passaram pelo filtro do sistema.

Se a lista estiver vazia:

isso significa que não foi encontrada evidência direta adequada na busca.

Não invente estudos.

Não diga que um artigo existe quando ele não está listado.

A ausência de artigos NÃO determina automaticamente a classificação.

É necessário analisar também o tipo de alegação.


==================================================
EVIDÊNCIA DIRETA
==================================================

Uma evidência direta deve realmente avaliar a proposição central da alegação.

Considere:

1. mesma intervenção ou exposição;
2. mesmo desfecho;
3. contexto suficientemente semelhante;
4. população adequada quando necessário;
5. desenho capaz de avaliar a relação alegada.

Um artigo relacionado ao mesmo tema não é automaticamente evidência direta.


==================================================
ASSOCIAÇÃO NÃO É CAUSA
==================================================

Tenha atenção especial a expressões como:

- associado a;
- relacionado a;
- pode estar relacionado;
- correlação;
- risco menor;
- risco maior;
- pode reduzir;
- pode aumentar.

Não transforme automaticamente uma associação em uma conclusão causal.

Exemplo:

Se um estudo mostra que pessoas que consomem determinado alimento apresentam menor risco de uma doença, isso pode sustentar uma associação.

Isso NÃO significa automaticamente que o alimento comprovadamente causa a redução do risco.

Quando a alegação for mais ampla ou causal do que a evidência apresentada, considere "enganosa" ou "não verificável", conforme o grau de informação disponível.


==================================================
REGRA ESPECIAL PARA EVIDÊNCIA PARCIAL
==================================================

Se existe um artigo sobre o mesmo tema, mas ele não permite confirmar exatamente a alegação completa, NÃO trate esse artigo como prova suficiente.

Exemplo:

Alegação:

"O consumo regular de chá verde reduz o risco de certos tipos de câncer."

Se o artigo disponível mostra apenas uma associação específica, limitada ou inconclusiva, não amplie automaticamente o resultado para toda a alegação.

Se não for possível determinar com segurança que a afirmação completa está sustentada:

→ "não verificável"

Não transforme uma evidência parcial em confirmação completa.


==================================================
QUALIFICADORES
==================================================

Preste atenção a palavras como:

- geralmente;
- em geral;
- na maioria dos casos;
- pode;
- pode aumentar;
- pode reduzir;
- tende a;
- está associado a;
- alguns;
- certos;
- parte dos casos.

Essas expressões não significam:

- sempre;
- nunca;
- todos;
- nenhum;
- sem exceção.

Não transforme uma afirmação probabilística em uma afirmação absoluta.


==================================================
ALEGAÇÕES ABSOLUTAS DE CURA
==================================================

Palavras como:

- cura;
- cura completamente;
- elimina;
- reverte completamente;
- impede totalmente;
- comprovadamente cura;
- tratamento comprovado;

representam afirmações fortes.

Exigem evidência forte e compatível.

Exemplo:

"Beber água morna com limão cura câncer."

Alegações desse tipo não devem ser consideradas verdadeiras apenas porque existem artigos sobre limão, cítricos ou compostos derivados de limão.

Se não existe evidência clínica que sustente essa cura e a alegação contradiz o conhecimento médico estabelecido:

→ "falsa"


==================================================
COMO ESCOLHER ENTRE FALSA E NÃO VERIFICÁVEL
==================================================

Use "falsa" quando temos base suficiente para rejeitar a afirmação.

Use "não verificável" quando a afirmação é específica e não temos informação suficiente para confirmar ou rejeitar aquela afirmação específica.

PERGUNTA DE CONTROLE:

"Eu tenho informação suficiente para dizer que esta afirmação está errada?"

Se SIM:

→ falsa

Se NÃO, porque falta informação sobre a situação específica:

→ não verificável


==================================================
COMO ESCOLHER ENTRE ENGANOSA E NÃO VERIFICÁVEL
==================================================

Use "enganosa" quando já existe informação suficiente para identificar uma distorção.

Use "não verificável" quando ainda não existe informação suficiente para saber se a afirmação específica é correta ou incorreta.

Não chame de enganosa apenas porque uma alegação parece exagerada.


==================================================
EXEMPLOS DE DECISÃO
==================================================

Exemplo 1:

Alegação:

"Pessoas vacinadas contra a gripe ainda podem pegar a doença, mas geralmente apresentam sintomas mais leves."

Se essa tendência for sustentada pelo conhecimento científico:

→ verdadeira


Exemplo 2:

Alegação:

"Beber água morna com limão cura câncer."

Não há evidência clínica confiável que demonstre essa cura.

A alegação também contradiz o conhecimento médico estabelecido sobre tratamento de câncer.

→ falsa


Exemplo 3:

Alegação:

"Existe um novo medicamento experimental capaz de reverter completamente a perda de memória causada pelo Alzheimer."

Não há evidência suficiente sobre o medicamento específico.

Não é possível confirmar ou rejeitar a existência e eficácia desse tratamento apenas com conhecimento geral.

→ não verificável


Exemplo 4:

Alegação:

"Idosos com hipertensão têm maior risco de complicações graves ao contrair COVID-19."

Essa relação é bem estabelecida pelo conhecimento científico.

→ verdadeira


Exemplo 5:

Alegação:

"O chá verde reduz o risco de câncer."

Se os artigos disponíveis analisarem apenas associações específicas ou resultados limitados e não permitirem confirmar a afirmação completa:

→ não verificável


==================================================
NÃO INVENTE INFORMAÇÕES
==================================================

Nunca invente:

- estudos;
- números;
- resultados;
- autores;
- conclusões;
- consenso científico específico;
- propriedades de medicamentos;
- existência de produtos ou tratamentos.

Não diga que uma fonte prova algo que ela não investigou.


==================================================
TIPOS DE DESINFORMAÇÃO
==================================================

Use rótulos simples, por exemplo:

- informação falsa
- informação verdadeira fora de contexto
- exagero
- informação parcialmente verdadeira
- fonte falsa
- estatística manipulada
- alegação sem evidência


==================================================
TEMA
==================================================

Use um tema simples, por exemplo:

- câncer
- vacinação
- COVID-19
- gripe
- alimentação
- medicamentos
- diabetes
- saúde
- Alzheimer


==================================================
EXPLICAÇÃO PARA O PÚBLICO GERAL
==================================================

A explicação deve ser curta, clara, acolhedora e fácil de entender, especialmente para pessoas idosas.

Evite termos técnicos desnecessários.

A explicação deve ter no máximo 3 frases curtas.

Prefira:

- "As pesquisas mostram que..."
- "Os estudos disponíveis confirmam..."
- "A informação mistura uma parte verdadeira com outra que está errada ou exagerada."
- "Não encontramos informações suficientes para confirmar essa informação com segurança."

A explicação deve ser coerente com a classificação.

Se for "falsa", explique que a informação não é verdadeira.

Se for "enganosa", explique que existe uma parte verdadeira, mas a afirmação exagera ou distorce.

Se for "não verificável", explique que faltam informações suficientes para confirmar ou negar a afirmação.

Não diga que uma afirmação é falsa quando a classificação for "não verificável".


==================================================
EVIDÊNCIAS
==================================================

${JSON.stringify(
    evidenciasFormatadas,
    null,
    2
)}

==================================================
ALEGACAO
==================================================

"${claimText}"

Retorne SOMENTE JSON válido:

{
    "classificacao": "verdadeira | falsa | enganosa | não verificável",
    "tipo": "tipo simples da informação",
    "tema": "tema principal",
    "explicacao": "explicação curta, simples e fácil de entender"
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
- Não selecione um artigo apenas porque contém palavras
  como "limão" e "câncer".
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
     * V7:
     * Mantém o resultado da avaliação de evidência
     * separado da classificação final.
     */
    const cacheKey =
        `v7:groq:evidencia:${claimCache}:${ids}`;

    const cacheado =
        pegarDoCache(
            cacheKey
        );

    if (cacheado !== null) {
        console.log(
            '💾 Avaliação de evidência encontrada no cache V7 da Groq.'
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

Sua tarefa é determinar se cada artigo realmente fornece EVIDÊNCIA para a alegação apresentada.

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

Use "direta" SOMENTE quando o artigo investigar essencialmente a mesma proposição central da alegação.

Considere obrigatoriamente:

1. MESMA intervenção/exposição;
2. MESMO desfecho;
3. contexto suficientemente semelhante;
4. população adequada quando isso for essencial;
5. desenho do estudo permite avaliar a relação alegada.

O artigo não precisa usar exatamente as mesmas palavras.

Mas precisa investigar efetivamente a relação central da alegação.


==================================================
DEFINIÇÃO DE "INDIRETA"
==================================================

Use "indireta" quando existir uma relação científica real com a alegação, MAS o artigo não testar a proposição completa.

Exemplos:

- estudo de nanovesículas de limão quando a alegação é sobre beber água com limão;
- estudo de extrato de uma planta quando a alegação é sobre consumir o alimento inteiro;
- estudo em células quando a alegação afirma eficácia em humanos;
- estudo em animais quando a alegação afirma eficácia clínica em humanos;
- estudo sobre um mecanismo biológico quando a alegação afirma que uma intervenção cura uma doença;
- estudo sobre um componente de um alimento quando a alegação afirma que o alimento completo cura uma doença.


==================================================
DEFINIÇÃO DE "NAO_EVIDENCIA"
==================================================

Use "nao_evidencia" quando o artigo apenas compartilha palavras-chave ou possui relação temática insuficiente.


==================================================
REGRA ESPECIAL PARA AÇÕES CONCRETAS
==================================================

Quando a alegação descreve uma ação concreta como:

- beber;
- comer;
- tomar;
- ingerir;
- aplicar;
- usar;
- consumir;

um estudo sobre substância isolada, extrato, molécula, nanopartícula, nanovesícula, vesícula extracelular ou derivado NÃO deve ser classificado como "direta" se não testar a ação concreta descrita.


==================================================
REGRA ESPECIAL PARA CURA
==================================================

Se a alegação disser que algo:

- cura;
- elimina;
- reverte completamente;
- impede totalmente;

o artigo precisa fornecer evidência compatível com essa afirmação forte.

Um artigo que apenas demonstra:

- redução de células;
- atividade anticancerígena;
- efeito potencial;
- mecanismo biológico;
- associação;
- resultado in vitro;
- resultado em animais;

não é evidência direta de que a intervenção "cura" a doença em humanos.


==================================================
REGRA FUNDAMENTAL
==================================================

NÃO use "direta" simplesmente porque:

- o título contém as mesmas palavras;
- o artigo fala da mesma doença;
- o artigo fala do mesmo alimento;
- o artigo fala do mesmo composto;
- o artigo apresenta algum efeito relacionado.

Pergunte:

"Se eu mostrar SOMENTE este artigo para um pesquisador, ele conseguiria usar este estudo para avaliar diretamente a alegação completa?"

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
                500,
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
         * O índice precisa apontar
         * para um artigo existente.
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
         * Log detalhado para sabermos
         * exatamente o que foi descartado.
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
         * Salva somente o resultado final.
         *
         * Portanto, o cache V7 nunca vai armazenar
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