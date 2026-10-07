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

## Como executar o MLflow em outra máquina

### 1. Preparar o ambiente Python

Na raiz do projeto:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r mlops/requirements.txt
```

### 2. Subir o MLflow com Docker

Com o Docker Desktop aberto:

```bash
docker compose up -d --build
```

Para confirmar se o serviço está rodando:

```bash
docker compose ps
```

O MLflow ficará disponível em:

```text
http://127.0.0.1:5001
```

Na primeira execução, o Docker Compose cria automaticamente o volume usado para armazenar os dados do MLflow.

### 3. Registrar a validação do MedFact

Gerar a matriz de confusão:

```bash
python mlops/gerar_matriz_confusao.py
```

Registrar os resultados no MLflow:

```bash
python mlops/registrar_resultado.py
```

Depois, no MLflow, acessar:

```text
Treinamento de modelos
→ medfact-validacao
→ E06
```

Ali ficam disponíveis as métricas, parâmetros e artefatos da validação.

### 4. Parar o ambiente

```bash
docker compose down
```

Os experimentos continuam armazenados no volume Docker mesmo após o container ser parado ou recriado.

> Por padrão, `registrar_resultado.py` envia os resultados para `http://127.0.0.1:5001`. O endereço pode ser alterado através da variável `MLFLOW_TRACKING_URI`.