# Arquitetura do Software MedFact

A arquitetura do **MedFact** foi estruturada sob o paradigma de microsserviços desacoplados e orientada a dados, combinando engenharia de software tradicional, pipelines de Machine Learning e orquestração de evidências biomédicas.

---

## Visão Geral da Arquitetura

O sistema opera em uma estrutura de duas camadas complementares (**Two-Tier Verification**):

```mermaid
flowchart TD
    subgraph Client["Frontend (React 19)"]
        UI["Interface do Usuário (Idosos)"]
        Acessibilidade["Barra de Acessibilidade & Mascote"]
    end

    subgraph Backend["Backend de Machine Learning (FastAPI)"]
        API["API Gateway / FastAPI (Porta 3001)"]
        Cache["Cache de Alegações (claims_cache)"]
        
        subgraph Camada1["Camada 1 — Checagem Rápida"]
            GFC["Google Fact Check Tools API"]
        end
        
        subgraph Camada2["Camada 2 — Inteligência Artificial & PubMed"]
            TopicML["Classificador de Temas (ML)"]
            PubMedVector["PubMed Vector Store (Embeddings)"]
            PubMedLive["NCBI PubMed E-utilities API"]
            VeracityML["Classificador de Veracidade e Risco (ML)"]
            Synthesizer["Sintetizador Didático (Groq LLM / Regras)"]
        end
        
        subgraph Database["Banco de Dados Relacional & Vetorial (SQLite WAL)"]
            T_Articles[("pubmed_articles")]
            T_Logs[("ml_inference_logs")]
            T_Feedback[("user_feedback")]
        end
    end

    subgraph MLOps["Engenharia MLOps & DevOps"]
        MLflow["MLflow Tracking Server (Porta 5001)"]
        Drift["Detector de Data Drift"]
        Docker["Docker & Docker Compose"]
    end

    UI -->|"POST /api/verify"| API
    API --> Cache
    Cache -->|"Cache Miss"| GFC
    GFC -->|"Encontrou"| UI
    GFC -->|"Não Encontrou"| TopicML
    
    TopicML --> PubMedVector
    PubMedVector -.->|"Se necessário"| PubMedLive
    PubMedLive -->|"Indexação Dinâmica"| T_Articles
    
    PubMedVector --> VeracityML
    VeracityML --> Synthesizer
    Synthesizer -->|"Resposta Estruturada"| UI
    
    API -->|"Log de Inferência"| T_Logs
    T_Logs --> Drift
    VeracityML --> MLflow
```

---

## Fluxo de Execução e Sequência

A interação entre o usuário idoso e os componentes internos segue o diagrama de sequência abaixo:

```mermaid
sequenceDiagram
    autonumber
    actor Idoso as Idoso / Cuidador
    participant Front as Frontend (React)
    participant API as FastAPI Backend
    participant Cache as SQLite Cache
    participant C1 as Camada 1 (Google Fact Check)
    participant ML as ML Engine (Classificador)
    participant Vec as PubMed Vector Store
    participant Synth as Synthesizer (Groq/Didático)

    Idoso->>Front: Digita: "Vacina da gripe causa Alzheimer?"
    Front->>API: POST /api/verify { texto: "..." }
    
    API->>Cache: Checar hash da consulta no claims_cache
    alt Resposta em Cache
        Cache-->>API: Retorna resultado pré-processado
        API-->>Front: JSON estruturado (< 50ms)
    else Consulta Inédita
        API->>C1: Consulta Google Fact Check Tools API
        alt Checagem Jornalística Encontrada
            C1-->>API: Agência de Checagem (Aos Fatos/Lupa) + Rating
            API-->>Front: Resposta Camada 1 (Citação direta da agência)
        else Nenhuma Checagem Pronta (Camada 2)
            API->>ML: Classificar Tema (Vacinação / COVID-19 / Crônicas)
            ML-->>API: Tema: "vacinação"
            API->>Vec: Buscar estudos semânticos por similaridade de cosseno
            Vec-->>API: Artigos PubMed (ex: Estudo de Coorte do JAD)
            API->>ML: Predizer Veracidade, Risco e Mecanismo
            ML-->>API: Falsa (95%), Risco: Alto, Tipo: Alegação sem evidência
            API->>Synth: Gerar explicação simples e empática para idoso
            Synth-->>API: Texto acolhedor sem jargões + conselho médico
            API->>Cache: Salvar resposta no cache e logar inferência
            API-->>Front: Resposta Camada 2 Completa
        end
    end
    Front-->>Idoso: Exibe selo, explicação em letras grandes e fontes
```

---

## Componentes do Sistema

### 1. Frontend (Interface do Usuário)
- **Tecnologia:** React 19 com CSS modular vanilla.
- **Responsabilidades:**
    - Coleta amigável da dúvida com botões de atalho para perguntas frequentes.
    - Barra de acessibilidade e mascote simpático ("Pílula MedFact") para engajar o usuário.
    - Exibição de selos claros com cores de alto contraste:
        - 🟢 **VERDADEIRA** (Verde esmeralda)
        - 🟡 **ENGANOSA** (Amarelo âmbar)
        - **FALSA** (Vermelho telha suave)
        -  **NÃO VERIFICÁVEL** (Cinza neutro)
    - Cartões com links clicáveis para os artigos originais do PubMed.

### 2. Backend Gateway & Orquestrador
- **Tecnologia:** Python 3.11+ com FastAPI e Uvicorn.
- **Responsabilidades:**
    - Validação de contratos Pydantic.
    - Orquestração assíncrona com `httpx`.
    - Sanitização e normalização semântica (remoção de acentos via NFD, pontuações e minúsculas).
    - Métricas Prometheus e telemetria de produção via endpoint `/api/metrics`.

### 3. Camada 1 — Google Fact Check
- **Responsabilidade:** Atalho oportunista de alta precisão para claims virais previamente investigadas por agências certificadas pelo IFCN (*International Fact-Checking Network*).
- **Vantagem de Produção:** Evita chamadas custosas ao modelo de linguagem quando jornalistas humanos já produziram a averiguação.

### 4. Camada 2 — Machine Learning & PubMed
- **Responsabilidade:** Quando a dúvida for inédita ou não constar nas agências, o MedFact aciona sua própria esteira de evidências científicas.
- **Subcomponentes:**
    - `ml_engine.py`: Classificadores supervisionados baseados em TF-IDF e regressão logística calibrada.
    - `vector_store.py`: Banco vetorial baseado em embeddings densos e cálculo de similaridade de cosseno em memória persistido no SQLite.
    - `pubmed_service.py`: Interface com a API oficial do NCBI E-utilities, com dicionário de tradução médica PT-BR -> MeSH Terms.
    - `synthesizer.py`: Motor de geração em linguagem simples, utilizando a API da Groq (Llama 3.1) com temperatura baixa (0.3) e fallback determinístico baseado em diretrizes médicas.

### 5. Camada de Persistência (Database)
- **Tecnologia:** SQLite configurado em modo WAL (*Write-Ahead Logging*).
- **Tabelas Principais:**
    - `pubmed_articles`: Artigos científicos indexados.
    - `claims_cache`: Cache de respostas com chave MD5.
    - `ml_inference_logs`: Auditoria de cada predição executada.
    - `user_feedback`: Avaliações de idosos sobre a clareza da explicação.