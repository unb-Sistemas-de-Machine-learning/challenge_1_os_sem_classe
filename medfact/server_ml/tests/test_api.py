import pytest
from fastapi.testclient import TestClient
from medfact.server_ml.app.main import app
from medfact.server_ml.app.db.database import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db()

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["banco_dados"] is True
    assert "artigos_indexados" in data

def test_metrics_endpoint():
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "total_artigos_pubmed" in data
    assert "total_inferencias" in data

def test_verify_short_text():
    response = client.post("/api/verify", json={"texto": "abc"})
    assert response.status_code == 422 or response.status_code == 400

def test_verify_alzheimer_vaccine_claim():
    response = client.post("/api/verify", json={"texto": "A vacina da gripe pode causar Alzheimer?"})
    assert response.status_code == 200
    data = response.json()
    assert data["origem"] in ["camada_1", "camada_2"]
    assert "classificacao" in data
    assert "probabilidade_desinformacao" in data
    assert "nivel_risco" in data
    assert "explicacao" in data
    assert len(data["explicacao"]) > 20
    assert "evidencias" in data

def test_verify_lemon_water_cancer_claim():
    response = client.post("/api/verify", json={"texto": "Beber água morna com limão em jejum cura o câncer?"})
    assert response.status_code == 200
    data = response.json()
    assert data["classificacao"] == "falsa"
    assert data["nivel_risco"] == "alto"
    assert data["probabilidade_desinformacao"] >= 80

def test_user_feedback():
    response = client.post("/api/feedback", json={
        "claim_text": "A vacina da gripe pode causar Alzheimer?",
        "compreendeu": True,
        "achou_util": True,
        "comentario": "Explicação muito clara para minha avó!"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "sucesso"

def test_list_articles():
    response = client.get("/api/database/articles")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
