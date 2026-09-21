const { criarLimitador } = require('./rateLimiter');
const { filtrarRelevancia } = require('./groq');

const PUBMED_KEY = process.env.PUBMED_API_KEY;

const BASE =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const EMAIL =
    process.env.PUBMED_EMAIL || 'medfact@localhost';

const TOOL =
    'MedFact';

const podeChamarPubmed =
    criarLimitador(PUBMED_KEY ? 60 : 3);

const CACHE_TTL =
    1000 * 60 * 60 * 24;

const cacheBuscas = new Map();

const USAR_FILTRO_RELEVANCIA =
    process.env.PUBMED_FILTRO_RELEVANCIA !== 'false';


/* =========================================================
 * CACHE
 * ========================================================= */

function pegarCache(chave) {
    const item = cacheBuscas.get(chave);

    if (!item) {
        return null;
    }

    if (Date.now() - item.timestamp > CACHE_TTL) {
        cacheBuscas.delete(chave);
        return null;
    }

    return item.valor;
}


function salvarCache(chave, valor) {
    cacheBuscas.set(chave, {
        valor,
        timestamp: Date.now()
    });
}


/* =========================================================
 * NORMALIZAÇÃO
 * ========================================================= */

function normalizarTexto(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}


function escaparXML(texto) {
    return String(texto || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#(\d+);/g, (_, codigo) => {
            return String.fromCharCode(Number(codigo));
        })
        .replace(/&#x([0-9a-f]+);/gi, (_, codigo) => {
            return String.fromCharCode(parseInt(codigo, 16));
        });
}


/* =========================================================
 * DICIONÁRIO MÉDICO
 *
 * O objetivo aqui não é traduzir a frase inteira.
 * É identificar conceitos médicos importantes.
 * ========================================================= */

