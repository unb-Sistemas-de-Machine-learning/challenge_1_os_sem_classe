import sqlite3
import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from ..config import settings

def get_db_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high concurrency
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. PubMed Articles Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pubmed_articles (
        pmid TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        journal TEXT,
        pub_date TEXT,
        abstract TEXT,
        url TEXT,
        topic TEXT NOT NULL,
        mesh_terms TEXT,
        evidence_strength TEXT DEFAULT 'Estudo Científico',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pubmed_topic ON pubmed_articles(topic);")
    
    # 2. Claim Cache Table (Camada 1 & Camada 2 caching)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS claims_cache (
        query_hash TEXT PRIMARY KEY,
        query_text TEXT NOT NULL,
        response_json TEXT NOT NULL,
        layer TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_hash ON claims_cache(query_hash);")
    
    # 3. MLOps Inference Logs (Audit trail, latency, data drift detection)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ml_inference_logs (
        log_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        input_text TEXT NOT NULL,
        input_length INTEGER NOT NULL,
        detected_topic TEXT NOT NULL,
        veracity_result TEXT NOT NULL,
        risk_result TEXT NOT NULL,
        probability INTEGER NOT NULL,
        latency_ms REAL NOT NULL,
        model_version TEXT NOT NULL,
        evidence_count INTEGER NOT NULL,
        layer TEXT NOT NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON ml_inference_logs(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_topic ON ml_inference_logs(detected_topic);")
    
    # 4. User Feedback Table (for tracking elderly usability & comprehension)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_feedback (
        id TEXT PRIMARY KEY,
        claim_text TEXT NOT NULL,
        understood INTEGER NOT NULL,
        helpful INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    conn.commit()
    conn.close()

def log_inference(
    input_text: str,
    detected_topic: str,
    veracity: str,
    risk: str,
    probability: int,
    latency_ms: float,
    model_version: str,
    evidence_count: int,
    layer: str
) -> str:
    log_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection()
    try:
        conn.execute("""
        INSERT INTO ml_inference_logs 
        (log_id, timestamp, input_text, input_length, detected_topic, veracity_result, risk_result, probability, latency_ms, model_version, evidence_count, layer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log_id, now_iso, input_text, len(input_text),
            detected_topic, veracity, risk, probability,
            latency_ms, model_version, evidence_count, layer
        ))
        conn.commit()
    finally:
        conn.close()
    return log_id

def save_cache(query_hash: str, query_text: str, response_dict: Dict[str, Any], layer: str):
    conn = get_db_connection()
    try:
        conn.execute("""
        INSERT OR REPLACE INTO claims_cache (query_hash, query_text, response_json, layer)
        VALUES (?, ?, ?, ?)
        """, (query_hash, query_text, json.dumps(response_dict, ensure_ascii=False), layer))
        conn.commit()
    finally:
        conn.close()

def get_cache(query_hash: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.execute("SELECT response_json FROM claims_cache WHERE query_hash = ?", (query_hash,))
        row = cur.fetchone()
        if row:
            return json.loads(row["response_json"])
    finally:
        conn.close()
    return None

def get_database_stats() -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        total_articles = conn.execute("SELECT COUNT(*) as count FROM pubmed_articles").fetchone()["count"]
        total_inferences = conn.execute("SELECT COUNT(*) as count FROM ml_inference_logs").fetchone()["count"]
        total_feedback = conn.execute("SELECT COUNT(*) as count FROM user_feedback").fetchone()["count"]
        topics_dist = {}
        for row in conn.execute("SELECT topic, COUNT(*) as c FROM pubmed_articles GROUP BY topic").fetchall():
            topics_dist[row["topic"]] = row["c"]
        return {
            "total_articles": total_articles,
            "total_inferences": total_inferences,
            "total_feedback": total_feedback,
            "articles_by_topic": topics_dist
        }
    finally:
        conn.close()
