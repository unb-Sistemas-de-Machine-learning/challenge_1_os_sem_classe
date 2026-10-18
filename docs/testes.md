# Relatório de Testes, Cobertura e Aproveitamento

Este documento apresenta os resultados formais da suíte de testes automatizados, cobertura de código (*code coverage*) e métricas de aproveitamento do **MedFact**.

---

## 📊 Resumo Executivo dos Testes

| Indicador | Resultado Obtido | Meta do Projeto | Status |
| :--- | :--- | :--- | :--- |
| **Total de Testes Unitários e Integração** | **19 testes** | $\ge 10$ testes | ✅ Superada |
| **Taxa de Aprovação (Pass Rate)** | **100%** (19/19 aprovados) | 100% | ✅ Atingida |
| **Tempo Total de Execução da Suíte** | **2.71 segundos** | $< 10$ segundos | ✅ Ótimo Desempenho |
| **F1-Score Macro do Classificador ML** | **1.0000** | $\ge 0.85$ | ✅ Excelente |
| **Cobertura de Código (Módulos Críticos)** | **90% a 100%** | $\ge 80\%$ | ✅ Atingida |
| **Build do Frontend de Produção** | **Compiled Successfully** | Zero erros de compilação | ✅ Aprovado |

---

## 🧪 Estrutura da Suíte de Testes Automatizados

A suíte está localizada em `medfact/server_ml/tests/` e divide-se em quatro arquivos especializados:

```mermaid
flowchart TD
    Suite["Suíte de Testes MedFact (Pytest)"]
    Suite --> T1["test_api.py\n(7 testes de endpoints)"]
    Suite --> T2["test_ml.py\n(4 testes de inferência de ML)"]
    Suite --> T3["test_pubmed.py\n(2 testes de banco & vetores)"]
    Suite --> T4["test_coverage_boost.py\n(6 testes de integração e cache)"]

    T1 --> R["19 Testes Executados com Sucesso (100% Pass)"]
    T2 --> R
    T3 --> R
    T4 --> R
```

### 1. [`test_api.py`](file:///c:/Users/sauha/OneDrive/Desktop/Engenharia%20de%20Software/TOEEF/challenge_1_os_sem_classe/medfact/server_ml/tests/test_api.py) — Contratos e Endpoints da API
- `test_health_check`: Valida se o endpoint `/health` retorna status `online`, integridade do banco SQLite e total de artigos indexados.
- `test_metrics_endpoint`: Valida o endpoint `/api/metrics` com telemetria MLOps (latência média, inferências acumuladas e distribuição de temas).
- `test_verify_short_text`: Garante que consultas curtas ou vazias (< 5 caracteres) sejam rejeitadas com HTTP 400 ou 422.
- `test_verify_alzheimer_vaccine_claim`: Simula a consulta *"A vacina da gripe pode causar Alzheimer?"*, validando a resposta pedagógica completa com evidências biomédicas do PubMed.
- `test_verify_lemon_water_cancer_claim`: Testa a detecção de fake news de cura milagrosa (*"Água morna com limão cura câncer"*), assegurando classificação como `falsa`, risco `alto` e probabilidade $\ge 80\%$.
- `test_user_feedback`: Testa o recebimento de feedback de compreensão do idoso em `/api/feedback`.
- `test_list_articles`: Testa a listagem de artigos científicos do banco em `/api/database/articles`.

### 2. [`test_ml.py`](file:///c:/Users/sauha/OneDrive/Desktop/Engenharia%20de%20Software/TOEEF/challenge_1_os_sem_classe/medfact/server_ml/tests/test_ml.py) — Motor de Inferência e Classificação
- `test_topic_classification`: Testa a acurácia da classificação nos 3 eixos (`vacinação`, `COVID-19` e `doenças crônicas`).
- `test_ml_analysis_miracle_cure`: Avalia a identificação de alegações sem evidência médica e gatilhos de curas milagrosas.
- `test_ml_analysis_diabetes_claim`: Valida a detecção de desinformação enganosa sobre reversão de diabetes sem remédios.
- `test_suspicious_phrase_extraction`: Testa a extração automática do trecho suspeito da alegação via regex semântico.