const CONCEITOS_MEDICOS = [

    /* Vacinação */
    {
        termos: [
            'vacina',
            'vacinas',
            'vacinacao',
            'vacinação',
            'imunizacao',
            'imunização'
        ],
        query:
            '("Vaccines"[MeSH Terms] OR vaccine* OR vaccination OR immunization)'
    },

    {
        termos: [
            'covid',
            'covid-19',
            'covid19',
            'sars cov 2',
            'coronavirus'
        ],
        query:
            '("COVID-19"[MeSH Terms] OR "COVID-19" OR SARS-CoV-2 OR coronavirus)'
    },

    {
        termos: [
            'gripe',
            'influenza',
            'flu'
        ],
        query:
            '("Influenza, Human"[MeSH Terms] OR influenza OR "flu")'
    },

    {
        termos: [
            'sarampo'
        ],
        query:
            '("Measles"[MeSH Terms] OR measles)'
    },

    {
        termos: [
            'febre amarela'
        ],
        query:
            '("Yellow Fever"[MeSH Terms] OR "yellow fever")'
    },

    {
        termos: [
            'hpv'
        ],
        query:
            '("Papillomavirus Infections"[MeSH Terms] OR HPV OR papillomavirus)'
    },

    {
        termos: [
            'hepatite'
        ],
        query:
            '("Hepatitis"[MeSH Terms] OR hepatitis)'
    },


    /* Doenças neurológicas */

    {
        termos: [
            'alzheimer',
            'alzheimer'
        ],
        query:
            '("Alzheimer Disease"[MeSH Terms] OR "Alzheimer disease" OR dementia)'
    },

    {
        termos: [
            'demencia',
            'demência'
        ],
        query:
            '("Dementia"[MeSH Terms] OR dementia)'
    },

    {
        termos: [
            'parkinson'
        ],
        query:
            '("Parkinson Disease"[MeSH Terms] OR "Parkinson disease")'
    },


    /* Doenças cardiovasculares */

    {
        termos: [
            'ataque cardiaco',
            'ataque cardíaco',
            'infarto',
            'infarto do miocardio',
            'infarto do miocárdio'
        ],
        query:
            '("Myocardial Infarction"[MeSH Terms] OR "myocardial infarction" OR "heart attack" OR "acute coronary syndrome")'
    },

    {
        termos: [
            'pressao alta',
            'pressão alta',
            'hipertensao',
            'hipertensão'
        ],
        query:
            '("Hypertension"[MeSH Terms] OR hypertension OR "high blood pressure")'
    },

    {
        termos: [
            'doenca cardiaca',
            'doença cardíaca',
            'doenca cardiovascular',
            'doença cardiovascular'
        ],
        query:
            '("Cardiovascular Diseases"[MeSH Terms] OR "cardiovascular disease" OR "heart disease")'
    },


    /* Diabetes */

    {
        termos: [
            'diabetes',
            'diabetes tipo 2',
            'diabetes tipo ii'
        ],
        query:
            '("Diabetes Mellitus, Type 2"[MeSH Terms] OR "type 2 diabetes" OR "type II diabetes")'
    },


    /* Câncer */

    {
        termos: [
            'cancer',
            'câncer',
            'tumor',
            'tumor'
        ],
        query:
            '("Neoplasms"[MeSH Terms] OR cancer OR neoplasm OR tumor)'
    },


    /* Medicamentos */

    {
        termos: [
            'hidroxicloroquina',
            'hydroxychloroquine'
        ],
        query:
            '("Hydroxychloroquine"[MeSH Terms] OR hydroxychloroquine)'
    },

    {
        termos: [
            'cloroquina',
            'chloroquine'
        ],
        query:
            '("Chloroquine"[MeSH Terms] OR chloroquine)'
    },


    /* Vitaminas / suplementos */

    {
        termos: [
            'vitamina c',
            'vitamin c'
        ],
        query:
            '("Ascorbic Acid"[MeSH Terms] OR "vitamin C" OR ascorbic acid)'
    },

    {
        termos: [
            'vitamina d',
            'vitamin d'
        ],
        query:
            '("Vitamin D"[MeSH Terms] OR "vitamin D")'
    },


    /* Alimentação */

    {
        termos: [
            'cha verde',
            'chá verde',
            'green tea'
        ],
        query:
            '("Tea"[MeSH Terms] OR "green tea" OR Camellia sinensis)'
    },

    {
        termos: [
            'limao',
            'limão',
            'lemon'
        ],
        query:
            '("Citrus"[MeSH Terms] OR lemon OR citrus)'
    },


    /* Sintomas / condições */

    {
        termos: [
            'resfriado',
            'resfriados',
            'gripe comum'
        ],
        query:
            '("Common Cold"[MeSH Terms] OR "common cold")'
    },

    {
        termos: [
            'tosse'
        ],
        query:
            '("Cough"[MeSH Terms] OR cough)'
    },

    {
        termos: [
            'febre'
        ],
        query:
            '("Fever"[MeSH Terms] OR fever)'
    }
];


/* =========================================================
 * TERMOS QUE NÃO AJUDAM NA BUSCA
 * ========================================================= */

const STOPWORDS = new Set([
    'a',
    'o',
    'as',
    'os',
    'um',
    'uma',
    'uns',
    'umas',

    'da',
    'do',
    'das',
    'dos',
    'de',

    'na',
    'no',
    'nas',
    'nos',
    'em',

    'por',
    'para',
    'com',
    'sem',

    'que',
    'se',

    'pode',
    'podem',
    'poderia',
    'poderiam',

    'causa',
    'causar',
    'causa',
    'causam',
    'causaria',
    'causaria',

    'faz',
    'fazer',
    'fazem',

    'ser',
    'sao',
    'são',
    'é',

    'tem',
    'ter',
    'têm',

    'pessoa',
    'pessoas',

    'isso',
    'isto',

    'verdade',
    'verdadeiro',
    'verdadeira',

    'falso',
    'falsa',

    'mesmo',
    'mesma',

    'realmente',

    'porem',
    'porém',

    'pode-se',

    'e',
    'ou',

    'como',

    'quanto',

    'sobre',

    'uma'
]);


