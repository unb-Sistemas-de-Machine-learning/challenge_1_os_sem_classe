# MedFact — Arquitetura e Requisitos

## 1. Arquitetura do Sistema

O MedFact utiliza uma arquitetura dividida entre frontend, backend e serviços externos.

```text
Usuário
   ↓
Frontend
   ↓
Backend
   ├── Google Fact Check
   ├── PubMed
   └── Groq
   ↓
Classificação e evidências
   ↓
Frontend
   ↓
Usuário
```

O backend é responsável por coordenar todo o processo de análise.

---

## 2. Fluxo de Processamento

O fluxo principal do sistema é:

1. O usuário envia uma afirmação.
2. O backend normaliza o texto.
3. O sistema consulta o Google Fact Check.
4. Caso seja encontrada uma checagem adequada, suas informações são retornadas.
5. Caso não exista uma checagem adequada, o sistema consulta o PubMed.
6. Os artigos encontrados são ordenados por relevância.
7. Os candidatos passam por avaliação semântica.
8. As evidências são classificadas como diretas, indiretas ou não evidência.
9. Somente evidências diretas são utilizadas como fontes finais.
10. O Groq realiza a classificação da afirmação.
11. O backend retorna o resultado ao frontend.

---

## 3. Componentes do Sistema

### 3.1 Frontend

Responsável por:

- receber a afirmação do usuário;
- enviar a requisição ao backend;
- apresentar a classificação;
- apresentar a explicação;
- apresentar as fontes utilizadas.

### 3.2 Backend

Responsável por:

- receber as requisições;
- controlar o fluxo de análise;
- consultar as APIs externas;
- processar as respostas;
- avaliar evidências;
- realizar a classificação;
- retornar o resultado ao frontend.

### 3.3 Google Fact Check

Responsável por localizar checagens de fatos já existentes.

A classificação original da organização deve ser preservada e não deve ser confundida com a classificação própria do MedFact.

### 3.4 PubMed

Responsável por fornecer literatura científica para análise quando não houver uma checagem adequada.

### 3.5 Groq

Responsável pela análise semântica, avaliação das evidências e classificação da afirmação.

---

## 4. Requisitos Funcionais

### RF01 — Receber afirmação

O sistema deve permitir que o usuário envie uma afirmação textual para análise.

### RF02 — Validar entrada

O sistema deve rejeitar entradas vazias ou excessivamente curtas.

### RF03 — Consultar Google Fact Check

O sistema deve consultar o Google Fact Check para verificar a existência de checagens relacionadas à afirmação.

### RF04 — Retornar checagem existente

Quando uma checagem adequada for encontrada, o sistema deve apresentar suas informações e preservar sua classificação original.

### RF05 — Consultar PubMed

Quando não houver uma checagem adequada, o sistema deve consultar o PubMed.

### RF06 — Filtrar relevância

O sistema deve avaliar se os artigos encontrados possuem relação suficiente com a afirmação.

### RF07 — Avaliar evidência

O sistema deve diferenciar evidências diretas, indiretas e não evidências.

### RF08 — Filtrar evidências inadequadas

Evidências indiretas e não evidências não devem ser apresentadas como fontes diretas ao usuário.

### RF09 — Classificar afirmação

O sistema deve classificar a afirmação como:

- verdadeira;
- falsa;
- enganosa;
- não verificável.

### RF10 — Apresentar fontes

O sistema deve apresentar as fontes utilizadas quando houver evidências adequadas.

### RF11 — Tratar ausência de evidência

O sistema deve permitir retornar zero evidências quando nenhuma fonte encontrada sustentar diretamente a afirmação.

### RF12 — Utilizar cache

O sistema deve armazenar temporariamente resultados de consultas para evitar requisições desnecessárias.

---

## 5. Requisitos Não Funcionais

### RNF01 — Desempenho

O sistema deve realizar a análise em tempo adequado para utilização interativa.

### RNF02 — Confiabilidade

Uma falha em uma API externa não deve interromper desnecessariamente todo o processo.

### RNF03 — Segurança

Chaves de API e outras credenciais devem ser armazenadas em variáveis de ambiente e não devem ser expostas no código ou nos logs.

### RNF04 — Escalabilidade

A arquitetura deve permitir a inclusão de novas fontes de evidência futuramente.

### RNF05 — Manutenibilidade

As responsabilidades devem permanecer separadas em serviços específicos.

### RNF06 — Rastreabilidade

As fontes utilizadas na análise devem ser identificáveis pelo usuário.

### RNF07 — Controle de requisições

O sistema deve possuir mecanismos para evitar excesso de chamadas às APIs externas.

---

## 6. Regras de Negócio

### RN01 — Relação entre palavras e evidência

A existência de palavras semelhantes entre uma afirmação e um artigo não é suficiente para considerar o artigo uma evidência.

### RN02 — Evidência direta

Uma evidência direta deve corresponder à intervenção ou exposição e ao resultado apresentados na afirmação.

### RN03 — Evidência indireta

Estudos sobre extratos, compostos isolados, derivados ou modelos experimentais não devem ser considerados evidência direta quando a afirmação tratar de uma intervenção diferente.

### RN04 — Ausência de evidência

A ausência de evidência direta não significa automaticamente que uma afirmação seja falsa.

### RN05 — Classificação externa

