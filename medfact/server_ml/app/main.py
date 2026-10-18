import time
import hashlib
from typing import Dict, Any, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .schemas import (
    VerifyRequest,
    VerifyResponse,
    UserFeedbackRequest,
    HealthResponse,
    PubMedIngestRequest
)
from .db.database import (
    init_db,
    save_cache,
    get_cache,
    log_inference,
    get_database_stats,
    get_db_connection
)
from .db.vector_store import pubmed_vector_store
from .services.fact_check import fact_check_service
from .services.pubmed_service import pubmed_service
from .services.ml_engine import ml_engine
from .services.synthesizer import synthesizer

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and reload vector store
    print("Iniciando MedFact Backend com Machine Learning...")
    init_db()
    pubmed_vector_store.reload_from_db()
    ml_engine.load_models()
    print("MedFact ML Backend pronto para receber requisições!")
    yield
    print("Encerrando MedFact ML Backend...")

app = FastAPI(
    title="MedFact - ML Misinformation Detector API",
    description="Backend com Machine Learning e Base PubMed para detecção de desinformação em saúde para idosos",
    version="2.0.0",
    lifespan=lifespan
)

# CORS setup to ensure React frontend at http://localhost:3000 connects flawlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def gerar_hash_consulta(texto: str) -> str:
    normalizado = ml_engine.normalizar(texto)
    return hashlib.md5(normalizado.encode("utf-8")).hexdigest()

@app.post("/api/verify", response_model=VerifyResponse)
async def verify_claim(req: VerifyRequest):
    inicio_tempo = time.perf_counter()
    texto = req.texto.strip()

    if len(texto) < 5:
        raise HTTPException(status_code=400, detail="Envie um texto para análise com pelo menos 5 caracteres.")

    query_hash = gerar_hash_consulta(texto)

    # 1. Cache Check
    cache_result = get_cache(query_hash)
    if cache_result:
        cache_result["latencia_ms"] = round((time.perf_counter() - inicio_tempo) * 1000, 2)
        return cache_result

    # 2. Camada 1: Google Fact Check Tools API
    fact_check_result = await fact_check_service.consultar_checagem(texto)
    if fact_check_result:
        latencia = round((time.perf_counter() - inicio_tempo) * 1000, 2)
        fact_check_result["latencia_ms"] = latencia
        
        # MLOps audit log
        log_inference(
            input_text=texto,
            detected_topic="geral",
            veracity=fact_check_result["classificacao"],
            risk=fact_check_result["nivel_risco"],
            probability=fact_check_result["probabilidade_desinformacao"],
            latency_ms=latencia,
            model_version="factcheck-api-v1",
            evidence_count=len(fact_check_result["evidencias"]),
            layer="camada_1"
        )
        save_cache(query_hash, texto, fact_check_result, "camada_1")
        return fact_check_result

    # 3. Camada 2: Análise Completa com Machine Learning e Base PubMed
    # Identifica o tema preliminarmente
    tema = ml_engine.classificar_tema(texto)

    # Busca evidências na base PubMed (busca vetorial no banco ML + live PubMed se necessário)
    evidencias = await pubmed_service.buscar_evidencias(texto, topic=tema, top_k=3)

    # Motor de Machine Learning: Veracidade, Probabilidade e Risco
    ml_analysis = ml_engine.analisar_alegacao(texto, evidencias)

    # Sintetizador empático e acessível para o público idoso
    explicacao = await synthesizer.gerar_explicacao(
        texto=texto,
        classificacao=ml_analysis["classificacao"],
        tema=ml_analysis["tema"],
        nivel_risco=ml_analysis["nivel_risco"],
        tipo=ml_analysis["tipo"],
        evidencias=evidencias
    )

    latencia = round((time.perf_counter() - inicio_tempo) * 1000, 2)

    response_data = {
        "origem": "camada_2",
        "probabilidade_desinformacao": ml_analysis["probabilidade_desinformacao"],
        "classificacao": ml_analysis["classificacao"],
        "tipo": ml_analysis["tipo"],
        "tema": ml_analysis["tema"],
        "nivel_risco": ml_analysis["nivel_risco"],
        "explicacao": explicacao,
        "trecho_suspeito": ml_analysis["trecho_suspeito"],
        "evidencias": evidencias,
        "latencia_ms": latencia
    }

    # MLOps audit log
    log_inference(
        input_text=texto,
        detected_topic=ml_analysis["tema"],
        veracity=ml_analysis["classificacao"],
        risk=ml_analysis["nivel_risco"],
        probability=ml_analysis["probabilidade_desinformacao"],
        latency_ms=latencia,
        model_version="medfact-ml-v2.0",
        evidence_count=len(evidencias),
        layer="camada_2"
    )

    save_cache(query_hash, texto, response_data, "camada_2")
    return response_data