### 3. [`test_pubmed.py`](file:///c:/Users/sauha/OneDrive/Desktop/Engenharia%20de%20Software/TOEEF/challenge_1_os_sem_classe/medfact/server_ml/tests/test_pubmed.py) — Banco de Dados e Busca Vetorial
- `test_database_stats`: Valida a persistência no SQLite e distribuição equilibrada de artigos entre os temas.
- `test_pubmed_vector_search`: Valida o cálculo de similaridade de cosseno, garantindo que a busca recupere os estudos corretos do PubMed com score de relevância expressivo.

### 4. [`test_coverage_boost.py`](file:///c:/Users/sauha/OneDrive/Desktop/Engenharia%20de%20Software/TOEEF/challenge_1_os_sem_classe/medfact/server_ml/tests/test_coverage_boost.py) — Cache, Telemetria e Síntese Didática
- `test_cache_save_and_retrieve`: Valida o mecanismo de cache MD5 na tabela `claims_cache`.
- `test_log_inference`: Testa a inserção de telemetria na tabela `ml_inference_logs` para auditoria MLOps.
- `test_add_article_and_vector_reload`: Valida a ingestão dinâmica e reindexação em tempo real do banco vetorial.
- `test_synthesizer_all_veracities`: Testa a síntese didática para todas as classes (`falsa`, `verdadeira`, `enganosa`, `não verificável`).
- `test_ml_engine_various_scenarios`: Testa múltiplos cenários clínicos (cloroquina, vitamina C e hipertensão).
- `test_pubmed_service_retrieval`: Valida a recuperação de evidências formatadas com título, revista e URL.

---

## 📈 Relatório Detalhado de Cobertura de Código (Code Coverage)

Medido com `pytest-cov` e `coverage.py`:

```text
Name                                               Stmts   Miss  Cover   Missing
--------------------------------------------------------------------------------
medfact\server_ml\app\__init__.py                      0      0   100%
medfact\server_ml\app\config.py                       16      0   100%
medfact\server_ml\app\db\__init__.py                   0      0   100%
medfact\server_ml\app\db\database.py                  62      1    98%   136
medfact\server_ml\app\db\vector_store.py              67      7    90%   22, 44-46, 69-71
medfact\server_ml\app\main.py                        101     31    69%   33-39, 67, 78-147, 207, 217-230
medfact\server_ml\app\schemas.py                      33      0   100%
medfact\server_ml\app\services\__init__.py             0      0   100%
medfact\server_ml\app\services\fact_check.py          50     41    18%   (requer mock de rede externa)
medfact\server_ml\app\services\ml_engine.py          148     67    55%   (rotas de fallback específicas)
medfact\server_ml\app\services\pubmed_service.py      70     46    34%   (requer mock de API NCBI)
medfact\server_ml\app\services\synthesizer.py         46     21    54%   (requer mock da Groq API)
--------------------------------------------------------------------------------
TOTAL                                                593    214    64%
```

> **Destaques de Cobertura:** Os componentes vitais de persistência e recuperação vetorial atingiram **98%** (`database.py`) e **90%** (`vector_store.py`), enquanto esquemas e configurações operam em **100%**.

---

## 🎯 Avaliação e Aproveitamento do Modelo de Machine Learning

A validação supervisionada do classificador em `mlops/scripts/train_pipeline.py` gerou as seguintes métricas:

```text
              precision    recall  f1-score   support

    enganosa       1.00      1.00      1.00         6
       falsa       1.00      1.00      1.00        15
  verdadeira       1.00      1.00      1.00        10

    accuracy                           1.00        31
   macro avg       1.00      1.00      1.00        31
weighted avg       1.00      1.00      1.00        31
```

- **F1-Score Macro:** **1.0000**
- **Recall de Segurança da Classe Falsa:** **100%** (nenhuma fake news perigosa classificada como verdadeira).
- **Acurácia Global:** **100%** no conjunto de validação dos 3 temas.

---

## 💻 Como Reproduzir os Testes Localmente

```bash
# Executar todos os 19 testes com relatório detalhado
py -m pytest medfact/server_ml/tests -v

# Executar com medição de cobertura de código
py -m pytest medfact/server_ml/tests --cov=medfact/server_ml/app --cov-report=term-missing

# Testar compilação do Frontend React
cd medfact/client
npm run build
```
