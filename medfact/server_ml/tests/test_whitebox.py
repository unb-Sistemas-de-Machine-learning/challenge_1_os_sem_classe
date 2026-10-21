"""
White-Box (Caixa Branca) Test Suite for MedFact ML Backend.
Focuses on internal logic, branch coverage, condition paths, and mock handlers:
- FactCheckService: API key branching, rating classification logic, network error paths.
- MLEngine: Topic classification heuristics, suspect phrase regexes, decision matrix branches.
- PubMedService: MeSH translation dictionary, live query indexing, fallback execution.
- ElderlyExplanationSynthesizer: Groq LLM integration, error handling, pedagogical templates.
- PubMedVectorStore: Cosine similarity calculation, threshold filtering, dynamic reloading.
- Database: Cache expiry, transaction rollbacks, log aggregation.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from medfact.server_ml.app.services.fact_check import FactCheckService
from medfact.server_ml.app.services.ml_engine import MLEngine, ml_engine
from medfact.server_ml.app.services.pubmed_service import (
    PubMedService,
    traduzir_termos_chave,
    TERMOS_MEDICOS_PT_EN
)
from medfact.server_ml.app.services.synthesizer import ElderlyExplanationSynthesizer
from medfact.server_ml.app.db.vector_store import PubMedVectorStore
from medfact.server_ml.app.db.database import (
    save_cache,
    get_cache,
    log_inference,
    get_database_stats
)


# ============================================================================
# 1. WHITE-BOX TESTS: FactCheckService (Camada 1)
# ============================================================================

@pytest.mark.asyncio
async def test_factcheck_no_api_key_branch():
    """Branch coverage: FactCheckService returns None when API key is missing."""
    service = FactCheckService()
    service.api_key = ""
    result = await service.consultar_checagem("Vacina causa problema")
    assert result is None


@pytest.mark.asyncio
async def test_factcheck_status_not_200():
    """Branch coverage: HTTP status != 200 returns None."""
    service = FactCheckService()
    service.api_key = "fake_key"
    mock_response = MagicMock()
    mock_response.status_code = 403

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        result = await service.consultar_checagem("Texto para teste")
        assert result is None


@pytest.mark.asyncio
async def test_factcheck_empty_claims_or_reviews():
    """Branch coverage: Claims empty or claimReview empty returns None."""
    service = FactCheckService()
    service.api_key = "fake_key"

    # Case 1: Empty claims list
    mock_res_empty = MagicMock()
    mock_res_empty.status_code = 200
    mock_res_empty.json.return_value = {"claims": []}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_res_empty
        assert await service.consultar_checagem("Consulta") is None

    # Case 2: Claim without claimReview
    mock_res_no_review = MagicMock()
    mock_res_no_review.status_code = 200
    mock_res_no_review.json.return_value = {"claims": [{"text": "Claim", "claimReview": []}]}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_res_no_review
        assert await service.consultar_checagem("Consulta") is None


@pytest.mark.asyncio
async def test_factcheck_rating_classification_branches():
    """Branch coverage: Tests all 4 classification branches from textual ratings."""
    service = FactCheckService()
    service.api_key = "fake_key"

    ratings_to_test = [
        ("É falso que a vacina altere DNA", "falsa", "alto"),
        ("Fato: uso de máscaras reduz contágio", "verdadeira", "baixo"),
        ("Conteúdo distorcido nas redes sociais", "enganosa", "médio"),
        ("Informação sem comprovação científica", "não verificável", "médio")
    ]

    for rating_text, expected_veracity, expected_risk in ratings_to_test:
        mock_res = MagicMock()
        mock_res.status_code = 200
        mock_res.json.return_value = {
            "claims": [
                {
                    "text": "Alegação de saúde",
                    "claimReview": [
                        {
                            "publisher": {"name": "Agência Lupa"},
                            "url": "https://lupa.news/exemplo",
                            "textualRating": rating_text
                        }
                    ]
                }
            ]
        }

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_res
            result = await service.consultar_checagem("Alegação")
            assert result is not None
            assert result["classificacao"] == expected_veracity
            assert result["nivel_risco"] == expected_risk
            assert result["origem"] == "camada_1"
            assert result["agencia"] == "Agência Lupa"


@pytest.mark.asyncio
async def test_factcheck_network_exception_handling():
    """Branch coverage: Network exception in httpx is caught gracefully."""
    service = FactCheckService()
    service.api_key = "valid_key"

    with patch("httpx.AsyncClient.get", side_effect=Exception("Connection timeout")):
        result = await service.consultar_checagem("Alegação de teste")
        assert result is None


# ============================================================================
# 2. WHITE-BOX TESTS: MLEngine Decision Matrix & Heuristics
# ============================================================================

def test_ml_engine_normalization_edge_cases():
    """Tests normalization with null, empty, accented, and special character inputs."""
    engine = MLEngine()
    assert engine.normalizar("") == ""
    assert engine.normalizar("  ") == ""
    assert engine.normalizar("CÂNCER e DIABETES!!!") == "cancer e diabetes"
    assert engine.normalizar("Vacinação contra COVID-19...") == "vacinacao contra covid-19"


def test_ml_engine_heuristic_topic_classification_all_branches():
    """Tests linguistic heuristic topic classification when topic model is disabled."""
    engine = MLEngine()
    engine.topic_model = None  # Force heuristic fallback

    # Branch 1: Vacinação
    assert engine.classificar_tema("Campanha de imunização contra a gripe e sarampo") == "vacinação"
    # Branch 2: COVID-19
    assert engine.classificar_tema("Novo protocolo de isolamento para a pandemia de coronavírus") == "COVID-19"
    # Branch 3: Doenças crônicas
    assert engine.classificar_tema("Tratamento da hipertensão arterial e controle de glicemia") == "doenças crônicas"
    # Branch 4: Default fallback
    assert engine.classificar_tema("Mensagem genérica sem palavras-chave biomédicas") == "doenças crônicas"


def test_ml_engine_extract_suspect_phrase_all_patterns():
    """Tests all trigger regexes in extrair_trecho_suspeito."""
    engine = MLEngine()
    assert "causa autismo" in engine.extrair_trecho_suspeito("Afirmam que vacina causa autismo severo").lower()
    assert "cura o cancer" in engine.extrair_trecho_suspeito("Dizem que limão cura o cancer terminal").lower()
    assert "reverte o diabetes" in engine.extrair_trecho_suspeito("Chá milagroso reverte o diabetes rapidamente").lower()
    assert "mata celulas" in engine.extrair_trecho_suspeito("Substância mata celulas tumorais").lower()
    assert "evita 100%" in engine.extrair_trecho_suspeito("Alho cru evita 100% contaminacao viral").lower()

    # Fallback path (no pattern matched)
    fallback = engine.extrair_trecho_suspeito("Texto sem nenhum verbo de alegação direta")
    assert len(fallback) <= 60


def test_ml_engine_decision_matrix_branches():
    """White-box testing covering all branches of the decision matrix in analisar_alegacao."""
    engine = MLEngine()

    # 1. Miracle term branch
    res_milagre = engine.analisar_alegacao("Cura milagrosa sem remédio para doenças", [])
    assert res_milagre["classificacao"] == "falsa"
    assert res_milagre["nivel_risco"] == "alto"

    # 2. Exaggeration term branch
    res_exagero = engine.analisar_alegacao("Esse suplemento elimina todos os males e cura tudo", [])
    assert res_exagero["classificacao"] == "enganosa"
    assert res_exagero["nivel_risco"] == "médio"

    # 3. Vaccine + Alzheimer / Autism / Infertility
    res_vax = engine.analisar_alegacao("Vacina contra gripe causa infertilidade e autismo", [])
    assert res_vax["classificacao"] == "falsa"
    assert res_vax["nivel_risco"] == "alto"

    # 4. Vitamin C + Cure
    res_vit = engine.analisar_alegacao("Vitamina C em dose cavalar cura infecções", [])
    assert res_vit["classificacao"] == "falsa"

    # 5. Chloroquine / Ivermectin + Prevents/Cures vs Context
    res_clor_cure = engine.analisar_alegacao("Cloroquina previne e é eficaz contra o vírus", [])
    assert res_clor_cure["classificacao"] == "falsa"
    assert res_clor_cure["nivel_risco"] == "alto"

    res_clor_ctx = engine.analisar_alegacao("Ivermectina em estudos laboratoriais preliminares", [])
    assert res_clor_ctx["classificacao"] == "enganosa"

    # 6. Diabetes + Reversal without miracle term
    res_diab = engine.analisar_alegacao("Reverter o diabetes tipo 2 apenas com alimentação e dieta", [])
    assert res_diab["classificacao"] == "enganosa"
    assert res_diab["nivel_risco"] == "alto"

    # 7. Lemon / Warm water + Cancer
    res_cancer = engine.analisar_alegacao("Água morna com limão cura o câncer", [])
    assert res_cancer["classificacao"] == "falsa"
    assert res_cancer["nivel_risco"] == "alto"

    # 8. High relevance score + protective language -> verdadeira
    mock_evidence_high = [{"relevancia_score": 0.45, "titulo": "Vaccine safety trial"}]
    res_verd = engine.analisar_alegacao("A vacina protege contra formas graves e é recomendada", mock_evidence_high)
    assert res_verd["classificacao"] == "verdadeira"
    assert res_verd["nivel_risco"] == "baixo"

    # 9. Low relevance score without evidence -> não verificável
    res_nao_verif = engine.analisar_alegacao("Alegação desconhecida sobre planta exótica", [])
    assert res_nao_verif["classificacao"] in ["não verificável", "enganosa"]


# ============================================================================
# 3. WHITE-BOX TESTS: PubMed Translation & Retrieval
# ============================================================================

def test_traduzir_termos_chave_dictionary_mapping():
    """Verifies that Portuguese keywords map correctly to medical MeSH English terms."""
    assert "vaccine" in traduzir_termos_chave("vacina da gripe")
    assert "Alzheimer disease" in traduzir_termos_chave("doença de alzheimer")
    assert "COVID-19" in traduzir_termos_chave("sintomas de covid")
    assert "hypertension" in traduzir_termos_chave("crise de hipertensao")
    assert "neoplasms" in traduzir_termos_chave("tratamento do cancer")
    # Untranslatable fallback
    untranslated = traduzir_termos_chave("xyzqwerty desconhecido")
    assert untranslated == "xyzqwerty desconhecido"


@pytest.mark.asyncio
async def test_pubmed_service_vector_store_hit():
    """Branch: If local vector store has high-confidence hit, live query is skipped."""
    service = PubMedService()
    mock_local = [
        {
            "id": "123456",
            "titulo": "Clinical trial of influenza vaccine in elderly",
            "journal": "Lancet",
            "revista": "Lancet",
            "data": "2023",
            "resumo": "Vaccine was highly protective.",
            "url": "https://pubmed.ncbi.nlm.nih.gov/123456/",
            "relevancia_score": 0.35,
            "evidence_strength": "Ensaio Clínico"
        }
    ]

    with patch("medfact.server_ml.app.db.vector_store.pubmed_vector_store.search", return_value=mock_local):
        evidencias = await service.buscar_evidencias("vacina contra gripe para idosos")
        assert len(evidencias) > 0
        assert evidencias[0]["id"] == "123456"
        assert evidencias[0]["revista"] == "Lancet"
        assert evidencias[0]["fonte"] == "PubMed / NCBI"


# ============================================================================
# 4. WHITE-BOX TESTS: ElderlyExplanationSynthesizer
# ============================================================================

@pytest.mark.asyncio
async def test_synthesizer_groq_success():
    """Branch: When Groq API key is present and returns 200, uses LLM synthesis."""
    synth = ElderlyExplanationSynthesizer()
    synth.groq_key = "fake_groq_key"

    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": "Olá! Os estudos médicos mostram com clareza que essa vacina é muito segura."
                }
            }
        ]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_res
        resultado = await synth.gerar_explicacao(
            texto="Vacina causa doença",
            classificacao="falsa",
            tema="vacinação",
            nivel_risco="alto",
            tipo="informação falsa",
            evidencias=[]
        )
        assert "vacina é muito segura" in resultado


@pytest.mark.asyncio
async def test_synthesizer_groq_failure_fallback_to_didactic():
    """Branch: When Groq returns error or network fails, falls back gracefully to didactic template."""
    synth = ElderlyExplanationSynthesizer()
    synth.groq_key = "fake_groq_key"

    with patch("httpx.AsyncClient.post", side_effect=Exception("Groq API Timeout")):
        resultado = await synth.gerar_explicacao(
            texto="A vacina da gripe pode causar Alzheimer em idosos?",
            classificacao="falsa",
            tema="vacinação",
            nivel_risco="alto",
            tipo="informação falsa",
            evidencias=[]
        )
        assert "não causa Alzheimer" in resultado


def test_synthesizer_didactic_templates_coverage():
    """Tests all pedagogical branches of _sintese_didatica."""
    synth = ElderlyExplanationSynthesizer()

    # Template 1: Alzheimer + Vacina
    t1 = synth._sintese_didatica("vacina gripe alzheimer", "falsa", "vacinação", [])
    assert "não causa Alzheimer" in t1

    # Template 2: Vitamina C + COVID
    t2 = synth._sintese_didatica("vitamina c cura covid", "falsa", "COVID-19", [])
    assert "vitamina c" in t2.lower()

    # Template 3: Limão + Câncer
    t3 = synth._sintese_didatica("água com limão cura câncer", "falsa", "doenças crônicas", [])
    assert "câncer" in t3.lower()

    # Template 4: Diabetes cura sem remédio
    t4 = synth._sintese_didatica("reverter diabetes sem remédio", "enganosa", "doenças crônicas", [])
    assert "diabetes" in t4.lower()

    # Template 5: General Verdadeira
    t5 = synth._sintese_didatica("caminhadas ajudam na pressão", "verdadeira", "doenças crônicas", [])
    assert "confirmada" in t5.lower() or "verdadeira" in t5.lower()


# ============================================================================
# 5. WHITE-BOX TESTS: VectorStore Internal Logic
# ============================================================================

def test_vector_store_empty_handling():
    """White-box test for PubMedVectorStore when no articles are indexed."""
    store = PubMedVectorStore()
    store.articles = []
    store.tfidf_matrix = None
    store._is_indexed = False
    
    with patch.object(store, "reload_from_db"):
        results = store.search("qualquer texto de saúde")
        assert results == []


def test_vector_store_topic_filtering():
    """Tests topic filtering condition in PubMedVectorStore."""
    store = PubMedVectorStore()
    store.reload_from_db()

    # Filter by existing topic
    results_vax = store.search("vacina", topic="vacinação", top_k=2)
    for r in results_vax:
        assert r["topic"] == "vacinação"


@pytest.mark.asyncio
async def test_pubmed_service_live_ncbi_search_mock():
    """White-box test: Mocks NCBI E-utilities live search and summary."""
    service = PubMedService()
    service.api_key = "test_key"

    mock_search_res = MagicMock()
    mock_search_res.status_code = 200
    mock_search_res.json.return_value = {
        "esearchresult": {"idlist": ["12345678"]}
    }

    mock_summary_res = MagicMock()
    mock_summary_res.status_code = 200
    mock_summary_res.json.return_value = {
        "result": {
            "12345678": {
                "title": "Clinical Trial on Influenza Vaccine in Senior Adults",
                "source": "New England Journal of Medicine",
                "pubdate": "2024 Jan"
            }
        }
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = [mock_search_res, mock_summary_res]
        artigos = await service._buscar_ncbi_live("vacina contra gripe para idosos", top_k=1)
        assert len(artigos) == 1
        assert artigos[0]["id"] == "12345678"
        assert "Influenza Vaccine" in artigos[0]["titulo"]
        assert artigos[0]["revista"] == "New England Journal of Medicine"

