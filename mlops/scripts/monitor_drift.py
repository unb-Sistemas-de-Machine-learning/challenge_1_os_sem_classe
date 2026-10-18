"""
MLOps Drift and Telemetry Monitoring.
Analyzes inference logs from SQLite to detect data drift, concept drift, and performance anomalies.
"""
import os
import sys
import json
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from medfact.server_ml.app.db.database import get_db_connection

def analyze_drift():
    conn = get_db_connection()
    try:
        cur = conn.execute("""
            SELECT log_id, timestamp, input_length, detected_topic, veracity_result, risk_result, latency_ms
            FROM ml_inference_logs
            ORDER BY timestamp DESC
            LIMIT 100
        """)
        logs = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    if not logs:
        print("Nenhum log de inferência registrado ainda para análise de drift.")
        return

    total = len(logs)
    avg_length = sum(l["input_length"] for l in logs) / total
    avg_latency = sum(l["latency_ms"] for l in logs) / total

    topics = {}
    veracities = {}
    risks = {}

    for l in logs:
        t = l["detected_topic"]
        topics[t] = topics.get(t, 0) + 1
        v = l["veracity_result"]
        veracities[v] = veracities.get(v, 0) + 1
        r = l["risk_result"]
        risks[r] = risks.get(r, 0) + 1

    report = {
        "timestamp_analise": datetime.now().isoformat(),
        "total_amostras_analisadas": total,
        "tamanho_medio_entrada_chars": round(avg_length, 1),
        "latencia_media_ms": round(avg_latency, 2),
        "distribuicao_temas_pct": {k: round((v / total) * 100, 1) for k, v in topics.items()},
        "distribuicao_veracidade_pct": {k: round((v / total) * 100, 1) for k, v in veracities.items()},
        "distribuicao_risco_pct": {k: round((v / total) * 100, 1) for k, v in risks.items()},
        "alertas_drift": []
    }

    # Heurística de Alerta de Drift:
    if report["distribuicao_veracidade_pct"].get("falsa", 0) > 85.0:
        report["alertas_drift"].append("Alerta: Concentração atípica de alegações 'falsas' (>85%). Possível surto de desinformação viral.")
    if avg_latency > 2500.0:
        report["alertas_drift"].append("Alerta de SLA: Latência média superior a 2500ms.")

    out_path = os.path.join(os.path.dirname(__file__), "..", "reports", "drift_analysis.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("=== Relatório de Monitoramento MLOps e Data Drift ===")
    print(json.dumps(report, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    analyze_drift()
