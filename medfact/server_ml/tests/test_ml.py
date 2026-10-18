import pytest
from medfact.server_ml.app.services.ml_engine import ml_engine

def test_topic_classification():
    assert ml_engine.classificar_tema("Vacina contra gripe causa problemas?") == "vacinação"
    assert ml_engine.classificar_tema("O uso de máscaras previne o coronavírus e COVID-19?") == "COVID-19"
    assert ml_engine.classificar_tema("Como controlar diabetes e hipertensão arterial?") == "doenças crônicas"

def test_ml_analysis_miracle_cure():
    analise = ml_engine.analisar_alegacao("Cura definitiva do câncer com receita caseira milagrosa", [])
    assert analise["classificacao"] == "falsa"
    assert analise["nivel_risco"] == "alto"
    assert analise["probabilidade_desinformacao"] >= 85

def test_ml_analysis_diabetes_claim():
    analise = ml_engine.analisar_alegacao("Dá para reverter o diabetes só com dieta, sem remédio?", [])
    assert analise["classificacao"] in ["enganosa", "falsa"]
    assert analise["nivel_risco"] in ["alto", "médio"]
    assert analise["probabilidade_desinformacao"] >= 60

def test_suspicious_phrase_extraction():
    trecho = ml_engine.extrair_trecho_suspeito("Remédio caseiro cura o câncer em três dias")
    assert "cura" in trecho.lower()
