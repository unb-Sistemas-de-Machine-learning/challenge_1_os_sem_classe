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

/**
 * Classifica uma alegação utilizando o modelo da Groq
 * e as evidências recuperadas pelo sistema.
 */
async function classificarComGroq(claimText, evidencias = []) {
    const cacheKey = `groq:${claimText}`;

    const cacheado = pegarDoCache(cacheKey);

    if (cacheado !== null) {
        console.log('💾 Resultado encontrado no cache da Groq.');
        return cacheado;
    }

    if (!podeChamarGroq()) {
        console.log('⚠️ Limite de taxa da Groq atingido.');
        return null;
    }

    const evidenciasFormatadas = evidencias.map((artigo, index) => ({
        id: index + 1,
        titulo: artigo.titulo || '',
        revista: artigo.revista || '',
        data: artigo.data || '',
        resumo: artigo.resumo || '',
        url: artigo.url || ''
    }));

    const prompt = `
Você é um sistema de verificação de alegações médicas e científicas.

Sua tarefa é analisar uma alegação e classificá-la com base nas
evidências fornecidas e em conhecimento médico/científico estabelecido.

A classificação deve ser uma destas quatro categorias:

- verdadeira
- falsa
- enganosa
- não verificável

Também determine:

- o tipo de desinformação;
- o tema da alegação;
- uma explicação curta e objetiva.

==================================================
PRINCÍPIOS FUNDAMENTAIS
==================================================

1. ANALISE A ALEGAÇÃO EXATA

Avalie o que a alegação realmente afirma.

Não classifique uma alegação apenas porque existem estudos
relacionados ao mesmo assunto.

Uma evidência deve ser relevante para a afirmação específica
que está sendo analisada.

Exemplo conceitual:

Uma alegação afirma que determinado tratamento "cura" uma doença.

Um estudo que apenas investigou um mecanismo biológico relacionado
ao tratamento não é, por si só, evidência suficiente para afirmar
que o tratamento cura a doença.

==================================================
2. VERDADEIRA
==================================================

Classifique como "verdadeira" quando houver evidência suficiente
para sustentar a alegação.

Isso pode ocorrer quando:

- estudos relevantes sustentam diretamente a afirmação;
- múltiplas evidências convergem para a mesma conclusão;
- a afirmação corresponde a conhecimento médico ou científico
  bem estabelecido.

A força da conclusão deve ser compatível com a força da evidência.

Não transforme evidência limitada em uma conclusão mais forte
do que ela permite.

==================================================
3. FALSA
==================================================

Classifique como "falsa" somente quando houver base suficiente
para concluir que a alegação está incorreta.

Isso ocorre principalmente quando:

- evidências relevantes contradizem diretamente a alegação;
- existe consenso ou conhecimento científico estabelecido
  incompatível com a alegação;
- a alegação afirma como fato algo que é conhecido como incorreto.

IMPORTANTE:

A ausência de evidência NÃO é automaticamente evidência de falsidade.

Não encontrar estudos que comprovem uma alegação não significa,
por si só, que a alegação seja falsa.

Quando não houver evidência suficiente para confirmar ou contradizer
a afirmação, considere "não verificável".

==================================================
4. ENGANOSA
==================================================

Classifique como "enganosa" somente quando houver um núcleo
verdadeiro ou plausível na alegação, mas a forma como esse núcleo
é apresentado causar uma distorção relevante.

Isso pode ocorrer por:

- exagero;
- generalização indevida;
- omissão de uma condição importante;
- interpretação incorreta de uma evidência;
- retirada de uma informação de seu contexto;
- transformar uma associação em causalidade;
- transformar evidência preliminar em conclusão definitiva;
- atribuir a seres humanos resultados observados apenas
  em modelos experimentais.

IMPORTANTE:

A existência de estudos relacionados ao assunto NÃO é suficiente
para classificar uma alegação como "enganosa".

É necessário identificar uma relação clara entre a evidência
e o núcleo da alegação.

Se a evidência simplesmente não for suficiente para determinar
se a afirmação é verdadeira ou falsa, prefira "não verificável".

==================================================
5. NÃO VERIFICÁVEL
==================================================

Classifique como "não verificável" quando as evidências disponíveis
não permitirem determinar adequadamente a veracidade da alegação.

Isso inclui situações em que:

- não existem evidências relevantes suficientes;
- os estudos encontrados são apenas indiretamente relacionados;
- os resultados são inconclusivos;
- existem resultados conflitantes sem evidência suficiente
  para determinar uma conclusão;
- a afirmação é muito específica e os estudos não a testam diretamente;
- existem evidências experimentais preliminares, mas não suficientes
  para confirmar a afirmação;
- a alegação envolve seres humanos, mas as evidências disponíveis
  são exclusivamente laboratoriais ou em animais;
- não há evidência suficiente para afirmar que a alegação é falsa.

"Não verificável" não significa que a alegação seja verdadeira.

Significa apenas que as evidências disponíveis não permitem
uma classificação mais forte.

==================================================
6. EVIDÊNCIA EM ANIMAIS E LABORATÓRIO
==================================================

Diferencie claramente:

- estudos in vitro;
- estudos em células;
- estudos em animais;
- estudos observacionais em humanos;
- ensaios clínicos em humanos;
- revisões sistemáticas e meta-análises.

Resultados in vitro ou em animais podem fornecer evidências
preliminares ou indicar mecanismos possíveis, mas não devem ser
automaticamente tratados como prova de eficácia ou segurança
em seres humanos.

Quando uma alegação sobre seres humanos é sustentada apenas
por evidências experimentais, avalie cuidadosamente se a conclusão
apropriada é "não verificável" ou "enganosa".

==================================================
7. AFIRMAÇÕES ABSOLUTAS
==================================================

Tenha cuidado especial com palavras como:

- sempre;
- nunca;
- cura;
- elimina;
- garante;
- completamente;
- definitivamente;
- comprovado;
- 100%.

Afirmações absolutas exigem evidências proporcionalmente fortes.

Uma evidência parcial ou preliminar não deve ser usada para
sustentar uma conclusão absoluta.

==================================================
8. ASSOCIAÇÃO NÃO É CAUSALIDADE
==================================================

Não trate automaticamente uma associação estatística como
uma relação causal.

Por exemplo, um estudo observacional pode encontrar associação
entre dois fatores sem demonstrar que um deles causou o outro.

Quando uma alegação transforma associação em causalidade,
considere se isso configura uma distorção ou se a evidência
é simplesmente insuficiente para determinar a conclusão.

==================================================
9. EVIDÊNCIAS CONFLITANTES
==================================================

Quando existirem estudos com resultados diferentes:

- considere a qualidade das evidências;
- considere o tipo de estudo;
- considere o tamanho e a relevância dos estudos;
- considere se existem revisões sistemáticas ou meta-análises;
- não escolha arbitrariamente apenas o estudo que confirma
  ou contradiz a alegação.

Se o conjunto de evidências permanecer inconclusivo,
prefira "não verificável".

==================================================
10. ORDEM DE DECISÃO
==================================================

Antes de produzir a classificação final, siga esta ordem:

PASSO 1:
Existe evidência suficiente e relevante que sustente diretamente
a alegação?

→ Se sim, considere "verdadeira".

PASSO 2:
Existe evidência suficiente e relevante que contradiga diretamente
a alegação, ou a alegação contradiz conhecimento científico
bem estabelecido?

→ Se sim, considere "falsa".

PASSO 3:
Existe um núcleo verdadeiro ou plausível, mas a alegação apresenta
exagero, distorção, generalização indevida ou erro de contexto?

→ Se sim, considere "enganosa".

PASSO 4:
Nenhuma das situações anteriores possui evidência suficiente?

→ Classifique como "não verificável".

IMPORTANTE:

Não pule diretamente de "não encontrei evidências suficientes"
para "falsa".

==================================================
11. TIPO DE DESINFORMAÇÃO
==================================================

Escolha o tipo que melhor descreve o problema da alegação.

Opções:

${TIPOS_DESINFORMACAO.map(tipo => `- ${tipo}`).join('\n')}

Se a alegação for "não verificável" e não houver evidência
de uma forma específica de manipulação, utilize:

"alegação sem evidência"

==================================================
12. TEMA
==================================================

Determine o principal tema da alegação.

Exemplos de temas:

- vacinação;
- doenças infecciosas;
- medicamentos;
- nutrição;
- câncer;
- saúde cardiovascular;
- saúde mental;
- diabetes;
- neurologia;
- prevenção;
- tratamentos;
- epidemiologia;
- outro;
- fora do escopo.

Se a alegação não estiver relacionada à saúde ou ciência médica,
utilize "fora do escopo".

==================================================
13. EXPLICAÇÃO
==================================================

A explicação deve:

- ser curta;
- justificar a classificação;
- mencionar a principal evidência utilizada;
- deixar claro quando a evidência é insuficiente;
- não inventar resultados de estudos;
- não afirmar que um estudo prova algo que ele não investigou.

Se a classificação for "não verificável", explique brevemente
por que as evidências disponíveis são insuficientes.

Se a classificação for "falsa", indique qual evidência
ou conhecimento estabelecido contradiz a alegação.

Se for "enganosa", identifique qual é o núcleo plausível
e qual é a distorção.

==================================================
EVIDÊNCIAS DISPONÍVEIS
==================================================

${JSON.stringify(evidenciasFormatadas, null, 2)}

==================================================
ALEGAÇÃO
==================================================

"${claimText}"

==================================================
FORMATO DA RESPOSTA
==================================================

Responda SOMENTE com JSON válido, seguindo exatamente esta estrutura:

{
  "classificacao": "verdadeira | falsa | enganosa | não verificável",
  "tipo": "tipo de desinformação",
  "tema": "tema principal",
  "explicacao": "explicação objetiva"
}
`;

    try {
        const response = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-120b',
                    messages: [
                        {
                            role: 'system',
                            content:
                                'Você é um verificador rigoroso de alegações médicas e científicas.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.1,
                    reasoning_effort: 'low',
                    max_completion_tokens: 700,
                    response_format: {
                        type: 'json_object'
                    }
                })
            }
        );

        if (!response.ok) {
            const erro = await response.text();

            console.log(
                `⚠️ Erro da Groq (${response.status}): ${erro}`
            );

            throw new Error(`Groq API ${response.status}`);
        }

        const data = await response.json();

        const conteudo =
            data.choices?.[0]?.message?.content;

        if (!conteudo) {
            throw new Error('Resposta vazia da Groq.');
        }

        let resultado;

        try {
            resultado = JSON.parse(conteudo);
        } catch (erro) {
            console.log('⚠️ Groq retornou JSON inválido.');
            console.log(conteudo);

            throw new Error('JSON inválido retornado pela Groq.');
        }

        const classificacoesValidas = [
            'verdadeira',
            'falsa',
            'enganosa',
            'não verificável'
        ];

        if (!classificacoesValidas.includes(resultado.classificacao)) {
            console.log(
                `⚠️ Classificação inválida retornada pela Groq: ${resultado.classificacao}`
            );

            throw new Error('Classificação inválida.');
        }

        if (!resultado.tipo) {
            resultado.tipo = 'alegação sem evidência';
        }

        if (!resultado.tema) {
            resultado.tema = 'outro';
        }

        if (!resultado.explicacao) {
            resultado.explicacao =
                'Não foi possível obter uma explicação adequada.';
        }

        salvarNoCache(cacheKey, resultado);

        return resultado;

    } catch (erro) {
        console.error(
            `❌ Falha ao classificar alegação: ${erro.message}`
        );

        throw erro;
    }
}


