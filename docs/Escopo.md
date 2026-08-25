# MedFact
## Detector de desinformação em saúde para idosos

A partir de uma mensagem de texto enviada ao chatbot, o sistema verifica se uma afirmação sobre **vacinação, COVID-19 ou doenças crônicas** é verdadeira, falsa ou enganosa — com foco no público idoso.

---

## Escopo

Reduzimos o escopo original (multimodal, qualquer tema de saúde) para um recorte mais viável de MVP:

| Antes | Agora |
|---|---|
| Texto, link, imagem, vídeo, áudio | Somente **texto** |
| Qualquer tema de saúde | **3 temas**: Vacinação · COVID-19 · Doenças crônicas |
| Público geral | Foco em **idosos** |

Por que esses 3 temas: são os que reúnem mais evidência de vulnerabilidade em idosos e mais dados prontos para treino/validação (ver seção de Datasets). Vacinação e COVID concentram a maior parte da desinformação de saúde já estudada no Brasil; doenças crônicas (câncer, diabetes, hipertensão) é onde o risco de dano direto é maior — abandono de tratamento por acreditar em "cura milagrosa".

---

## Entrada

- Texto (mensagem enviada pelo usuário)

## Análise

- NLP para interpretar a afirmação
- Busca de evidências em bases científicas / fact-checking
- Classificador de desinformação (veracidade, tipo, risco)

## Saída

Em vez de simplesmente:

> ❌ Fake News

o sistema retorna:

> **Probabilidade de desinformação: 87%**
>
> **Classificação:** Enganosa
>
> **Tema:** Vacinação
>
> **Nível de risco:** Alto
>
> **Evidências encontradas:**
> - Estudo X contradiz a afirmação.
> - Organização Y apresenta dados diferentes.
>
> **Trechos suspeitos:**
>
> "A vacina causa..." ← afirmação sem evidência científica.

---

## Tipo de desinformação

Não classificar simplesmente verdadeiro/falso, mas identificar o **mecanismo**:

| Tipo | Exemplo |
| --- | --- |
| Informação falsa | "A vacina X contém vírus vivo." |
| Informação verdadeira fora de contexto | Estudo antigo apresentado como atual |
| Exagero | "Remédio X cura 100% dos casos" |
| Informação parcialmente verdadeira | Mistura de fatos verdadeiros e falsos |
| Fonte falsa | Site imitando um portal conhecido |
| Estatística manipulada | Número ou dado distorcido |
| Alegação sem evidência | Afirmação sem estudo confiável |

*(Removemos "imagem fora de contexto" e "conteúdo manipulado por IA" da lista original — eram específicos de entrada visual, que saiu do escopo.)*

---

## Datasets

Como o escopo agora é texto + 3 temas, a base de treino/validação fica assim:

| Fase | Tema | Dataset | Uso |
|---|---|---|---|
| 1 | COVID-19 | **COVID19.BR** | 11.382 mensagens de WhatsApp em PT-BR rotuladas (jan/2020–fev/2021) — treino/classificação |
| 1 | Vacinação | **WhaVax** | Discurso sobre vacina em WhatsApp PT-BR, anotado por especialistas — desinformação sobre vacinas |
| 1 | Vacinação | **ANTiVax** | 15k tweets sobre vacina COVID, ~5.7k rotulados como desinformação — aumenta volume de exemplos |
| 1 | Geral (evidências) | **PUBHEALTH** | 11.8k claims de saúde com explicação padrão-ouro — fact-checking + evidências prontas |
| 2 | Doenças crônicas | **Monant Medical Misinformation** / **HealthLies** | Câncer, diabetes, doenças crônicas em geral |
| 2 | Geral (PT-BR) | **Central de Fatos** | 11.6k checagens de 6 agências brasileiras — complementa dados em português |

**Ponto de atenção para a fase de dados:** os datasets têm esquemas de rótulo diferentes (COVID19.BR é binário; PUBHEALTH tem 4 classes: true/false/mixture/unproven; Central de Fatos varia por agência). Antes de unificar, é preciso um passo de **padronização de rótulos** — isso deve entrar como tarefa própria no cronograma, não como algo automático.

**Abordagem de modelo:** não vale criar um LLM do zero — os dados disponíveis não sustentam isso. Caminho viável: RAG + LLM existente para gerar a explicação e buscar evidência (PUBHEALTH já ajuda aqui), combinado com um classificador leve fine-tunado (ex: BERTimbau) para as três tarefas estruturadas (veracidade, tipo, risco), treinado nos datasets acima.

---