/* =========================================================
 * EXTRAÇÃO DE CONCEITOS MÉDICOS
 * ========================================================= */

function encontrarConceitos(query) {

    const texto = normalizarTexto(query);

    const encontrados = [];

    for (const conceito of CONCEITOS_MEDICOS) {

        const encontrou = conceito.termos.some(termo => {

            const termoNormalizado =
                normalizarTexto(termo);

            return texto.includes(termoNormalizado);
        });

        if (encontrou) {
            encontrados.push(conceito);
        }
    }

    /*
     * Remove conceitos duplicados.
     */
    const unicos = [];

    for (const conceito of encontrados) {

        if (!unicos.some(
            item => item.query === conceito.query
        )) {
            unicos.push(conceito);
        }
    }

    return unicos;
}


/* =========================================================
 * GERAÇÃO DA QUERY BIOMÉDICA
 * ========================================================= */

function gerarQueryBiomedica(claimText) {

    const conceitos =
        encontrarConceitos(claimText);

    /*
     * Caso tenhamos conceitos conhecidos,
     * fazemos AND entre eles.
     *
     * Exemplo:
     *
     * "A vacina da gripe pode causar Alzheimer?"
     *
     * vira aproximadamente:
     *
     * influenza AND Alzheimer
     */
    if (conceitos.length > 0) {

        const partes =
            conceitos
                .slice(0, 4)
                .map(item => item.query);

        return partes.join(' AND ');
    }

    /*
     * Fallback:
     * caso não reconheçamos termos médicos específicos,
     * retiramos palavras muito genéricas.
     */
    return simplificarQuery(claimText);
}


/* =========================================================
 * QUERY ALTERNATIVA MAIS AMPLA
 * ========================================================= */

function gerarQueryAmpla(claimText) {

    const conceitos =
        encontrarConceitos(claimText);

    if (conceitos.length === 0) {
        return simplificarQuery(claimText);
    }

    /*
     * Em vez de exigir todos os conceitos,
     * procuramos qualquer combinação relevante.
     *
     * Isso evita ficar sem resultado quando a query
     * principal estiver restritiva demais.
     */
    return conceitos
        .slice(0, 4)
        .map(item => item.query)
        .join(' OR ');
}


/* =========================================================
 * SIMPLIFICAÇÃO DA QUERY ORIGINAL
 * ========================================================= */

function simplificarQuery(query) {

    const texto =
        normalizarTexto(query);

    const palavras =
        texto
            .split(/\s+/)
            .filter(Boolean)
            .filter(palavra => {
                return !STOPWORDS.has(palavra);
            })
            .slice(0, 12);

    return palavras.join(' ');
}


/* =========================================================
 * LIMITAR QUERY
 * ========================================================= */

function limitarQuery(query, maxCaracteres = 900) {

    if (!query) {
        return '';
    }

    if (query.length <= maxCaracteres) {
        return query;
    }

    return query.slice(0, maxCaracteres);
}


/* =========================================================
 * REQUISIÇÃO GENÉRICA AO PUBMED
 * ========================================================= */

async function requisitarPubMed(url) {

    if (!podeChamarPubmed()) {

        console.log(
            '⚠️ Limite local do PubMed atingido.'
        );

        return null;
    }

    try {

        const response =
            await fetch(url, {
                headers: {
                    'User-Agent':
                        `${TOOL}/1.0 (email: ${EMAIL})`
                }
            });

        if (!response.ok) {

            console.error(
                `❌ PubMed HTTP ${response.status}`
            );

            return null;
        }

        return await response.text();

    } catch (erro) {

        console.error(
            '❌ Erro na requisição ao PubMed:',
            erro.message
        );

        return null;
    }
}


/* =========================================================
 * BUSCAR IDs
 * ========================================================= */

