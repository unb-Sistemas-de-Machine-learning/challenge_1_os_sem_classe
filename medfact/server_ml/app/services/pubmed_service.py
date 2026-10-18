import re
import urllib.parse
from typing import List, Dict, Any, Optional
import httpx
from ..config import settings
from ..db.vector_store import pubmed_vector_store

# Medical dictionary mapping Portuguese common terms to PubMed English MeSH terms
TERMOS_MEDICOS_PT_EN = {
    "vacina": "vaccine",
    "vacinas": "vaccines",
    "vacinacao": "vaccination",
    "gripe": "influenza",
    "alzheimer": "Alzheimer disease",
    "covid": "COVID-19",
    "coronavirus": "SARS-CoV-2",
    "vitamina c": "ascorbic acid",
    "diabetes": "diabetes mellitus type 2",
    "cancer": "neoplasms",
    "hipertensao": "hypertension",
    "pressao alta": "blood pressure",
    "limao": "lemon Citrus limon",
    "mascara": "masks",
    "cloroquina": "hydroxychloroquine",
    "ivermectina": "ivermectin",
    "autismo": "autism spectrum disorder",
    "infertilidade": "fertility",
    "cura": "cure",
    "reversao": "remission"
}

def traduzir_termos_chave(texto: str) -> str:
    """Translates Portuguese health keywords into English for PubMed query."""
    t = texto.lower()
    t = re.sub(r"[^\w\s-]", " ", t)
    termos_encontrados = []
    
    for pt, en in TERMOS_MEDICOS_PT_EN.items():
        if pt in t:
            termos_encontrados.append(en)
            
    if termos_encontrados:
        return " AND ".join(termos_encontrados[:4])
    return texto

class PubMedService:
    def __init__(self):
        self.base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
        self.api_key = settings.PUBMED_API_KEY
        self.email = settings.PUBMED_EMAIL

    async def buscar_evidencias(self, claim_text: str, topic: Optional[str] = None, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieves PubMed evidence for a given health claim.
        1. Checks local PubMed Vector Store.
        2. If insufficient or requested, queries live NCBI E-utilities and indexes results.
        """
        # Step 1: Query local vector store (sub-5ms)
        locais = pubmed_vector_store.search(claim_text, topic=topic, top_k=top_k)
        if locais and len(locais) > 0 and locais[0].get("relevancia_score", 0) >= 0.12:
            return self._formatar_evidencias(locais)

        # Step 2: Live NCBI Query if vector store score is low and network is available
        try:
            live_artigos = await self._buscar_ncbi_live(claim_text, top_k=top_k)
            if live_artigos:
                # Dynamically index into local vector store for future queries
                for art in live_artigos:
                    pubmed_vector_store.add_article(
                        pmid=art["id"],
                        title=art["titulo"],
                        journal=art.get("revista", "PubMed"),
                        pub_date=art.get("data", ""),
                        abstract=art.get("resumo", ""),
                        url=art.get("url", f"https://pubmed.ncbi.nlm.nih.gov/{art['id']}/"),
                        topic=topic or "saúde",
                        evidence_strength="Estudo Científico"
                    )
                # Re-search after indexing
                locais = pubmed_vector_store.search(claim_text, topic=topic, top_k=top_k)
                if locais:
                    return self._formatar_evidencias(locais)
                return live_artigos
        except Exception as e:
            print(f"Aviso ao consultar NCBI PubMed ao vivo: {e}")

        # Fallback to whatever local results we had
        return self._formatar_evidencias(locais)

    async def _buscar_ncbi_live(self, claim_text: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Queries NCBI E-utilities (esearch.fcgi and esummary.fcgi)."""
        query_en = traduzir_termos_chave(claim_text)
        params = {
            "db": "pubmed",
            "term": query_en,
            "retmode": "json",
            "retmax": str(top_k),
            "email": self.email,
            "tool": "MedFact"
        }
        if self.api_key:
            params["api_key"] = self.api_key

        async with httpx.AsyncClient(timeout=8.0) as client:
            search_res = await client.get(f"{self.base_url}/esearch.fcgi", params=params)
            if search_res.status_code != 200:
                return []
            
            data = search_res.json()
            id_list = data.get("esearchresult", {}).get("idlist", [])
            if not id_list:
                return []

            summary_params = {
                "db": "pubmed",
                "id": ",".join(id_list),
                "retmode": "json",
                "email": self.email,
                "tool": "MedFact"
            }
            if self.api_key:
                summary_params["api_key"] = self.api_key

            summary_res = await client.get(f"{self.base_url}/esummary.fcgi", params=summary_params)
            if summary_res.status_code != 200:
                return []

            sum_data = summary_res.json().get("result", {})
            artigos = []
            for pmid in id_list:
                doc = sum_data.get(pmid)
                if doc:
                    artigos.append({
                        "id": pmid,
                        "titulo": doc.get("title", "Estudo Científico"),
                        "revista": doc.get("source", "PubMed Journal"),
                        "fonte": "PubMed / NCBI",
                        "data": str(doc.get("pubdate", ""))[:4],
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                        "resumo": doc.get("title", ""),
                        "classificacao": "Estudo Científico"
                    })
            return artigos

    def _formatar_evidencias(self, artigos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        evidencias = []
        for art in artigos:
            evidencias.append({
                "id": str(art.get("pmid") or art.get("id")),
                "titulo": art.get("title") or art.get("titulo"),
                "revista": art.get("journal") or art.get("revista") or "Revista Científica",
                "fonte": "PubMed / NCBI",
                "data": str(art.get("pub_date") or art.get("data") or ""),
                "classificacao": art.get("evidence_strength") or art.get("classificacao") or "Estudo Científico",
                "url": art.get("url") or f"https://pubmed.ncbi.nlm.nih.gov/{art.get('pmid')}/",
                "resumo": art.get("abstract") or art.get("resumo") or "",
                "relevancia_score": art.get("relevancia_score")
            })
        return evidencias

pubmed_service = PubMedService()