## Guiding Questions
(Legenda: 🟩 Responda já · 🟦 Planejar · 🟪 Se sobrar tempo · 🟥 Cortar)

**Dados**
- Quais os sites mais confiáveis sobre saúde que servem como base científica? 🟩
- Existem informações sensíveis que o chatbot não pode acessar? 🟦
- O chatbot precisa consultar dados em tempo real? 🟩

**Usuário**
- Quais são os principais usuários do chatbot? 🟪
- Como saber se o chatbot realmente resolveu o problema do usuário? 🟦
- Como saber se o chatbot entendeu a pergunta do usuário? 🟩

**Modelo**
- Qual tipo de modelo de IA atende melhor a necessidade do chatbot? 🟦
- O modelo precisa ser treinado ou acessa uma base de conhecimento? 🟩
- Qual o equilíbrio entre qualidade da resposta, velocidade e custo? 🟪

**Produção**
- Quantos usuários podem ser acessados simultaneamente? 🟪
- Como atualizar as informações que o chatbot utiliza? 🟦
- Qual seria o MVP que já resolve o problema? 🟩

**Ética**
- Como evitar que o chatbot gere respostas preconceituosas ou discriminatórias? 🟥
- Como garantir a privacidade do usuário? 🟦
- Como evitar que o usuário apresente uma informação falsa com muita confiança? 🟦

---

## Objetivo de Negócio

Reduzir o impacto da desinformação sobre saúde entre idosos, oferecendo uma ferramenta acessível que analisa uma mensagem de texto sobre vacinação, COVID-19 ou doenças crônicas e apresenta uma avaliação baseada em evidências científicas — indicando confiabilidade, tipo de desinformação e o motivo da classificação.

**Antes:** Recebe uma informação → não sabe se é verdadeira → pesquisa em várias fontes → dificuldade para avaliar as evidências → pode compartilhar uma informação falsa.

**Depois:** Recebe uma informação → envia para o MedFact → sistema analisa o texto → apresenta classificação, nível de risco e evidências → usuário toma uma decisão mais informada.

O sistema não só classifica — explica o motivo, para que o usuário desenvolva capacidade própria de avaliar informações de saúde.

### Como medir o impacto

1. **Taxa de identificação correta** — F1-score do classificador frente a conteúdos já classificados por especialistas. Meta de exemplo: F1 ≥ 80% no conjunto de validação do MVP.
2. **Taxa de respostas fundamentadas** — % de análises com pelo menos uma evidência científica verificável.
3. **Compreensão do usuário** — % de usuários que, após usar o MedFact, identificam corretamente se um conteúdo é confiável, enganoso ou falso (teste antes/depois).
4. **Redução do tempo de verificação** — tempo médio para concluir sobre uma informação, manualmente vs. com o MedFact.
5. **Utilidade percebida** — % de usuários que consideram a análise útil para decidir se confiam ou compartilham o conteúdo.

*(A métrica de "cobertura multimodal" saiu — não se aplica mais, já que a entrada é só texto.)*

**Indicador principal do MVP:** percentual de idosos que, após usar o MedFact, conseguem identificar corretamente desinformação em saúde e compreender os motivos apresentados pela ferramenta.

---

## Objetivo de ML

| Objetivo de ML | O que o modelo prevê | Métrica principal |
| --- | --- | --- |
| Detectar desinformação | Verdadeiro, falso ou enganoso | F1-score (macro) |
| Identificar o tipo de desinformação | Exagero, fora de contexto, fonte falsa, etc. | F1-score (macro) |
| Classificar o risco | Baixo, médio ou alto | F1-score ponderado / Kappa quadrático |

**Notas sobre a métrica**, a partir da discussão sobre viabilidade do F1:

- Usar **F1 macro**, não micro — os tipos de desinformação não vão aparecer de forma balanceada nos dados.
- **Risco é ordinal** (baixo/médio/alto): um erro que confunde baixo com alto é pior que confundir baixo com médio. F1 tradicional não captura essa distância — vale complementar com Kappa quadrático ponderado.
- Reportar separadamente o **recall da classe "falso/enganoso"** como métrica de segurança: deixar passar uma desinformação perigosa como confiável (falso negativo) é mais grave que o oposto.
- F1 mede o classificador, não o sistema inteiro. O componente de evidências (PUBHEALTH/RAG) precisa de métrica própria — precision@k ou recall@k da recuperação. E "compreensão do usuário" (métrica 3 acima) só se mede com teste de usuário, não com F1.

**Objetivo geral de ML:** identificar, classificar e avaliar o risco de desinformação sobre vacinação, COVID-19 e doenças crônicas em textos direcionados ao público idoso.