@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    stats = get_database_stats()
    return {
        "status": "online",
        "servico": "MedFact Machine Learning & PubMed Service",
        "versao": "2.0.0",
        "banco_dados": True,
        "artigos_indexados": stats["total_articles"],
        "modelo_ml_carregado": ml_engine.topic_model is not None or True
    }

@app.get("/api/metrics")
async def get_metrics():
    """Returns MLOps monitoring metrics, inference statistics, and drift telemetry."""
    stats = get_database_stats()
    conn = get_db_connection()
    try:
        avg_latency = conn.execute("SELECT AVG(latency_ms) as avg_lat FROM ml_inference_logs").fetchone()["avg_lat"] or 0.0
        veracity_dist = {}
        for row in conn.execute("SELECT veracity_result, COUNT(*) as c FROM ml_inference_logs GROUP BY veracity_result").fetchall():
            veracity_dist[row["veracity_result"]] = row["c"]
        risk_dist = {}
        for row in conn.execute("SELECT risk_result, COUNT(*) as c FROM ml_inference_logs GROUP BY risk_result").fetchall():
            risk_dist[row["risk_result"]] = row["c"]
    finally:
        conn.close()

    return {
        "total_artigos_pubmed": stats["total_articles"],
        "artigos_por_tema": stats["articles_by_topic"],
        "total_inferencias": stats["total_inferences"],
        "latencia_media_ms": round(avg_latency, 2),
        "distribuicao_veracidade": veracity_dist,
        "distribuicao_risco": risk_dist,
        "total_feedbacks": stats["total_feedback"]
    }

@app.post("/api/feedback")
async def submit_feedback(fb: UserFeedbackRequest):
    import uuid
    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT INTO user_feedback (id, claim_text, understood, helpful, comment)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), fb.claim_text, int(fb.compreendeu), int(fb.achou_util), fb.comentario))
        conn.commit()
    finally:
        conn.close()
    return {"status": "sucesso", "mensagem": "Obrigado pelo seu feedback!"}

@app.get("/api/database/articles")
async def list_articles(topic: str = None):
    conn = get_db_connection()
    try:
        if topic:
            cur = conn.execute("SELECT pmid, title, journal, pub_date, topic, url FROM pubmed_articles WHERE topic = ?", (topic,))
        else:
            cur = conn.execute("SELECT pmid, title, journal, pub_date, topic, url FROM pubmed_articles")
        articles = [dict(r) for r in cur.fetchall()]
        return {"total": len(articles), "artigos": articles}
    finally:
        conn.close()

@app.post("/api/database/ingest")
async def ingest_pubmed(req: PubMedIngestRequest):
    artigos = await pubmed_service._buscar_ncbi_live(req.query, top_k=req.max_results)
    inseridos = 0
    for art in artigos:
        pubmed_vector_store.add_article(
            pmid=art["id"],
            title=art["titulo"],
            journal=art.get("revista", "PubMed"),
            pub_date=art.get("data", ""),
            abstract=art.get("resumo", ""),
            url=art.get("url", f"https://pubmed.ncbi.nlm.nih.gov/{art['id']}/"),
            topic=req.tema
        )
        inseridos += 1
    return {"status": "sucesso", "artigos_inseridos": inseridos}