/**
 * Filtra os artigos recuperados pelo PubMed usando a Groq.
 *
 * A função não classifica a alegação.
 * Ela apenas verifica quais evidências possuem relação direta
 * com a alegação.
 */
async function filtrarRelevancia(claimText, artigos, max = 3) {
    if (!artigos || artigos.length === 0) {
        return [];
    }

    const ids = artigos
        .map(artigo => artigo.id)
        .join(',');

    const cacheKey =
        `groq:relevancia:${claimText}:${ids}`;

    const cacheado = pegarDoCache(cacheKey);

    if (cacheado !== null) {
        console.log('💾 Relevância encontrada no cache da Groq.');
        return cacheado;
    }

    if (!podeChamarGroq()) {
        console.log(
            '⚠️ Limite de taxa da Groq atingido durante filtro de relevância.'
        );

        return artigos.slice(0, max);
    }

    const candidatos = artigos.map((artigo, index) => ({
        indice: index + 1,
        titulo: artigo.titulo || '',
        resumo: (artigo.resumo || '').slice(0, 300)
    }));

    const prompt = `
Você é um sistema de seleção de evidências científicas.

Determine quais artigos são diretamente relevantes para verificar
a alegação apresentada.

Não selecione artigos apenas porque compartilham palavras-chave
com a alegação.

Um artigo é relevante quando seus resultados, objetivo ou conteúdo
podem ajudar diretamente a confirmar, contradizer ou avaliar
a alegação.

A alegação é:

"${claimText}"

Artigos:

${JSON.stringify(candidatos, null, 2)}

Retorne SOMENTE JSON válido:

{
  "relevantes": [1, 2, 3]
}

Regras:

- selecione no máximo ${max} artigos;
- utilize somente os índices fornecidos;
- não invente índices;
- prefira evidências diretamente relacionadas à alegação;
- se um artigo tratar apenas de um assunto relacionado,
  mas não ajudar a verificar a alegação, não o selecione.
`;

    try {
        const response = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-120b',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.1,
                    reasoning_effort: 'low',
                    max_completion_tokens: 300,
                    response_format: {
                        type: 'json_object'
                    }
                })
            }
        );

        if (!response.ok) {
            const erro = await response.text();

            console.log(
                `⚠️ Erro da Groq no filtro de relevância (${response.status}): ${erro}`
            );

            throw new Error(
                `Groq relevância API ${response.status}`
            );
        }

        const data = await response.json();

        const conteudo =
            data.choices?.[0]?.message?.content;

        if (!conteudo) {
            throw new Error(
                'Resposta vazia da Groq no filtro de relevância.'
            );
        }

        const resultado = JSON.parse(conteudo);

        const indices = Array.isArray(resultado.relevantes)
            ? resultado.relevantes
            : [];

        const selecionados = indices
            .filter(
                indice =>
                    Number.isInteger(indice) &&
                    indice >= 1 &&
                    indice <= artigos.length
            )
            .map(indice => artigos[indice - 1])
            .filter(Boolean)
            .slice(0, max);

        if (selecionados.length === 0) {
            console.log(
                '⚠️ Filtro de relevância não selecionou artigos. Mantendo pré-seleção.'
            );

            const fallback = artigos.slice(0, max);

            salvarNoCache(cacheKey, fallback);

            return fallback;
        }

        console.log(
            `✓ ${selecionados.length} artigos confirmados como relevantes pela Groq.`
        );

        salvarNoCache(cacheKey, selecionados);

        return selecionados;

    } catch (erro) {
        console.error(
            `❌ Falha no filtro de relevância: ${erro.message}`
        );

        return artigos.slice(0, max);
    }
}


module.exports = {
    classificarComGroq,
    filtrarRelevancia
};