A classificação fornecida por uma organização de fact-checking deve ser apresentada como classificação da própria organização.

### RN06 — Integridade das fontes

O sistema não deve inventar fontes ou evidências quando nenhuma fonte adequada for encontrada.

---

## 7. Avaliação de Evidências

O processo de avaliação possui duas etapas principais:

### 7.1 Avaliação de Relevância

Determina se um artigo possui relação suficiente com a afirmação para ser analisado.

### 7.2 Avaliação de Evidência

Determina se o artigo realmente fornece evidência utilizável para avaliar a afirmação.

O fluxo é:

```text
Artigos encontrados
        ↓
Ranking de relevância
        ↓
Avaliação semântica
        ↓
Avaliação de evidência
        ↓
┌───────────────┬───────────────┬──────────────────┐
│    Direta     │   Indireta    │  Não evidência   │
└───────┬───────┴───────┬───────┴────────┬─────────┘
        ↓               ↓                ↓
     Mantém          Descarta         Descarta
        ↓
Evidências finais
```

Somente evidências classificadas como diretas devem ser retornadas como evidências científicas finais.

---

## 8. Exemplo de Correspondência

Para uma afirmação como:

> Beber água morna com limão cura câncer.

O PubMed pode encontrar artigos relacionados a:

- câncer;
- limão;
- compostos cítricos;
- extratos de limão;
- nanovesículas;
- modelos experimentais.

Apesar da relação temática, esses artigos não necessariamente estudam o consumo de água morna com limão como intervenção.

Portanto, eles não devem ser apresentados como evidências diretas da afirmação.

---

## 9. Estrutura da Resposta

O backend deve retornar informações suficientes para que o frontend apresente o resultado da análise.

Exemplo:

```json
{
  "origem": "camada_2",
  "classificacao": "falsa",
  "explicacao": "Explicação da análise.",
  "evidencias": [
    {
      "id": "pmid-123456",
      "titulo": "Título do artigo",
      "fonte": "Nome da revista",
      "data": "2025",
      "url": "https://...",
      "tipo": "pubmed"
    }
  ]
}
```

Quando nenhuma evidência direta for encontrada:

```json
{
  "origem": "camada_2",
  "classificacao": "não verificável",
  "explicacao": "Não foram encontradas evidências diretas suficientes.",
  "evidencias": []
}
```

---

## 10. Estrutura do Backend

```text
server/
├── routes/
│   └── verify.js
├── services/
│   ├── googleFactCheck.js
│   ├── pubmed.js
│   ├── groq.js
│   ├── cache.js
│   └── rateLimiter.js
└── index.js
```

### googleFactCheck.js

Responsável pelas consultas ao Google Fact Check.

### pubmed.js

Responsável pela busca e recuperação de artigos científicos.

### groq.js

Responsável pela análise semântica, avaliação de evidências e classificação.

### cache.js

Responsável pelo armazenamento temporário dos resultados.

### rateLimiter.js

Responsável pelo controle local das requisições.

### verify.js

Responsável por coordenar o fluxo de verificação.

---

## 11. Cache

O sistema utiliza cache para evitar chamadas repetidas às APIs externas.

As principais fontes que utilizam cache são:

- Google Fact Check;
- PubMed;
- Groq.

As afirmações são normalizadas antes de serem utilizadas como chave de cache.

O cache possui tempo de expiração e pode utilizar versões diferentes das chaves para invalidar resultados antigos após alterações importantes na implementação.

---

## 12. Controle de Requisições

O sistema utiliza limitadores locais para controlar a quantidade de chamadas realizadas às APIs.

O objetivo é:

- evitar excesso de requisições;
- reduzir erros HTTP 429;
- respeitar limites das APIs;
- reduzir custos;
- aumentar a estabilidade do sistema.

Quando uma API estiver temporariamente indisponível, o sistema deve tratar a situação sem interromper desnecessariamente todo o processo.

---

## 13. Tratamento de Erros

O sistema deve tratar:

- APIs indisponíveis;
- erros HTTP;
- limites de requisições;
- ausência de resultados;
- respostas inválidas;
- falhas de interpretação;
- erros temporários do modelo.

Quando uma fonte não estiver disponível, as demais camadas devem ser utilizadas quando possível.

Caso nenhuma evidência adequada esteja disponível, o sistema deve retornar uma resposta válida sem inventar fontes.

---

## 14. Critérios de Aceitação

O MVP será considerado funcional quando:

- o usuário conseguir enviar uma afirmação;
- o backend conseguir processá-la;
- o Google Fact Check for consultado;
- o PubMed for utilizado quando necessário;
- artigos irrelevantes não forem apresentados como evidências;
- evidências indiretas forem descartadas da resposta final;
- a afirmação receber uma classificação;
- as fontes adequadas forem apresentadas;
- falhas de APIs forem tratadas;
- as chaves de API não forem expostas;
- o frontend conseguir apresentar o resultado retornado pelo backend.

---

## 15. Evolução da Arquitetura

A arquitetura poderá futuramente incorporar:

- embeddings;
- banco vetorial;
- RAG semântico;
- análise de imagens;
- OCR;
- análise de vídeos;
- transcrição de áudio;
- modelos especializados;
- monitoramento;
- MLOps.

Essas funcionalidades não fazem parte do núcleo atual do MVP.