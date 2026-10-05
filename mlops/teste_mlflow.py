import mlflow

mlflow.set_tracking_uri("http://127.0.0.1:5000")
mlflow.set_experiment("medfact-teste")

with mlflow.start_run():
    mlflow.log_param("modelo", "teste")
    mlflow.log_metric("accuracy", 0.80)

print("Teste registrado no MLflow com sucesso.")