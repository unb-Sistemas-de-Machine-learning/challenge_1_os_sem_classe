import re
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from .database import get_db_connection

class PubMedVectorStore:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=5000,
            sublinear_tf=True
        )
        self.articles: List[Dict[str, Any]] = []
        self.tfidf_matrix = None
        self._is_indexed = False
        self.reload_from_db()

    def _normalize(self, text: str) -> str:
        if not text:
            return ""
        text = text.lower()
        # Keep alphanumeric and accented characters
        text = re.sub(r"[^\w\s-]", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    def reload_from_db(self):
        """Loads all PubMed articles from SQLite and rebuilds the vector index."""
        from .database import init_db
        init_db()
        conn = get_db_connection()
        try:
            cursor = conn.execute("""
                SELECT pmid, title, journal, pub_date, abstract, url, topic, mesh_terms, evidence_strength 
                FROM pubmed_articles
            """)
            rows = cursor.fetchall()
            self.articles = [dict(row) for row in rows]
        finally:
            conn.close()

        if not self.articles:
            self._is_indexed = False
            self.tfidf_matrix = None
            return

        # Prepare corpus for vectorization: title has higher weight (repeated), followed by abstract and mesh terms
        corpus = []
        for a in self.articles:
            combined = f"{a['title']} {a['title']} {a.get('abstract', '')} {a.get('mesh_terms', '')} {a.get('topic', '')}"
            corpus.append(self._normalize(combined))

        self.tfidf_matrix = self.vectorizer.fit_transform(corpus)
        self._is_indexed = True

    def search(
        self,
        query: str,
        topic: Optional[str] = None,
        top_k: int = 3,
        min_similarity: float = 0.08
    ) -> List[Dict[str, Any]]:
        """
        Performs semantic vector search over PubMed articles.
        Returns top_k most relevant articles matching the query.
        """
        if not self._is_indexed or not self.articles or self.tfidf_matrix is None:
            self.reload_from_db()
            if not self._is_indexed:
                return []

        clean_query = self._normalize(query)
        query_vec = self.vectorizer.transform([clean_query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

        # Topic filtering if specified
        results = []
        for idx, score in enumerate(similarities):
            article = self.articles[idx]
            if topic and article.get("topic") and article["topic"].lower() != topic.lower():
                # Allow cross-topic only if score is very high
                if score < 0.25:
                    continue
            
            if score >= min_similarity:
                item = dict(article)
                item["relevancia_score"] = float(round(score, 4))
                results.append(item)

        # Sort descending by relevance score
        results.sort(key=lambda x: x["relevancia_score"], reverse=True)
        return results[:top_k]

    def add_article(
        self,
        pmid: str,
        title: str,
        journal: str,
        pub_date: str,
        abstract: str,
        url: str,
        topic: str,
        mesh_terms: str = "",
        evidence_strength: str = "Estudo Científico"
    ) -> bool:
        """Adds a single article to SQLite and updates the vector store."""
        conn = get_db_connection()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO pubmed_articles 
                (pmid, title, journal, pub_date, abstract, url, topic, mesh_terms, evidence_strength)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (pmid, title, journal, pub_date, abstract, url, topic, mesh_terms, evidence_strength))
            conn.commit()
        finally:
            conn.close()

        # Refresh index
        self.reload_from_db()
        return True

# Singleton instance
pubmed_vector_store = PubMedVectorStore()
