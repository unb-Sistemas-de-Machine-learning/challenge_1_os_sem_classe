import pytest
from medfact.server_ml.app.db.database import save_cache, get_cache, log_inference, get_database_stats
from medfact.server_ml.app.db.vector_store import pubmed_vector_store
from medfact.server_ml.app.services.synthesizer import synthesizer
from medfact.server_ml.app.services.ml_engine import ml_engine
from medfact.server_ml.app.services.pubmed_service import pubmed_service

def test_cache_save_and_retrieve():
    save_cache("teste-hash-123", "texto teste", {"origem": "camada_2", "classificacao": "verdadeira"}, "camada_2")
    cached = get_cache("teste-hash-123")
    assert cached is not None
    assert cached["origem"] == "camada_2"
    assert cached["classificacao"] == "verdadeira"

def test_log_inference():
    log_id = log_inference(
        input_text="Teste de inferência",
        detected_topic="vacinação",
        veracity="falsa",
        risk="alto",
        probability=90,
        latency_ms=12.5,
        model_version="v2.0",
        evidence_count=2,
        layer="camada_2"
    )
    assert log_id is not None
    assert len(log_id) > 10

def test_add_article_and_vector_reload():
    sucesso = pubmed_vector_store.add_article(
        pmid="99999999",
        title="Estudo Teste de Eficácia Vacinal em População Idosa",
        journal="Revista Teste",
        pub_date="2026",
        abstract="Resumo de teste de vacina para teste de cobertura de código.",
        url="https://pubmed.ncbi.nlm.nih.gov/99999999/",
        topic="vacinação"
    )
    assert sucesso is True
    res = pubmed_vector_store.search("Eficácia vacinal idosa", topic="vacinação")
    assert len(res) > 0

@pytest.mark.asyncio
async def test_synthesizer_all_veracities():
    t_falsa = await synthesizer.gerar_explicacao("vacina gripe", "falsa", "vacinação", "alto", "alegação sem evidência", [])
    assert "não é verdadeira" in t_falsa or "muito segura" in t_falsa
    
    t_verdadeira = await synthesizer.gerar_explicacao("caminhada e dieta", "verdadeira", "doenças crônicas", "baixo", "informação verificada", [])
    assert len(t_verdadeira) > 20

    t_enganosa = await synthesizer.gerar_explicacao("cha milagroso", "enganosa", "COVID-19", "médio", "exagero", [])
    assert len(t_enganosa) > 20

    t_unproven = await synthesizer.gerar_explicacao("algo aleatorio", "não verificável", "saúde", "médio", "alegação sem evidência", [])
    assert len(t_unproven) > 20

def test_ml_engine_various_scenarios():
    res1 = ml_engine.analisar_alegacao("Tomar cloroquina previne coronavirus", [])
    assert res1["classificacao"] in ["falsa", "enganosa"]
    assert res1["nivel_risco"] in ["alto", "médio"]

    res2 = ml_engine.analisar_alegacao("Vitamina C em alta dose cura o resfriado", [])
    assert res2["classificacao"] in ["falsa", "enganosa"]

    res3 = ml_engine.analisar_alegacao("Elimina todos os problemas de pressao sem remedio", [])
    assert res3["nivel_risco"] in ["alto", "médio"]

@pytest.mark.asyncio
async def test_pubmed_service_retrieval():
    evs = await pubmed_service.buscar_evidencias("Influenza vaccination Alzheimer risk", topic="vacinação")
    assert len(evs) > 0
    assert "titulo" in evs[0]
    assert "url" in evs[0]
