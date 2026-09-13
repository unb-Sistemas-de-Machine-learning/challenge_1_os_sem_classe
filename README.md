# challenge_1_os_sem_classe
Challenge 1 - Equipe Os sem classe - Sistemas de Machine Learning 2026/02
# MedFact

Detector de desinformação em saúde para idosos. O usuário envia uma mensagem de texto sobre **vacinação, COVID-19 ou doenças crônicas**, e o sistema responde se a afirmação é verdadeira, falsa ou enganosa — com explicação em linguagem simples e evidências de apoio, em vez de só um rótulo "fake news".

## Sobre o projeto

Hoje, quem recebe uma informação duvidosa de saúde precisa pesquisar manualmente em várias fontes pra descobrir se ela é verdadeira. O MedFact serve como primeiro ponto de verificação: o usuário manda a claim, o sistema analisa e devolve uma classificação fundamentada, com o objetivo de que a pessoa desenvolva com o tempo mais capacidade própria de avaliar informação de saúde.

Documentação completa do projeto:
- **Escopo, requisitos e arquitetura** — visão de negócio, objetivo de ML, datasets e requisitos funcionais/não-funcionais
- **Tutorial de implementação** — passo a passo de como o backend e o front-end foram construídos
- **Issues pendentes** — o que falta pra fechar a arquitetura completa

## Como funciona

O fluxo tem duas camadas:

1. **Camada 1 — verificação rápida:** consulta a Google Fact Check Tools API. Se alguma agência de checagem (ex: Aos Fatos, Lupa) já tiver publicado uma checagem sobre a claim, o sistema responde direto citando essa fonte.
2. **Camada 2 — análise completa:** roda só se a camada 1 não encontrar nada. O texto passa por busca de evidências (PubMed) e é classificado (veracidade, tipo de desinformação, nível de risco) via LLM (Groq), que também gera a explicação final.

```
Usuário envia texto
        │
        ▼
Google Fact Check API  ──── encontrou ────▶  Resposta pronta (cita a agência)
        │
   não encontrou
        │
        ▼
Busca de evidências (PubMed) + Classificação (Groq)
        │
        ▼
Resposta estruturada (classificação, tipo, risco, explicação, evidências)
```

## Tecnologias

- **Backend:** Node.js + Express
- **Frontend:** React
- **APIs externas:** Google Fact Check Tools API, Groq (LLM), PubMed E-utilities

## Estrutura do projeto

```
medfact/
  server/              # backend (Node/Express)
    services/          # integração com cada API + cache + limitador de taxa
    routes/             # rota /api/verify (orquestra as duas camadas)
    scripts/            # script de validação contra o PUBHEALTH
    .env                # chaves de API (não versionado)
  client/               # frontend (React)
    src/App.js          # interface de verificação
```

## Como rodar o projeto

### Pré-requisitos
- Node.js 18 ou mais recente
- Chaves de API: [Groq](https://console.groq.com), [Google Fact Check Tools API](https://console.cloud.google.com) e [PubMed/NCBI](https://www.ncbi.nlm.nih.gov/account/) (opcional, mas recomendado)

### Backend

```bash
cd medfact/server
npm install
```

Crie um `.env` dentro de `server/` com:
```
GOOGLE_FACTCHECK_KEY=sua_chave
GROQ_API_KEY=sua_chave
PUBMED_API_KEY=sua_chave
PORT=3001
```

Rode:
```bash
node index.js
```

O servidor sobe em `http://localhost:3001`.

### Frontend

Em outro terminal:
```bash
cd medfact/client
npm install
npm start
```

Abre automaticamente em `http://localhost:3000`. **O backend precisa estar rodando ao mesmo tempo** — o front-end chama `http://localhost:3001/api/verify`.

## Endpoint principal

`POST /api/verify`

**Corpo da requisição:**
```json
{ "texto": "Vacina contra gripe causa Alzheimer" }
```

**Resposta (exemplo, camada 2):**
```json
{
  "origem": "camada_2",
  "probabilidade_desinformacao": 90,
  "classificacao": "falsa",
  "tipo": "alegação sem evidência",
  "tema": "vacinação",
  "nivel_risco": "alto",
  "explicacao": "Não há nenhum estudo científico que mostre que a vacina contra a gripe cause Alzheimer...",
  "trecho_suspeito": "Vacina contra gripe causa Alzheimer",
  "evidencias": []
}
```

## Status atual

O MVP funciona de ponta a ponta (camada 1 → camada 2 → resposta estruturada no front-end), mas ainda tem lacunas conhecidas antes de ser considerado completo em relação ao escopo — veja o documento de issues pendentes para a lista detalhada. Os pontos mais importantes em aberto agora:
- Busca do PubMed ainda não retorna evidência de forma confiável (query em português)
- Validação de F1 contra o PUBHEALTH ainda não foi rodada — a qualidade real da classificação via Groq (sem treino) ainda não tem número
- Projeto ainda não tem deploy — só roda localmente

## Licença

Projeto acadêmico (TEES).