async function buscarIds(query, max = 10) {

    if (!query || !query.trim()) {
        return [];
    }

    const queryLimitada =
        limitarQuery(query);

    const chave =
        `ids:${queryLimitada}`;

    const cacheado =
        pegarCache(chave);

    if (cacheado !== null) {

        console.log(
            '📦 IDs recuperados do cache.'
        );

        return cacheado;
    }

    const url =
        new URL(`${BASE}/esearch.fcgi`);

    url.searchParams.set(
        'db',
        'pubmed'
    );

    url.searchParams.set(
        'term',
        queryLimitada
    );

    url.searchParams.set(
        'retmode',
        'xml'
    );

    url.searchParams.set(
        'retmax',
        String(max)
    );

    /*
     * "relevance" aproxima o comportamento de
     * "Best Match" do PubMed.
     */
    url.searchParams.set(
        'sort',
        'relevance'
    );

    url.searchParams.set(
        'tool',
        TOOL
    );

    url.searchParams.set(
        'email',
        EMAIL
    );

    if (PUBMED_KEY) {

        url.searchParams.set(
            'api_key',
            PUBMED_KEY
        );
    }

    console.log(
        `🔎 Query PubMed: ${queryLimitada}`
    );

    const xml =
        await requisitarPubMed(url);

    if (!xml) {
        return [];
    }

    const ids =
        [
            ...xml.matchAll(
                /<Id>(\d+)<\/Id>/g
            )
        ]
            .map(match => match[1]);

    const unicos =
        [...new Set(ids)];

    salvarCache(
        chave,
        unicos
    );

    return unicos;
}


/* =========================================================
 * BUSCAR ARTIGOS
 * ========================================================= */

async function buscarArtigos(ids) {

    if (!ids || ids.length === 0) {
        return [];
    }

    const idsUnicos =
        [...new Set(ids)]
            .filter(id => /^\d+$/.test(id));

    if (idsUnicos.length === 0) {
        return [];
    }

    const chave =
        `artigos:${idsUnicos.join(',')}`;

    const cacheado =
        pegarCache(chave);

    if (cacheado !== null) {

        console.log(
            '📦 Artigos recuperados do cache.'
        );

        return cacheado;
    }

    const url =
        new URL(`${BASE}/efetch.fcgi`);

    url.searchParams.set(
        'db',
        'pubmed'
    );

    url.searchParams.set(
        'id',
        idsUnicos.join(',')
    );

    url.searchParams.set(
        'retmode',
        'xml'
    );

    url.searchParams.set(
        'rettype',
        'abstract'
    );

    url.searchParams.set(
        'tool',
        TOOL
    );

    url.searchParams.set(
        'email',
        EMAIL
    );

    if (PUBMED_KEY) {

        url.searchParams.set(
            'api_key',
            PUBMED_KEY
        );
    }

    const xml =
        await requisitarPubMed(url);

    if (!xml) {
        return [];
    }

    const artigos = [];

    const blocos =
        xml.match(
            /<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g
        ) || [];

    for (const bloco of blocos) {

        const id =
            extrairTag(
                bloco,
                'PMID'
            );

        if (!id) {
            continue;
        }

        const titulo =
            limparTextoXML(
                extrairTag(
                    bloco,
                    'ArticleTitle'
                )
            );

        const resumo =
            extrairResumo(
                bloco
            );

        const revista =
            limparTextoXML(
                extrairTag(
                    bloco,
                    'Title'
                )
            );

        const data =
            extrairDataPublicacao(
                bloco
            );

        artigos.push({

            id,

            titulo:
                titulo || 'Título não disponível',

            resumo:
                resumo || 'Resumo não disponível',

            revista:
                revista || 'Revista não informada',

            data:
                data || '',

            url:
                `https://pubmed.ncbi.nlm.nih.gov/${id}/`
        });
    }

    salvarCache(
        chave,
        artigos
    );

    return artigos;
}


/* =========================================================
 * EXTRAIR TAG XML
 * ========================================================= */

