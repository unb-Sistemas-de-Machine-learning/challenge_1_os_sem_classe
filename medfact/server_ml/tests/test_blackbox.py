"""
Black-Box (Caixa Preta) Test Suite for MedFact ML Backend.
Focuses on specification-based testing, equivalence partitioning,
boundary value analysis (BVA), and API contract verification.
No knowledge of internal implementation is assumed.
"""
import pytest
from fastapi.testclient import TestClient
from medfact.server_ml.app.main import app

client = TestClient(app)

# ============================================================================
# 1. BOUNDARY VALUE ANALYSIS (BVA) & EQUIVALENCE PARTITIONING: /api/verify
# ============================================================================

def test_bva_below_minimum_length_rejected():
    """Boundary Value Analysis: Texts with < 5 characters must return HTTP 422."""
    # Test boundary -1 (4 characters)
    res_4 = client.post("/api/verify", json={"texto": "cura"})
    assert res_4.status_code == 422

    # Test boundary: 1 character
    res_1 = client.post("/api/verify", json={"texto": "a"})
    assert res_1.status_code == 422

    # Test boundary: empty string
    res_0 = client.post("/api/verify", json={"texto": ""})
    assert res_0.status_code == 422


def test_bva_exact_minimum_length_accepted():
    """Boundary Value Analysis: Text with exactly 5 characters must be accepted (HTTP 200)."""
    res = client.post("/api/verify", json={"texto": "gripe"})
    assert res.status_code == 200
    data = res.json()
    assert "classificacao" in data
    assert "nivel_risco" in data


def test_bva_large_input_payload():
    """Boundary Value Analysis: Large paragraph (1000+ characters) is processed safely."""
    long_claim = "Dizem que a vacina da gripe aplicada em postos de saúde de todo o Brasil " * 15
    res = client.post("/api/verify", json={"texto": long_claim})
    assert res.status_code == 200
    data = res.json()
    assert data["origem"] in ["camada_1", "camada_2"]


def test_equivalence_partitioning_special_characters_and_punctuation():
    """Equivalence Partitioning: Handles questions with punctuation, question marks, quotes and accents."""
    query = '"""A vacina da gripe (H1N1) é 100% segura para idosos??? @#$*"""'
    res = client.post("/api/verify", json={"texto": query})
    assert res.status_code == 200
    data = res.json()
    assert data["classificacao"] in ["verdadeira", "falsa", "enganosa", "não verificável"]


# ============================================================================
# 2. SCHEMA & CONTRACT VERIFICATION
# ============================================================================

def test_verify_response_schema_contract():
    """Validates that /api/verify adheres strictly to the VerifyResponse schema."""
    res = client.post(
        "/api/verify",
        json={"texto": "Vitamina C em altas doses cura o coronavírus em 24 horas?"}
    )
    assert res.status_code == 200
    data = res.json()

    # Required contract fields
    assert "classificacao" in data
    assert "probabilidade_desinformacao" in data
    assert "tipo" in data
    assert "nivel_risco" in data
    assert "explicacao" in data
    assert "origem" in data
    assert "evidencias" in data
    assert "tema" in data
    assert "latencia_ms" in data

    # Type & value domain validation
    assert data["classificacao"] in ["verdadeira", "falsa", "enganosa", "não verificável"]
    assert data["nivel_risco"] in ["baixo", "médio", "alto"]
    assert 0 <= data["probabilidade_desinformacao"] <= 100
    assert data["origem"] in ["camada_1", "camada_2"]
    assert isinstance(data["evidencias"], list)
    assert isinstance(data["latencia_ms"], (int, float))
    assert data["latencia_ms"] >= 0


def test_verify_three_thematic_domains():
    """Equivalence Partitioning: Validates claims for each of the three focal domains."""
    domains = [
        ("A vacina de COVID-19 altera o DNA humano", "vacinação"),
        ("O uso de máscaras reduz a transmissão do coronavírus", "COVID-19"),
        ("Água com limão em jejum cura diabetes e câncer", "doenças crônicas")
    ]

    for claim, expected_topic in domains:
        res = client.post("/api/verify", json={"texto": claim})
        assert res.status_code == 200
        data = res.json()
        assert data["tema"] == expected_topic


# ============================================================================
# 3. BLACK-BOX CACHE BEHAVIOR
# ============================================================================

def test_cache_hit_decreases_latency():
    """Black-box test: An identical query is served from cache with sub-100ms latency."""
    query = "Exercícios leves ajudam no controle da pressão arterial em idosos"
    
    # First query (populates cache)
    res1 = client.post("/api/verify", json={"texto": query})
    assert res1.status_code == 200

    # Second query (served from cache)
    res2 = client.post("/api/verify", json={"texto": query})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["latencia_ms"] < 100.0  # Cached requests are near-instant


# ============================================================================
# 4. SYSTEM HEALTH, METRICS & FEEDBACK CONTRACTS
# ============================================================================

def test_health_check_contract():
    """Black-box test for /api/health and /health endpoints."""
    for path in ["/api/health", "/health"]:
        res = client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "online"
        assert data["banco_dados"] is True
        assert data["artigos_indexados"] >= 0
        assert data["modelo_ml_carregado"] is True


def test_metrics_endpoint_telemetry_contract():
    """Black-box test for /api/metrics telemetry."""
    res = client.get("/api/metrics")
    assert res.status_code == 200
    data = res.json()
    assert "total_artigos_pubmed" in data
    assert "artigos_por_tema" in data
    assert "total_inferencias" in data
    assert "latencia_media_ms" in data
    assert "distribuicao_veracidade" in data
    assert "distribuicao_risco" in data
    assert "total_feedbacks" in data
    assert isinstance(data["total_inferencias"], int)


def test_feedback_endpoint_boundary_validation():
    """Black-box test for /api/feedback: Valid and Invalid payloads."""
    # Valid feedback
    res_valid = client.post("/api/feedback", json={
        "claim_text": "A vacina da gripe é recomendada para idosos",
        "compreendeu": True,
        "achou_util": True,
        "comentario": "Explicação muito didática para idosos"
    })
    assert res_valid.status_code == 200
    assert res_valid.json()["status"] == "sucesso"

    # Invalid feedback: missing required booleans
    res_invalid = client.post("/api/feedback", json={
        "claim_text": "Vacina"
    })
    assert res_invalid.status_code == 422


def test_list_articles_endpoint():
    """Black-box test for /api/database/articles."""
    res = client.get("/api/database/articles")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "artigos" in data
    assert isinstance(data["artigos"], list)
    if data["total"] > 0:
        art = data["artigos"][0]
        assert "pmid" in art
        assert "title" in art
        assert "journal" in art
        assert "topic" in art
