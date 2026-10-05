# MLOps

Esta pasta reúne os arquivos relacionados à implementação de MLOps no MedFact.

## Objetivo

O foco inicial é utilizar:

- MLflow para registrar e comparar experimentos;
- Docker para padronizar o ambiente de execução;
- scikit-learn para cálculo de métricas.

## Dependências

Para instalar as dependências:

```bash
pip install -r mlops/requirements.txt

## Executando o MLflow com Docker Compose

Com o Docker Desktop aberto, execute na raiz do projeto:

```bash
docker compose up -d
```

Para verificar se o serviço está rodando:

```bash
docker compose ps
```

O MLflow ficará disponível em:

```text
http://127.0.0.1:5001
```

Para parar o ambiente:

```bash
docker compose down
```

Os dados do MLflow são armazenados no volume Docker:

```text
medfact-mlflow-data
```

Por isso, os experimentos continuam salvos mesmo depois de parar ou recriar o container.