function extrairTag(xml, tag) {

    /*
     * Permite atributos dentro da tag.
     *
     * Exemplo:
     *
     * <ArticleTitle>...</ArticleTitle>
     *
     * e também:
     *
     * <ArticleTitle Language="en">...</ArticleTitle>
     */

    const regex =
        new RegExp(
            `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
            'i'
        );

    const match =
        xml.match(regex);

    if (!match) {
        return '';
    }

    return match[1];
}


/* =========================================================
 * EXTRAIR RESUMO
 * ========================================================= */

function extrairResumo(xml) {

    const bloco =
        xml.match(
            /<Abstract>([\s\S]*?)<\/Abstract>/i
        );

    if (!bloco) {
        return '';
    }

    /*
     * Um Abstract pode possuir vários AbstractText,
     * eventualmente com Label.
     */
    const partes =
        [
            ...bloco[1].matchAll(
                /<AbstractText(?:\s+Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/gi
            )
        ];

    if (partes.length === 0) {

        return limparTextoXML(
            bloco[1]
        );
    }

    return partes
        .map(match => {

            const label =
                match[1]
                    ? `${match[1]}: `
                    : '';

            return (
                label +
                limparTextoXML(match[2])
            );

        })
        .join(' ');
}


/* =========================================================
 * DATA DE PUBLICAÇÃO
 * ========================================================= */

function extrairDataPublicacao(xml) {

    /*
     * Primeiro tenta PubDate.
     */
    const pubDate =
        extrairTag(
            xml,
            'PubDate'
        );

    if (pubDate) {

        return limparTextoXML(
            pubDate
        );
    }

    /*
     * Fallback para Year.
     */
    const year =
        extrairTag(
            xml,
            'Year'
        );

    if (year) {
        return limparTextoXML(year);
    }

    return '';
}


/* =========================================================
 * LIMPEZA DO XML
 * ========================================================= */

function limparTextoXML(texto) {

    if (!texto) {
        return '';
    }

    let resultado =
        escaparXML(texto);

    /*
     * Remove tags restantes.
     */
    resultado =
        resultado.replace(
            /<[^>]+>/g,
            ' '
        );

    /*
     * Decodifica algumas entidades comuns.
     */
    resultado =
        resultado
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

    return resultado
        .replace(/\s+/g, ' ')
        .trim();
}


/* =========================================================
 * TERMOS RELEVANTES
 * ========================================================= */

function extrairTermosRelevantes(query) {

    const texto =
        normalizarTexto(query);

    const termos =
        texto
            .split(/\s+/)
            .filter(Boolean)
            .filter(termo => {

                if (STOPWORDS.has(termo)) {
                    return false;
                }

                /*
                 * Termos muito pequenos geram muitos
                 * falsos positivos.
                 */
                if (termo.length < 4) {
                    return false;
                }

                return true;
            });

    return [...new Set(termos)];
}


/* =========================================================
 * RANKING LEXICAL
 * ========================================================= */

function selecionarMaisRelevantes(
    artigos,
    query,
    max = 5
) {

    if (!artigos || artigos.length === 0) {
        return [];
    }

    const termosQuery =
        extrairTermosRelevantes(query);

    const conceitos =
        encontrarConceitos(query);

    /*
     * Também considera os termos ingleses
     * presentes nas queries médicas.
     */
    const termosConceituais = [];

    for (const conceito of conceitos) {

        const termos =
            conceito.query
                .replace(/[()"[\]]/g, ' ')
                .split(/\s+OR\s+|\s+AND\s+/i)
                .map(item =>
                    item
                        .replace(/["']/g, '')
                        .trim()
                )
                .filter(Boolean);

        termosConceituais.push(...termos);
    }

    const todosOsTermos =
        [
            ...termosQuery,
            ...termosConceituais
        ]
            .map(normalizarTexto)
            .filter(Boolean);

    const termosUnicos =
        [...new Set(todosOsTermos)];

    const classificados =
        artigos.map(artigo => {

            const titulo =
                normalizarTexto(
                    artigo.titulo
                );

            const resumo =
                normalizarTexto(
                    artigo.resumo
                );

            const texto =
                `${titulo} ${resumo}`;

            let pontuacao = 0;

            for (const termo of termosUnicos) {

                if (!termo) {
                    continue;
                }

                if (titulo.includes(termo)) {
                    pontuacao += 4;
                }

                else if (resumo.includes(termo)) {
                    pontuacao += 1;
                }
            }

            return {
                artigo,
                pontuacao
            };
        });

    classificados.sort(
        (a, b) =>
            b.pontuacao -
            a.pontuacao
    );

    console.log(
        '\n📊 Ranking por relevância:'
    );

    classificados.forEach(
        (item, index) => {

            console.log(
                `${index + 1}. ` +
                `[${item.pontuacao}] ` +
                `${item.artigo.titulo}`
            );
        }
    );

    return classificados
        .slice(0, max)
        .map(item => item.artigo);
}


/* =========================================================
 * BUSCA MULTI-ESTRATÉGIA
 * ========================================================= */

async function buscarIdsComEstrategias(
    claimText,
    maxPorBusca = 10
) {

    const queries = [];

    /*
     * 1. Query biomédica.
     *
     * É a principal.
     */
    const queryBiomedica =
        gerarQueryBiomedica(
            claimText
        );

    if (queryBiomedica) {

        queries.push({
            nome: 'biomédica',
            query: queryBiomedica
        });
    }


    /*
     * 2. Query ampla.
     *
     * Serve de fallback quando AND ficou
     * restritivo demais.
     */
    const queryAmpla =
        gerarQueryAmpla(
            claimText
        );

    if (
        queryAmpla &&
        queryAmpla !== queryBiomedica
    ) {

        queries.push({
            nome: 'ampla',
            query: queryAmpla
        });
    }


    /*
     * 3. Query simplificada em português.
     *
     * Não é a principal, mas pode encontrar
     * artigos que contenham termos semelhantes.
     */
    const querySimplificada =
        simplificarQuery(
            claimText
        );

    if (
        querySimplificada &&
        querySimplificada !== queryBiomedica &&
        querySimplificada !== queryAmpla
    ) {

        queries.push({
            nome: 'simplificada',
            query: querySimplificada
        });
    }


    /*
     * Limita o número de estratégias.
     */
    const estrategias =
        queries.slice(0, 3);

    const todosIds = [];

    for (const estrategia of estrategias) {

        console.log(
            `\n🔎 Estratégia: ${estrategia.nome}`
        );

        console.log(
            `   Query: ${estrategia.query}`
        );

        const ids =
            await buscarIds(
                estrategia.query,
                maxPorBusca
            );

        console.log(
            `   → ${ids.length} PMIDs encontrados.`
        );

        todosIds.push(...ids);

        /*
         * Se a estratégia principal encontrou
         * bastante coisa, ainda podemos continuar
         * para enriquecer a busca.
         */
    }

    const idsUnicos =
        [...new Set(todosIds)];

    return idsUnicos;
}


/* =========================================================
 * BUSCA PRINCIPAL
 * ========================================================= */

async function searchPubMed(
    query,
    max = 3
) {

    console.log(
        `\n🔎 Buscando evidências no PubMed para: "${query}"`
    );

    if (!query || !query.trim()) {

        console.log(
            '⚠️ Query vazia.'
        );

        return [];
    }

    try {

        /*
         * =====================================================
         * ETAPA 1
         * Geração de queries + busca de PMIDs
         * =====================================================
         */

        const ids =
            await buscarIdsComEstrategias(
                query,
                10
            );

        console.log(
            `\n✓ ${ids.length} PMIDs únicos encontrados.`
        );

        if (ids.length === 0) {

            console.log(
                '⚠️ Nenhum artigo encontrado no PubMed.'
            );

            return [];
        }


        /*
         * =====================================================
         * ETAPA 2
         * Recuperação dos artigos
         * =====================================================
         */

        const artigos =
            await buscarArtigos(
                ids.slice(0, 20)
            );

        console.log(
            `✓ ${artigos.length} artigos recuperados.`
        );

        if (artigos.length === 0) {

            console.log(
                '⚠️ PMIDs encontrados, mas não foi possível recuperar os artigos.'
            );

            return [];
        }


        /*
         * =====================================================
         * ETAPA 3
         * Ranking lexical
         * =====================================================
         */

        const preFiltrados =
            selecionarMaisRelevantes(
                artigos,
                query,
                Math.max(5, max)
            );

        console.log(
            `✓ ${preFiltrados.length} artigos pré-selecionados.`
        );

        console.log(
            '\nARTIGOS PRÉ-SELECIONADOS:'
        );

        preFiltrados.forEach(
            artigo => {
                console.log(
                    `- ${artigo.titulo}`
                );
            }
        );

        if (preFiltrados.length === 0) {

            console.log(
                '⚠️ Ranking não encontrou artigos relevantes.'
            );

            /*
             * Segurança:
             * ainda devolvemos artigos recuperados.
             *
             * Isso evita evidencias: [] quando
             * o ranking falhar.
             */
            return artigos.slice(0, max);
        }


        /*
         * =====================================================
         * ETAPA 4
         * Filtro semântico
         * =====================================================
         */

        let selecionados;

        if (USAR_FILTRO_RELEVANCIA) {

            try {

                selecionados =
                    await filtrarRelevancia(
                        query,
                        preFiltrados,
                        max
                    );

            } catch (erro) {

                console.error(
                    '⚠️ Erro no filtro semântico:',
                    erro.message
                );

                selecionados = [];
            }

            /*
             * PROBLEMA IMPORTANTE:
             *
             * A Groq pode retornar [] mesmo quando
             * temos artigos relevantes.
             *
             * Nesse caso NÃO podemos devolver [].
             */
            if (
                !selecionados ||
                selecionados.length === 0
            ) {

                console.log(
                    '⚠️ Filtro semântico não selecionou artigos.'
                );

                console.log(
                    '→ Usando fallback lexical.'
                );

                selecionados =
                    preFiltrados.slice(
                        0,
                        max
                    );
            }

        } else {

            selecionados =
                preFiltrados.slice(
                    0,
                    max
                );
        }


        /*
         * =====================================================
         * ETAPA 5
         * Garantia final
         * =====================================================
         */

        if (
            !selecionados ||
            selecionados.length === 0
        ) {

            console.log(
                '⚠️ Nenhuma evidência após todas as etapas.'
            );

            /*
             * Último fallback possível.
             */
            return artigos.slice(
                0,
                max
            );
        }


        /*
         * Remove duplicados novamente.
         */
        const resultadoFinal =
            Array.from(
                new Map(
                    selecionados.map(
                        artigo => [
                            artigo.id,
                            artigo
                        ]
                    )
                ).values()
            ).slice(0, max);


        console.log(
            `\n✓ ${resultadoFinal.length} artigos finais selecionados.`
        );

        console.log(
            '\nARTIGOS FINAIS:'
        );

        resultadoFinal.forEach(
            (artigo, index) => {

                console.log(
                    `${index + 1}. ${artigo.titulo}`
                );

                console.log(
                    `   PMID: ${artigo.id}`
                );

                console.log(
                    `   URL: ${artigo.url}`
                );
            }
        );


        /*
         * O validar.js e a rota /verify esperam
         * um ARRAY.
         */
        return resultadoFinal;

    } catch (erro) {

        console.error(
            '❌ Erro geral no searchPubMed:',
            erro
        );

        /*
         * Nunca deixar undefined chegar
         * ao classificarComGroq().
         */
        return [];
    }
}


/* =========================================================
 * EXPORTS
 * ========================================================= */

module.exports = {

    searchPubMed,

    /*
     * Exportamos também algumas funções para facilitar
     * testes unitários futuros.
     */
    simplificarQuery,

    gerarQueryBiomedica,

    gerarQueryAmpla,

    selecionarMaisRelevantes
};