import pytest
from medfact.server_ml.app.db.vector_store import pubmed_vector_store
from medfact.server_ml.app.db.database import get_database_stats

def test_database_stats():
    stats = get_database_stats()
    assert stats["total_articles"] >= 10
    assert "vacinação" in stats["articles_by_topic"]
    assert "COVID-19" in stats["articles_by_topic"]
    assert "doenças crônicas" in stats["articles_by_topic"]

def test_pubmed_vector_search():
    resultados = pubmed_vector_store.search("A vacina da gripe pode causar Alzheimer?", top_k=2)
    assert len(resultados) > 0
    top = resultados[0]
    assert "alzheimer" in top["title"].lower() or "influenza" in top["title"].lower()
    assert top["relevancia_score"] > 0.05
