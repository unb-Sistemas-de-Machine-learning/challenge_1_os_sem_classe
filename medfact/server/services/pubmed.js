const { criarLimitador } = require('./rateLimiter');
<<<<<<< HEAD
const { filtrarRelevancia } = require('./groq');

const PUBMED_KEY = process.env.PUBMED_API_KEY;

const BASE =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const podeChamarPubmed = criarLimitador(60);

/*
 * E04b:
 *
 * true  = PubMed + ranking + filtro semântico da Groq
 * false = PubMed + ranking por palavra-chave
 *
 * Para o experimento E06, mantemos o filtro ativado,
 * pois o E06 deve ser comparado ao melhor estado atual
 * E04a + E04b + E05.
 */
const USAR_FILTRO_RELEVANCIA = true;


async function searchPubMed(query, max = 3) {
    console.log(
        `\n🔎 Buscando evidências no PubMed para: "${query}"`
    );

    /*
     * Buscamos até 10 candidatos.
     * Depois fazemos o ranking e selecionamos os melhores.
     */
    let ids = await buscarIds(query, 10);

    if (ids.length === 0) {
        const querySimplificada =
            simplificarQuery(query);

        console.log(
            '⚠️ Nenhum resultado para a busca original.'
        );

        console.log(
            `→ Nova busca: ${querySimplificada}`
        );

        ids = await buscarIds(
            querySimplificada,
            10
        );
    }

    if (ids.length === 0) {
        console.log(
            '⚠️ PubMed não encontrou artigos.'
        );

        return [];
    }

    console.log(
        `✓ ${ids.length} candidatos encontrados.`
    );

    const artigos = await buscarArtigos(ids);

    if (artigos.length === 0) {
        console.log(
            '⚠️ Não foi possível recuperar os artigos.'
        );

        return [];
    }

    /*
     * E03 / E04a:
     *
     * Ranking lexical.
     *
     * Selecionamos 5 candidatos para que o filtro semântico
     * tenha mais opções antes de escolher os 3 finais.
     */
    const preFiltrados =
        selecionarMaisRelevantes(
            artigos,
            query,
            5
        );

    console.log(
        `✓ ${preFiltrados.length} artigos ` +
        `pré-selecionados por palavra-chave.`
    );

    let selecionados;

    if (USAR_FILTRO_RELEVANCIA) {
        /*
         * E04b:
         *
         * A Groq verifica se os artigos são semanticamente
         * relevantes para a afirmação.
         */
        selecionados =
            await filtrarRelevancia(
                query,
                preFiltrados,
                max
            );

        console.log(
            `✓ ${selecionados.length} artigos ` +
            `confirmados como relevantes pela Groq.`
        );
    } else {
        /*
         * E04a:
         *
         * Sem filtro semântico.
         */
        selecionados =
            preFiltrados.slice(0, max);

        console.log(
            `✓ ${selecionados.length} artigos ` +
            `selecionados sem filtro semântico.`
        );
    }

    /*
     * IMPORTANTE:
     *
     * O validar.js espera receber um array.
     * Sem este return, evidencias ficaria undefined
     * e classificarComGroq quebraria no .map().
     */
    return selecionados;
}


/*
 * Consulta os IDs dos artigos.
 *
 * O rate limiter é aplicado por requisição HTTP,
 * e não uma única vez por claim.
 */
async function buscarIds(query, max) {
    if (!podeChamarPubmed()) {
        console.log(
            '⚠️ Limite de taxa do PubMed atingido (ESearch).'
        );

        return [];
    }

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
        data.esearchresult?.idlist ||
        []
    );
}


/*
 * Simplifica a query caso a busca original
 * não encontre resultados.
 */
function simplificarQuery(claim) {
    let texto =
        claim.toLowerCase();

    texto =
        texto.replace(
            /[.,!?;:"'()[\]{}]/g,
            ' '
        );

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
        texto =
            texto.replace(
                new RegExp(
                    `\\b${palavra}\\b`,
                    'gi'
                ),
                ' '
            );
    }

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
                (palavra) =>
                    !stopwords.includes(
                        palavra
                    )
            );

    return palavras
        .slice(0, 12)
        .join(' ');
}


/*
 * Recupera os artigos completos.
 */
async function buscarArtigos(ids) {
    if (!podeChamarPubmed()) {
        console.log(
            '⚠️ Limite de taxa do PubMed atingido (EFetch).'
        );

        return [];
    }

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

    return extrairArtigos(
        xml,
        ids
    );
}


/*
 * Extrai os campos importantes do XML.
 */
