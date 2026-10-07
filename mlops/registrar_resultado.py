from sklearn.metrics import f1_score, precision_score, recall_score

import json
import os
import mlflow

CAMINHO_RESULTADO = "medfact/server/scripts/resultados_validacao.json"

CAMINHO_MATRIZ = "mlops/matriz_confusao.png"

MLFLOW_TRACKING_URI = os.getenv(
    "MLFLOW_TRACKING_URI",
    "http://127.0.0.1:5001"
)

mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
mlflow.set_experiment("medfact-validacao")

with open(CAMINHO_RESULTADO, "r", encoding="utf-8") as arquivo:
    dados = json.load(arquivo)

experimento = dados["experimento"]
configuracao = dados["configuracao"]
resumo = dados["resumo"]

resultados_validos = [
    item
    for item in dados["resultados"]
    if item.get("status") == "ok"
]

esperados = [item["esperado"] for item in resultados_validos]
predicoes = [item["predicao"] for item in resultados_validos]

f1_macro = f1_score(
    esperados,
    predicoes,
    average="macro",
    zero_division=0,
)

precision_macro = precision_score(
    esperados,
    predicoes,
    average="macro",
    zero_division=0,
)

recall_macro = recall_score(
    esperados,
    predicoes,
    average="macro",
    zero_division=0,
)

with mlflow.start_run(run_name=experimento):

    # Parâmetros do experimento
    for nome, valor in configuracao.items():
        mlflow.log_param(nome, valor)

    # Métricas principais
    mlflow.log_metric("acuracia", resumo["acuracia"])
    mlflow.log_metric("total", resumo["total"])
    mlflow.log_metric("validos", resumo["validos"])
    mlflow.log_metric("corretos", resumo["corretos"])
    mlflow.log_metric("incorretos", resumo["incorretos"])
    mlflow.log_metric("erros_api", resumo["erros_api"])
    mlflow.log_metric("taxa_erro_api", resumo["taxa_erro_api"])
    mlflow.log_metric("tempo_segundos", resumo["tempo_segundos"])

    mlflow.log_metric("f1_macro", f1_macro)
    mlflow.log_metric("precision_macro", precision_macro)
    mlflow.log_metric("recall_macro", recall_macro)

    # Guarda o JSON completo como artefato
    mlflow.log_artifact(CAMINHO_RESULTADO)
    mlflow.log_artifact(CAMINHO_MATRIZ)
    
print(f"Experimento {experimento} registrado no MLflow com sucesso.")