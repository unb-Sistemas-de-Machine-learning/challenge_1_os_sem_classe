# Tecnologias Utilizadas no MedFact

O MedFact combina tecnologias modernas de desenvolvimento web, engenharia de dados, inteligência artificial e práticas de produção MLOps/DevOps.

---

## Matriz Tecnológica

| Camada | Tecnologia | Versão | Justificativa da Escolha |
| :--- | :--- | :--- | :--- |
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) | 0.110+ | Alta performance assíncrona, validação nativa com Pydantic e compatibilidade com o ecossistema Python de ML. |
| **Servidor ASGI** | [Uvicorn](https://www.uvicorn.org/) | 0.28+ | Servidor web assíncrono padrão da indústria para aplicações Python de alta concorrência. |
| **Machine Learning** | [Scikit-learn](https://scikit-learn.org/) | 1.4+ | Algoritmos consolidados para classificação de texto, TF-IDF, calibração de probabilidade e métricas de F1. |
| **Computação Científica** | [NumPy](https://numpy.org/) & [SciPy](https://scipy.org/) | 1.26+ / 1.12+ | Operações matriciais de alta velocidade para cálculo de similaridade de cosseno nos vetores de artigos. |
| **Frontend** | [React](https://react.dev/) | 19.x | Ecossistema maduro para interfaces reativas, componentização e gerenciamento de acessibilidade. |
| **Estilização** | Vanilla CSS Moderno | CSS3 | Controle total sobre tamanhos de fonte, paleta de contraste para idosos e ausência de dependências pesadas. |
| **Banco de Dados Relacional** | [SQLite](https://www.sqlite.org/) (WAL Mode) | 3.x | Leve, embarcado, zero overhead de configuração e com alta concorrência em leitura/escrita via WAL. |
| **Banco Vetorial** | `PubMedVectorStore` | Nativo | Motor vetorial dedicado que indexa títulos, abstracts e termos MeSH com busca por similaridade de cosseno. |
| **Base Biomédica** | [PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) | API Oficial | Acesso direto ao maior acervo mundial de literatura médica e ensaios clínicos revisados por pares. |
| **LLM Synthesizer** | [Groq Cloud](https://groq.com/) | Llama 3.1 8B | Inferência ultrarrápida (sub-segundo) para sintetizar explicações empáticas e sem jargões. |
| **Tracking MLOps** | [MLflow](https://mlflow.org/) | 2.10+ | Registro de experimentos, parâmetros de treino, matrizes de confusão e linhagem de modelos. |
| **Conteinerização** | [Docker](https://www.docker.com/) & [Compose](https://docs.docker.com/compose/) | 25+ / v2 | Empacotamento reproduzível de todos os microsserviços em qualquer ambiente (dev, staging, prod). |
| **Integração Contínua** | [GitHub Actions](https://github.com/features/actions) | v4 | Execução automatizada de testes unitários, validação de F1 e build dos contêineres. |
| **Documentação Técnica** | [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) | 9.5+ | Site estático responsivo, elegante e publicado diretamente no GitHub Pages. |

---

## Detalhamento dos Componentes

### 1. Python FastAPI
Substituiu o antigo backend em Node.js para unificar todo o fluxo de Machine Learning em uma única pilha nativa. O FastAPI expõe a rota `POST /api/verify`, mantendo **100% de compatibilidade** com o contrato que o frontend React já consome. Além disso, fornece documentação interativa automática via Swagger UI em `/docs`.

### 2. PubMed Vector Store
O MedFact implementa um banco vetorial customizado e persistente, projetado para operar com latência sub-milissegundo:
- Cria vetores TF-IDF ponderados a partir do título do artigo, resumo (*abstract*) e termos de indexação MeSH.
- Calcula a distância angular e similaridade de cosseno com a dúvida digitada pelo idoso.
- Permite expansão contínua: toda busca inédita bem-sucedida no PubMed é automaticamente incorporada ao banco local.

### 3. Groq API com Llama 3.1
Utilizado para traduzir a linguagem fria e complexa dos periódicos científicos (ex: *The Lancet*, *NEJM*) em uma conversa tranquila e amiga para o idoso:
- Temperatura controlada (0.3) para evitar alucinações.
- Regra de ouro: nunca contradizer a evidência científica do PubMed recuperada pela Camada 2.
- Caso o usuário não informe chave da Groq ou atinja o limite do plano, um motor de síntese didática heurística assume a resposta instantaneamente sem falhas.

### 4. React 19 Frontend
Desenvolvido com foco absoluto em usabilidade para a terceira idade:
- **Zero Frameworks Pesados:** Apenas CSS moderno puro, garantindo carregamento instantâneo mesmo em conexões 3G/4G lentas.
- **Componentes Especializados:**
    - `AccessibilityBar`: Permite ao idoso ajustar o tamanho da fonte e contraste visual com um único clique.
    - `MascotPill`: Mascote amigável em formato de pílula animada que acolhe o usuário e humaniza a experiência.
    - `AboutModal`: Janela informativa detalhando a origem acadêmica e o propósito social do MedFact.
