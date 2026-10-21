# Guia de Instalação e Execução

O MedFact foi concebido para ser executado tanto em ambiente de desenvolvimento local quanto conteinerizado via Docker.

---

## Pré-requisitos

- **Para execução com Docker (Recomendado):**
    - [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24.0+
    - [Docker Compose](https://docs.docker.com/compose/) v2.20+
- **Para execução local direta:**
    - [Python](https://www.python.org/) 3.11 ou superior
    - [Node.js](https://nodejs.org/) 18.x ou superior (com `npm`)
    - [Git](https://git-scm.com/)

---

## Método 1: Execução com Docker Compose (Recomendado)

Este método sobe toda a infraestrutura com um único comando (Backend FastAPI na porta `3001`, Frontend React na porta `3000` e MLflow Tracking Server na porta `5001`).

```bash
# 1. Clone o repositório
git clone https://github.com/unb-Sistemas-de-Machine-learning/challenge_1_os_sem_classe.git
cd challenge_1_os_sem_classe

# 2. Inicialize todos os serviços em background
docker compose up -d --build

# 3. Acesse a aplicação no seu navegador:
# Frontend: http://localhost:3000
# Backend API & Swagger: http://localhost:3001/docs
# MLflow Dashboard: http://localhost:5001
```

Para interromper todos os contêineres:

```bash
docker compose down
```

---

## Método 2: Execução Local Passo a Passo

### 1. Configurando e Inicializando o Backend (FastAPI + ML)

```bash
# Instale as dependências Python
py -m pip install -r medfact/server_ml/requirements.txt

# Inicialize o banco de dados e semeie os artigos científicos do PubMed
py mlops/scripts/seed_pubmed.py

# Treine os modelos de Machine Learning (gera topic_classifier.joblib e veracity_classifier.joblib)
py mlops/scripts/train_pipeline.py

# Inicie o servidor FastAPI na porta 3001
py -m uvicorn medfact.server_ml.app.main:app --host 0.0.0.0 --port 3001 --reload
```

> A API estará disponível em `http://localhost:3001`. A documentação Swagger interativa pode ser acessada em `http://localhost:3001/docs`.

---

### 2. Configurando e Inicializando o Frontend (React)

Em outro terminal:

```bash
cd medfact/client

# Instale os pacotes npm
npm install

# Inicie o servidor de desenvolvimento do React
npm start
```

> O navegador abrirá automaticamente a interface em `http://localhost:3000`.

---

## Execução dos Testes Automatizados

O MedFact possui uma suíte de testes com **100% de aprovação**:

```bash
# Executa todos os testes unitários e de integração
py -m pytest medfact/server_ml/tests -v
```

---

## Scripts de MLOps

```bash
# Treinar os modelos e gerar relatório de métricas F1
py mlops/scripts/train_pipeline.py

# Analisar os logs de inferência e detectar Data Drift
py mlops/scripts/monitor_drift.py

# Re-semear a base científica do PubMed
py mlops/scripts/seed_pubmed.py
```

---

## Visualização da Documentação MkDocs

Para visualizar este portal de documentação localmente:

```bash
# Instale o tema do MkDocs
py -m pip install mkdocs-material

# Inicie o servidor de documentação
py -m mkdocs serve
```

> Acesse `http://localhost:8000` para navegar pela documentação interativa.

Para publicar alterações diretamente no GitHub Pages:

```bash
py -m mkdocs gh-deploy --force
```
