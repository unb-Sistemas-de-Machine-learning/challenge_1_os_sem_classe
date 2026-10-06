const { criarLimitador } = require('./rateLimiter');
const { avaliarEvidenciaDaClaim } = require('./groq');

const PUBMED_KEY = process.env.PUBMED_API_KEY;
const BASE =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const EMAIL =
    process.env.PUBMED_EMAIL ||
    'medfact@localhost';

const TOOL = 'MedFact';

// O PubMed permite uma taxa maior com API key.
// O limitador local evita rajadas.
const podeChamarPubmed =
    criarLimitador(PUBMED_KEY ? 60 : 3);

const CACHE_TTL =
    1000 * 60 * 60 * 24;

const cacheBuscas = new Map();

function pegarCache(chave) {
    const item = cacheBuscas.get(chave);

    if (!item) {
        return null;
    }

    if (
        Date.now() - item.timestamp >
        CACHE_TTL
    ) {
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
        .replace(
            /&#(\d+);/g,
            (_, codigo) =>
                String.fromCharCode(
                    Number(codigo)
                )
        )
        .replace(
            /&#x([0-9a-f]+);/gi,
            (_, codigo) =>
                String.fromCharCode(
                    parseInt(codigo, 16)
                )
        );
}

const CONCEITOS_MEDICOS = [
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
            '("Influenza, Human"[MeSH Terms] OR influenza OR flu)'
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

    {
        termos: [
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

    {
        termos: [
            'diabetes',
            'diabetes tipo 2',
            'diabetes tipo ii'
        ],
        query:
            '("Diabetes Mellitus, Type 2"[MeSH Terms] OR "type 2 diabetes" OR "type II diabetes")'
    },

    {
        termos: [
            'cancer',
            'câncer',
            'tumor'
        ],
        query:
            '("Neoplasms"[MeSH Terms] OR cancer OR neoplasm OR tumor)'
    },

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

    {
        termos: [
            'resfriado',
            'resfriados',
            'gripe comum',
            'common cold'
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
    },

    {
        termos: [
            'dieta',
            'diet'
        ],
        query:
            '("Diet Therapy"[MeSH Terms] OR diet OR dietary)'
    },

    {
        termos: [
            'remissao',
            'remissão',
            'remission'
        ],
        query:
            '("Remission, Induced"[MeSH Terms] OR remission)'
    },

    {
        termos: [
            'idoso',
            'idosos',
            'older adults',
            'elderly'
        ],
        query:
            '("Aged"[MeSH Terms] OR elderly OR "older adults")'
    },

    {
        termos: [
            'gravidade',
            'grave',
            'severo',
            'severa',
            'severidade',
            'severity'
        ],
        query:
            '("Severity of Illness Index"[MeSH Terms] OR severity OR severe)'
    },

    {
        termos: [
            'transmissao',
            'transmissão',
            'transmission'
        ],
        query:
            '("Disease Transmission, Infectious"[MeSH Terms] OR transmission)'
    },

    {
        termos: [
            'mascara',
            'máscara',
            'mascaras',
            'máscaras',
            'mask',
            'masks'
        ],
        query:
            '("Masks"[MeSH Terms] OR mask OR masks OR face covering)'
    },

    {
        termos: [
            'infertilidade',
            'infertility'
        ],
        query:
            '("Infertility"[MeSH Terms] OR infertility)'
    },

    {
        termos: [
            'fertilidade',
            'fertility'
        ],
        query:
            '("Fertility"[MeSH Terms] OR fertility)'
    },

    {
        termos: [
            'risco',
            'risk'
        ],
        query:
            '("Risk"[MeSH Terms] OR risk OR risk factors)'
    }
];

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
    'causam',
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
    'sobre'
]);

function encontrarConceitos(query) {
    const texto =
        normalizarTexto(query);

    const encontrados = [];

    for (const conceito of CONCEITOS_MEDICOS) {
        if (
            conceito.termos.some(
                termo =>
                    texto.includes(
                        normalizarTexto(termo)
                    )
            )
        ) {
            encontrados.push(conceito);
        }
    }

    return encontrados.filter(
        (conceito, index, array) =>
            array.findIndex(
                item =>
                    item.query === conceito.query
            ) === index
    );
}

function gerarQueryBiomedica(claimText) {
    const conceitos =
        encontrarConceitos(claimText);

    if (conceitos.length > 0) {
        // Mantemos até 6 conceitos para não
        // perder partes importantes da claim.
        return conceitos
            .slice(0, 6)
            .map(item => item.query)
            .join(' AND ');
    }

    return simplificarQuery(claimText);
}

function gerarQueryAmpla(claimText) {
    const conceitos =
        encontrarConceitos(claimText);

    if (conceitos.length === 0) {
        return simplificarQuery(claimText);
    }

    // A busca ampla usa os conceitos principais
    // em OR para recuperar candidatos.
    return conceitos
        .slice(0, 6)
        .map(item => item.query)
        .join(' OR ');
}

function normalizarClaimParaPipeline(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[?!.;,]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function simplificarQuery(query) {
    return normalizarTexto(query)
        .split(/\s+/)
        .filter(Boolean)
        .filter(
            palavra =>
                !STOPWORDS.has(palavra)
        )
        .slice(0, 14)
        .join(' ');
}

function limitarQuery(
    query,
    maxCaracteres = 1200
) {
    if (!query) return '';

    return query.length <= maxCaracteres
        ? query
        : query.slice(0, maxCaracteres);
}

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

async function buscarIds(
    query,
    max = 10
) {
    if (!query || !query.trim()) {
        return [];
    }

    const queryLimitada =
        limitarQuery(query);

    const chave =
        `v3:ids:${queryLimitada}`;

    const cacheado =
        pegarCache(chave);

    if (cacheado !== null) {
        return cacheado;
    }

    const url =
        new URL(
            `${BASE}/esearch.fcgi`
        );

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

    const ids = [
        ...xml.matchAll(
            /<Id>(\d+)<\/Id>/g
        )
    ].map(
        match => match[1]
    );

    const unicos =
        [...new Set(ids)];

    salvarCache(
        chave,
        unicos
    );

    return unicos;
}

async function buscarArtigos(ids) {
    if (!ids || ids.length === 0) {
        return [];
    }

    const idsUnicos =
        [...new Set(ids)]
            .filter(
                id =>
                    /^\d+$/.test(id)
            );

    if (idsUnicos.length === 0) {
        return [];
    }

    const chave =
        `v3:artigos:${idsUnicos.join(',')}`;

    const cacheado =
        pegarCache(chave);

    if (cacheado !== null) {
        return cacheado;
    }

    const url =
        new URL(
            `${BASE}/efetch.fcgi`
        );

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

        artigos.push({
            id,

            titulo:
                limparTextoXML(
                    extrairTag(
                        bloco,
                        'ArticleTitle'
                    )
                ) ||
                'Título não disponível',

            resumo:
                extrairResumo(bloco) ||
                'Resumo não disponível',

            revista:
                limparTextoXML(
                    extrairTag(
                        bloco,
                        'Title'
                    )
                ) ||
                'Revista não informada',

            data:
                extrairDataPublicacao(
                    bloco
                ) || '',

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

function extrairTag(xml, tag) {
    const regex =
        new RegExp(
            `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
            'i'
        );

    const match =
        xml.match(regex);

    return match
        ? match[1]
        : '';
}

function extrairResumo(xml) {
    const bloco =
        xml.match(
            /<Abstract>([\s\S]*?)<\/Abstract>/i
        );

    if (!bloco) {
        return '';
    }

    const partes = [
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
                limparTextoXML(
                    match[2]
                )
            );
        })
        .join(' ');
}

function extrairDataPublicacao(xml) {
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

    const year =
        extrairTag(
            xml,
            'Year'
        );

    return year
        ? limparTextoXML(year)
        : '';
}

function limparTextoXML(texto) {
    if (!texto) {
        return '';
    }

    let resultado =
        escaparXML(texto)
            .replace(
                /<[^>]+>/g,
                ' '
            );

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

function extrairTermosRelevantes(query) {
    const texto =
        normalizarTexto(query);

    return [
        ...new Set(
            texto
                .split(/\s+/)
                .filter(Boolean)
                .filter(
                    termo =>
                        !STOPWORDS.has(termo) &&
                        termo.length >= 4
                )
        )
    ];
}

function selecionarMaisRelevantes(
    artigos,
    query,
    max = 5
) {
    if (
        !artigos ||
        artigos.length === 0
    ) {
        return [];
    }

    const termosQuery =
        extrairTermosRelevantes(
            query
        );

    const conceitos =
        encontrarConceitos(query);

    const termosConceituais = [];

    for (const conceito of conceitos) {
        const termos =
            conceito.query
                .replace(
                    /[()\[\]"]/g,
                    ' '
                )
                .split(
                    /\s+OR\s+|\s+AND\s+/i
                )
                .map(
                    item =>
                        item
                            .replace(
                                /['"]/g,
                                ''
                            )
                            .trim()
                )
                .filter(Boolean);

        termosConceituais.push(
            ...termos
        );
    }

    const termosUnicos =
        [
            ...new Set(
                [
                    ...termosQuery,
                    ...termosConceituais
                ]
                    .map(normalizarTexto)
                    .filter(Boolean)
            )
        ];

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

            let pontuacao = 0;

            for (
                const termo of termosUnicos
            ) {
                if (
                    titulo.includes(
                        termo
                    )
                ) {
                    pontuacao += 4;

                } else if (
                    resumo.includes(
                        termo
                    )
                ) {
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
                `${index + 1}. [${item.pontuacao}] ${item.artigo.titulo}`
            );
        }
    );

    return classificados
        .slice(0, max)
        .map(
            item =>
                item.artigo
        );
}

async function buscarIdsComEstrategias(
    claimText,
    maxPorBusca = 10
) {
    const queryBiomedica =
        gerarQueryBiomedica(
            claimText
        );

    const queryAmpla =
        gerarQueryAmpla(
            claimText
        );

    const querySimplificada =
        simplificarQuery(
            claimText
        );

    const queries = [];

    if (queryBiomedica) {
        queries.push({
            nome: 'biomédica',
            query: queryBiomedica
        });
    }

    if (
        queryAmpla &&
        queryAmpla !== queryBiomedica
    ) {
        queries.push({
            nome: 'ampla',
            query: queryAmpla
        });
    }

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

    const todosIds = [];

    for (
        const estrategia of
        queries.slice(0, 3)
    ) {
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

        todosIds.push(
            ...ids
        );
    }

    return [
        ...new Set(todosIds)
    ];
}

async function searchPubMed(
    query,
    max = 3
) {
    const claimPipeline =
        normalizarClaimParaPipeline(
            query
        );

    console.log(
        `\n🔎 Buscando evidências no PubMed para: "${query}"`
    );

    if (!claimPipeline) {
        return [];
    }

    try {
        const ids =
            await buscarIdsComEstrategias(
                claimPipeline,
                10
            );

        console.log(
            `\n✓ ${ids.length} PMIDs únicos encontrados.`
        );

        if (ids.length === 0) {
            return [];
        }

        const artigos =
            await buscarArtigos(
                ids.slice(0, 20)
            );

        console.log(
            `✓ ${artigos.length} artigos recuperados.`
        );

        if (artigos.length === 0) {
            return [];
        }

        // Mantemos 5 candidatos para a avaliação
        // semântica/evidencial.
        const candidatos =
            selecionarMaisRelevantes(
                artigos,
                claimPipeline,
                Math.max(5, max)
            );

        console.log(
            `✓ ${candidatos.length} artigos pré-selecionados.`
        );

        candidatos.forEach(
            (artigo, index) => {
                console.log(
                    `${index + 1}. ${artigo.titulo}`
                );
            }
        );

        if (
            candidatos.length === 0
        ) {
            return [];
        }

        /*
         * IMPORTANTE:
         *
         * Não usamos mais o fallback lexical quando
         * a avaliação semântica falha ou retorna zero.
         *
         * Isso impede distinguir "artigo relacionado"
         * de "evidência da claim".
         *
         * A avaliação abaixo faz relevância + evidência
         * em uma única chamada da Groq.
         *
         * Isso também reduz o consumo de TPM.
         */
        const evidencias =
            await avaliarEvidenciaDaClaim(
                claimPipeline,
                candidatos,
                max
            );

        console.log(
            `✓ ${evidencias.length} evidências finais.`
        );

        evidencias.forEach(
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

                console.log(
                    `   Tipo: ${artigo.avaliacaoEvidencia}`
                );
            }
        );

        return evidencias;

    } catch (erro) {
        console.error(
            '❌ Erro geral no searchPubMed:',
            erro.message
        );

        return [];
    }
}

module.exports = {
    searchPubMed,
    simplificarQuery,
    gerarQueryBiomedica,
    gerarQueryAmpla,
    selecionarMaisRelevantes,
    normalizarClaimParaPipeline
};