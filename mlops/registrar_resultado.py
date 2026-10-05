import json
import mlflow

CAMINHO_RESULTADO = "medfact/server/scripts/resultados_validacao.json"

mlflow.set_tracking_uri("http://127.0.0.1:5000")
mlflow.set_experiment("medfact-validacao")

with open(CAMINHO_RESULTADO, "r", encoding="utf-8") as arquivo:
    dados = json.load(arquivo)

experimento = dados["experimento"]
configuracao = dados["configuracao"]
resumo = dados["resumo"]

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

    # Guarda o JSON completo como artefato
    mlflow.log_artifact(CAMINHO_RESULTADO)

print(f"Experimento {experimento} registrado no MLflow com sucesso.")