function extrairArtigos(xml, ids) {
    const artigos = [];

    const matches = [
        ...xml.matchAll(
            /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi
        ),
    ];

    for (const match of matches) {
        const article = match[1];

        const pmid =
            article.match(
                /<PMID[^>]*>(.*?)<\/PMID>/i
            )?.[1] || '';

        const titulo =
            article.match(
                /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/i
            )?.[1]
            || 'Título não disponível';

        const revista =
            article.match(
                /<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/i
            )?.[1]
            || 'Revista não disponível';

        const abstractMatches = [
            ...article.matchAll(
                /<AbstractText(?:[^>]*)>([\s\S]*?)<\/AbstractText>/gi
            ),
        ];

        const resumo =
            abstractMatches
                .map(
                    (match) => match[1]
                )
                .join(' ')
                .replace(
                    /<[^>]+>/g,
                    ' '
                )
                .replace(
                    /\s+/g,
                    ' '
                )
                .trim();

        const ano =
            article.match(
                /<PubDate>[\s\S]*?<Year>(.*?)<\/Year>/i
            )?.[1] || '';

        const mes =
            article.match(
                /<PubDate>[\s\S]*?<Month>(.*?)<\/Month>/i
            )?.[1] || '';

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

    /*
     * Mantém a ordem dos IDs retornados pelo PubMed.
     */
    return ids
        .map(
            (id) =>
                artigos.find(
                    (artigo) =>
                        artigo.id === id
                )
        )
        .filter(Boolean);
}


/*
 * E03:
 *
 * Ranking simples por correspondência de termos.
 *
 * O ranking não decide relevância científica.
 * Ele apenas reduz os candidatos antes do filtro semântico.
 */
function selecionarMaisRelevantes(
    artigos,
    query,
    max = 3
) {
    const termosQuery =
        extrairTermosRelevantes(query);

    const classificados =
        artigos.map((artigo) => {
            const texto =
                `${artigo.titulo || ''} ` +
                `${artigo.resumo || ''}`
                    .toLowerCase();

            let pontuacao = 0;

            for (const termo of termosQuery) {
                if (
                    texto.includes(termo)
                ) {
                    pontuacao++;
                }
            }

            const titulo =
                (
                    artigo.titulo || ''
                ).toLowerCase();

            for (const termo of termosQuery) {
                if (
                    titulo.includes(termo)
                ) {
                    pontuacao += 2;
                }
            }

            return {
                artigo,
                pontuacao,
            };
        });

    classificados.sort(
        (a, b) =>
            b.pontuacao -
            a.pontuacao
    );

    console.log(
        '\n📊 Ranking por palavra-chave (pré-filtro):'
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
        .map(
            (item) =>
                item.artigo
        );
}


/*
 * Extrai termos úteis para o ranking.
 */
function extrairTermosRelevantes(query) {
    const stopwords = new Set([
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
        'study',
        'studies',
        'research',
        'researchers',
    ]);

    return query
        .toLowerCase()
        .replace(
            /[.,!?;:"'()[\]{}]/g,
            ' '
        )
        .split(/\s+/)
        .filter(Boolean)
        .filter(
            (termo) =>
                !stopwords.has(termo)
        )
        .filter(
            (termo) =>
                termo.length >= 4
        )
        .slice(0, 15);
}


/*
 * Limpeza básica do XML.
 */
function limparXml(texto) {
    return texto
        .replace(
            /&amp;/g,
            '&'
        )
        .replace(
            /&lt;/g,
            '<'
        )
        .replace(
            /&gt;/g,
            '>'
        )
        .replace(
            /&quot;/g,
            '"'
        )
        .replace(
            /&#39;/g,
            "'"
        )
        .replace(
            /\s+/g,
            ' '
        )
        .trim();
}


module.exports = {
    searchPubMed,
};
=======

const PUBMED_KEY = process.env.PUBMED_API_KEY;
const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const podeChamarPubmed = criarLimitador(60); // com API key, o limite é generoso

async function searchPubMed(query, max = 3) {
  if (!podeChamarPubmed()) return [];

  const searchUrl = new URL(`${BASE}/esearch.fcgi`);
  searchUrl.searchParams.set('db', 'pubmed');
  searchUrl.searchParams.set('term', query);
  searchUrl.searchParams.set('retmode', 'json');
  searchUrl.searchParams.set('retmax', max);
  searchUrl.searchParams.set('api_key', PUBMED_KEY);

  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const ids = searchData.esearchresult?.idlist || [];

  if (ids.length === 0) return [];

  const summaryUrl = new URL(`${BASE}/esummary.fcgi`);
  summaryUrl.searchParams.set('db', 'pubmed');
  summaryUrl.searchParams.set('id', ids.join(','));
  summaryUrl.searchParams.set('retmode', 'json');
  summaryUrl.searchParams.set('api_key', PUBMED_KEY);

  const summaryRes = await fetch(summaryUrl);
  const summaryData = await summaryRes.json();

  return ids.map((id) => ({
    titulo: summaryData.result[id].title,
    revista: summaryData.result[id].fulljournalname,
    data: summaryData.result[id].pubdate,
    url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
  }));
}

module.exports = { searchPubMed };
>>>>>>> origin/main
