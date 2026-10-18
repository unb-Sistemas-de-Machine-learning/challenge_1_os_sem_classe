"""
MLOps Automated Training and Evaluation Pipeline.
Trains Topic and Veracity Classifiers, calculates Macro-F1 scores,
generates confusion matrices, and persists models for production.
"""
import os
import sys
import json
import joblib
import numpy as np

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score, confusion_matrix
from sklearn.model_selection import train_test_split

# Dataset for Training and Validation (expanded with Portuguese and English medical claims)
DATASET = [
    # Vacinação (falsa, verdadeira, enganosa)
    {"text": "A vacina contra a gripe pode causar Alzheimer em idosos", "tema": "vacinação", "label": "falsa"},
    {"text": "A vacina de COVID-19 altera o DNA das pessoas", "tema": "vacinação", "label": "falsa"},
    {"text": "Vacina de sarampo tríplice viral causa autismo em crianças", "tema": "vacinação", "label": "falsa"},
    {"text": "Vacinas contém microchips para rastreamento populacional", "tema": "vacinação", "label": "falsa"},
    {"text": "A vacina contra a gripe é segura e reduz complicações respiratórias em idosos", "tema": "vacinação", "label": "verdadeira"},
    {"text": "Pessoas vacinadas contra a gripe ainda podem ter gripe mas com sintomas mais leves", "tema": "vacinação", "label": "verdadeira"},
    {"text": "Vacinação contra pneumonia e gripe é recomendada para maiores de 60 anos", "tema": "vacinação", "label": "verdadeira"},
    {"text": "A vacina da COVID é 100% eficaz e impede qualquer transmissão do vírus", "tema": "vacinação", "label": "enganosa"},
    {"text": "Tomar três doses no mesmo dia garante imunidade vitalícia", "tema": "vacinação", "label": "enganosa"},
    {"text": "The COVID-19 vaccine causes infertility in women", "tema": "vacinação", "label": "falsa"},
    {"text": "Influenza vaccination reduces cardiovascular complications in chronic patients", "tema": "vacinação", "label": "verdadeira"},

    # COVID-19 (falsa, verdadeira, enganosa)
    {"text": "Vitamina C em dose alta cura a COVID-19 rapidamente", "tema": "COVID-19", "label": "falsa"},
    {"text": "Cloroquina e ivermectina curam o coronavírus comprovadamente", "tema": "COVID-19", "label": "falsa"},
    {"text": "Gargarejo com água morna e vinagre mata o coronavírus na garganta", "tema": "COVID-19", "label": "falsa"},
    {"text": "O uso correto de máscaras reduz a transmissão do coronavírus em ambientes fechados", "tema": "COVID-19", "label": "verdadeira"},
    {"text": "Idosos com hipertensão têm maior risco de complicações graves se contraírem COVID-19", "tema": "COVID-19", "label": "verdadeira"},
    {"text": "Lavar as mãos com água e sabão ajuda a prevenir a contaminação viral", "tema": "COVID-19", "label": "verdadeira"},
    {"text": "Tomar chá de alho quente previne 100% o contágio por COVID-19", "tema": "COVID-19", "label": "enganosa"},
    {"text": "O vírus da COVID-19 não afeta pessoas com boa imunidade", "tema": "COVID-19", "label": "enganosa"},
    {"text": "Hydroxychloroquine is a proven effective cure for SARS-CoV-2", "tema": "COVID-19", "label": "falsa"},
    {"text": "High doses of zinc and ascorbic acid eliminate COVID-19 infection", "tema": "COVID-19", "label": "falsa"},

    # Doenças crônicas (falsa, verdadeira, enganosa)
    {"text": "Água morna com limão em jejum cura qualquer tipo de câncer", "tema": "doenças crônicas", "label": "falsa"},
    {"text": "Chá de folha de graviola substitui a quimioterapia contra tumores", "tema": "doenças crônicas", "label": "falsa"},
    {"text": "Parar de tomar remédio de pressão e beber suco de chuchu cura hipertensão", "tema": "doenças crônicas", "label": "falsa"},
    {"text": "Dá para reverter o diabetes só com dieta caseira sem nenhum remédio ou médico", "tema": "doenças crônicas", "label": "enganosa"},
    {"text": "Dieta balanceada e perda de peso ajudam no controle glicêmico do diabetes tipo 2", "tema": "doenças crônicas", "label": "verdadeira"},
    {"text": "Praticar caminhadas e reduzir o sal ajuda a controlar a pressão arterial em idosos", "tema": "doenças crônicas", "label": "verdadeira"},
    {"text": "O tratamento precoce e o acompanhamento médico melhoram o prognóstico do câncer", "tema": "doenças crônicas", "label": "verdadeira"},
    {"text": "Existe um novo remédio caseiro que cura o Alzheimer completamente", "tema": "doenças crônicas", "label": "falsa"},
    {"text": "Comer açúcar é a única causa existente de diabetes", "tema": "doenças crônicas", "label": "enganosa"},
    {"text": "Drinking alkaline water alters body pH and eradicates cancer cells", "tema": "doenças crônicas", "label": "falsa"}
]

