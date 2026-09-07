const { criarLimitador } = require('./rateLimiter');

const PUBMED_KEY = process.env.PUBMED_API_KEY;

const BASE =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const podeChamarPubmed = criarLimitador(60);


// ======================================================
// BUSCAR ARTIGOS NO PUBMED
// ======================================================

async function searchPubMed(query, max = 3) {

    if (!podeChamarPubmed()) {
        return [];
    }

    // --------------------------------------------------
    // 1. Primeira tentativa: busca original
    // --------------------------------------------------

    let ids = await buscarIds(query, max);

    // --------------------------------------------------
    // 2. Se não encontrou, simplifica a busca
    // --------------------------------------------------

    if (ids.length === 0) {

        const querySimplificada =
            simplificarQuery(query);

        console.log(
            `⚠️ Nenhum resultado para a busca original.`
        );

        console.log(
            `→ Nova busca: ${querySimplificada}`
        );

        ids = await buscarIds(
            querySimplificada,
            max
        );
    }

    // --------------------------------------------------
    // 3. Nenhum resultado
    // --------------------------------------------------

    if (ids.length === 0) {

        console.log(
            '⚠️ PubMed não encontrou artigos.'
        );

        return [];
    }

    console.log(
        `✓ ${ids.length} artigos encontrados.`
    );

    // --------------------------------------------------
    // 4. Buscar artigos completos
    // --------------------------------------------------

    return await buscarArtigos(ids);
}


// ======================================================
// ESEARCH
// ======================================================

async function buscarIds(query, max) {

    const searchUrl =
        new URL(`${BASE}/esearch.fcgi`);

    searchUrl.searchParams.set(
        'db',
        'pubmed'
    );

    searchUrl.searchParams.set(
        'term',
        query
    );

    searchUrl.searchParams.set(
        'retmode',
        'json'
    );

    searchUrl.searchParams.set(
        'retmax',
        max
    );

    if (PUBMED_KEY) {

        searchUrl.searchParams.set(
            'api_key',
            PUBMED_KEY
        );
    }

    const response =
        await fetch(searchUrl);

    if (!response.ok) {

        throw new Error(
            `PubMed ESearch retornou HTTP ${response.status}`
        );
    }

    const data =
        await response.json();

    return (
        data.esearchresult?.idlist || []
    );
}


// ======================================================
// SIMPLIFICAR CLAIM
// ======================================================

function simplificarQuery(claim) {

    let texto = claim.toLowerCase();

    // Remover pontuação
    texto = texto.replace(
        /[.,!?;:"'()[\]{}]/g,
        ' '
    );

    // Remover expressões jornalísticas
    const remover = [

        'review finds',
        'study finds',
        'study shows',
        'study says',
        'research finds',
        'research shows',
        'experts say',
        'experts claim',
        'report says',
        'reports say',
        'according to',
        'new study',
        'new research',
        'scientists say',
        'scientists found',
        'researchers found',
        'researchers say',
    ];

    for (const palavra of remover) {

        texto = texto.replace(
            new RegExp(`\\b${palavra}\\b`, 'gi'),
            ' '
        );
    }

    // Palavras muito comuns que não ajudam
    const stopwords = [

        'the',
        'a',
        'an',
        'and',
        'or',
        'of',
        'to',
        'in',
        'on',
        'for',
        'with',
        'from',
        'by',
        'is',
        'are',
        'was',
        'were',
        'will',
        'would',
        'could',
        'should',
        'has',
        'have',
        'had',
        'be',
        'been',
        'this',
        'that',
        'these',
        'those',
        'it',
        'its',
        'as',
        'than',
        'more',
        'less',
        'very',
        'little',
        'much',
        'can',
        'may',
        'might',
    ];

    const palavras =
        texto
            .split(/\s+/)
            .filter(Boolean)
            .filter(
                palavra =>
                    !stopwords.includes(palavra)
            );

    // Manter no máximo 12 palavras
    return palavras
        .slice(0, 12)
        .join(' ');
}


// ======================================================
// EFETCH
// ======================================================

async function buscarArtigos(ids) {

    const fetchUrl =
        new URL(`${BASE}/efetch.fcgi`);

    fetchUrl.searchParams.set(
        'db',
        'pubmed'
    );

    fetchUrl.searchParams.set(
        'id',
        ids.join(',')
    );

    fetchUrl.searchParams.set(
        'retmode',
        'xml'
    );

    if (PUBMED_KEY) {

        fetchUrl.searchParams.set(
            'api_key',
            PUBMED_KEY
        );
    }

    const response =
        await fetch(fetchUrl);

    if (!response.ok) {

        throw new Error(
            `PubMed EFetch retornou HTTP ${response.status}`
        );
    }

    const xml =
        await response.text();

    return extrairArtigos(xml, ids);
}


// ======================================================
// EXTRAIR ARTIGOS DO XML
// ======================================================

function extrairArtigos(xml, ids) {

    const artigos = [];

    const matches = [
        ...xml.matchAll(
            /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi
        )
    ];

    for (const match of matches) {

        const article = match[1];

        // PMID
        const pmid =
            article.match(
                /<PMID[^>]*>(.*?)<\/PMID>/i
            )?.[1] || '';


        // Título
        const titulo =
            article.match(
                /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/i
            )?.[1]
            || 'Título não disponível';


        // Revista
        const revista =
            article.match(
                /<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/i
            )?.[1]
            || 'Revista não disponível';


        // Abstract
        const abstractMatches = [
            ...article.matchAll(
                /<AbstractText(?:[^>]*)>([\s\S]*?)<\/AbstractText>/gi
            )
        ];

        const resumo =
            abstractMatches
                .map(match => match[1])
                .join(' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();


        // Ano
        const ano =
            article.match(
                /<PubDate>[\s\S]*?<Year>(.*?)<\/Year>/i
            )?.[1]
            || '';


        // Mês
        const mes =
            article.match(
                /<PubDate>[\s\S]*?<Month>(.*?)<\/Month>/i
            )?.[1]
            || '';


        const data =
            ano
                ? `${ano}${mes ? `-${mes}` : ''}`
                : 'Data não disponível';


        artigos.push({

            id: pmid,

            titulo:
                limparXml(titulo),

            revista:
                limparXml(revista),

            data,

            resumo:
                limparXml(resumo)
                || 'Resumo não disponível',

            url:
                `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        });
    }


    // Manter a ordem original
    return ids
        .map(id =>
            artigos.find(
                artigo =>
                    artigo.id === id
            )
        )
        .filter(Boolean);
}


// ======================================================
// LIMPAR XML
// ======================================================

function limparXml(texto) {

    return texto
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {
    searchPubMed,
};