FROM python:3.12-slim

WORKDIR /app

COPY mlops/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 5000

CMD ["mlflow", "server", "--host", "0.0.0.0", "--port", "5000", "--backend-store-uri", "sqlite:////app/data/mlflow.db", "--artifacts-destination", "/app/data/artifacts"]