def train_and_evaluate():
    models_dir = os.path.join(os.path.dirname(__file__), "..", "..", "medfact", "server_ml", "app", "ml_models")
    reports_dir = os.path.join(os.path.dirname(__file__), "..", "reports")
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)

    texts = [d["text"] for d in DATASET]
    temas = [d["tema"] for d in DATASET]
    labels = [d["label"] for d in DATASET]

    print("==================================================")
    print(" 1. TREINANDO CLASSIFICADOR DE TEMAS (TOPIC ML)")
    print("==================================================")
    topic_pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
        ("clf", LogisticRegression(C=2.0, max_iter=500, random_state=42))
    ])
    topic_pipeline.fit(texts, temas)
    topic_preds = topic_pipeline.predict(texts)
    f1_topic = f1_score(temas, topic_preds, average="macro")
    print(f"F1-score Macro (Tema): {f1_topic:.4f}")
    
    topic_model_path = os.path.join(models_dir, "topic_classifier.joblib")
    joblib.dump(topic_pipeline, topic_model_path)
    print(f"Modelo de Tema salvo em: {topic_model_path}")

    print("\n==================================================")
    print(" 2. TREINANDO CLASSIFICADOR DE VERACIDADE (VERACITY ML)")
    print("==================================================")
    veracity_pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
        ("clf", LogisticRegression(C=1.5, max_iter=500, random_state=42))
    ])
    veracity_pipeline.fit(texts, labels)
    veracity_preds = veracity_pipeline.predict(texts)
    
    f1_veracity = f1_score(labels, veracity_preds, average="macro")
    report = classification_report(labels, veracity_preds, output_dict=True)
    cm = confusion_matrix(labels, veracity_preds, labels=["falsa", "enganosa", "verdadeira"]).tolist()
    
    print(f"F1-score Macro (Veracidade): {f1_veracity:.4f}")
    print(classification_report(labels, veracity_preds))

    veracity_model_path = os.path.join(models_dir, "veracity_classifier.joblib")
    joblib.dump(veracity_pipeline, veracity_model_path)
    print(f"Modelo de Veracidade salvo em: {veracity_model_path}")

    # Save evaluation report artifact for MLOps tracking
    metrics_report = {
        "model_version": "medfact-ml-v2.0",
        "dataset_size": len(DATASET),
        "f1_macro_topic": round(float(f1_topic), 4),
        "f1_macro_veracity": round(float(f1_veracity), 4),
        "confusion_matrix": cm,
        "classes": ["falsa", "enganosa", "verdadeira"],
        "detailed_report": report
    }
    
    report_path = os.path.join(reports_dir, "evaluation_metrics.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(metrics_report, f, indent=2, ensure_ascii=False)
    print(f"\nRelatório de Métricas salvo em: {report_path}")

    # Optional: Log to MLflow if available
    try:
        import mlflow
        tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5001")
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment("medfact-misinformation-detector")
        with mlflow.start_run(run_name="ml-pipeline-v2"):
            mlflow.log_param("vectorizer", "TfidfVectorizer(ngram=(1,2))")
            mlflow.log_param("model", "LogisticRegression")
            mlflow.log_metric("f1_macro_topic", f1_topic)
            mlflow.log_metric("f1_macro_veracity", f1_veracity)
            mlflow.log_artifact(report_path)
            print("Execução registrada no MLflow com sucesso!")
    except Exception as e:
        print(f"Nota MLOps: MLflow server não conectado no momento ({e}). Métricas salvas localmente.")

    print("\nPipeline de Treinamento e Avaliação concluído com sucesso!")

if __name__ == "__main__":
    train_and_evaluate()
