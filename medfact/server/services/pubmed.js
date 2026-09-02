const { criarLimitador } = require('./rateLimiter');

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