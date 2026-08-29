# MedFact
## Detector de desinformação em saúde para idosos — v3

A partir de uma mensagem de texto enviada ao chatbot, o sistema verifica se uma afirmação sobre **vacinação, COVID-19 ou doenças crônicas** é verdadeira, falsa ou enganosa — com foco no público idoso. O fluxo tem **duas camadas**: uma verificação rápida contra checagens já publicadas, e uma análise completa quando não há checagem pronta.

---

## Escopo

Reduzimos o escopo original (multimodal, qualquer tema de saúde) para um recorte mais viável de MVP:

| Antes | Agora |
|---|---|
| Texto, link, imagem, vídeo, áudio | Somente **texto** |
| Qualquer tema de saúde | **3 temas**: Vacinação · COVID-19 · Doenças crônicas |
| Público geral | Foco em **idosos** |
| Um único fluxo de análise para toda mensagem | Dois fluxos: **camada 1** (checagem já existente) e **camada 2** (análise completa) |

Por que esses 3 temas: são os que reúnem mais evidência de vulnerabilidade em idosos e mais dados prontos para treino/validação (ver seção de Datasets). Vacinação e COVID concentram a maior parte da desinformação de saúde já estudada no Brasil; doenças crônicas (câncer, diabetes, hipertensão) é onde o risco de dano direto é maior — abandono de tratamento por acreditar em "cura milagrosa".

---

## Entrada, Análise e Saída

**Entrada:** texto (mensagem enviada pelo usuário)

**Análise:**
1. **Camada 1 — verificação rápida:** consulta a Google Fact Check Tools API com a afirmação do usuário. Se já existir uma checagem publicada por uma agência (ex: Aos Fatos, Lupa) que corresponda à claim, o sistema responde direto citando essa checagem.
2. **Camada 2 — análise completa** (só roda se a camada 1 não encontrar correspondência): NLP identifica o tema → busca de evidências (PubMed API + Saúde sem Fake News/PUBHEALTH) e classificador (veracidade/tipo/risco) rodam em paralelo → Groq gera a explicação final combinando os dois.

**Saída:** em vez de simplesmente:

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
> **Origem da análise:** verificado por [agência] *(camada 1)* ou análise MedFact *(camada 2)*
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

**Ponto de atenção para a fase de dados:** os datasets têm esquemas de rótulo diferentes (COVID19.BR é binário; PUBHEALTH tem 4 classes: true/false/mixture/unproven; Central de Fatos varia por agência). Antes de unificar, é preciso um passo de **padronização de rótulos** — isso deve entrar como tarefa própria no cronograma, não como algo automático. Nenhum desses datasets rotula diretamente o "tipo" de desinformação (mecanismo) — isso provavelmente exige anotação própria, semi-automática (LLM pré-rotula, humano revisa uma amostra).

**Abordagem de modelo:** não vale criar um LLM do zero — os dados disponíveis não sustentam isso. Caminho recomendado: RAG (PubMed + Saúde sem Fake News/PUBHEALTH) + LLM existente (Groq) para gerar a explicação, combinado com um classificador leve fine-tunado (ex: BERTimbau) para as três tarefas estruturadas (veracidade, tipo, risco), treinado nos datasets acima.

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
- F1 mede o classificador, não o sistema inteiro. O componente de evidências (PubMed/RAG) precisa de métrica própria — precision@k ou recall@k da recuperação. E "compreensão do usuário" (métrica 3 acima) só se mede com teste de usuário, não com F1.

**Objetivo geral de ML:** identificar, classificar e avaliar o risco de desinformação sobre vacinação, COVID-19 e doenças crônicas em textos direcionados ao público idoso.

---

## Requisitos Funcionais

| ID | Requisito |
|---|---|
| RF1 | O sistema deve consultar a Google Fact Check Tools API (Claim Search) usando a afirmação do usuário como query, antes de qualquer outra análise. |
| RF2 | Se a camada 1 retornar uma correspondência com confiança suficiente, o sistema deve responder diretamente citando a agência de checagem original, sem acionar o classificador. |
| RF3 | Se a camada 1 não encontrar correspondência, o sistema deve seguir automaticamente para a camada 2, sem exigir nova ação do usuário. |
| RF4 | A busca de evidências deve poder consultar a API do PubMed (E-utilities) para artigos científicos relacionados ao tema identificado, sem redirecionar o usuário para fora do chat. |
| RF5 | A geração da explicação final deve usar a API da Groq como provedor de LLM. |
| RF6 | Toda resposta final deve citar explicitamente a fonte da evidência usada (agência de fact-check, artigo do PubMed, ou base Saúde sem Fake News/PUBHEALTH). |
| RF7 | Se nenhuma camada encontrar evidência suficiente, o sistema deve comunicar isso claramente ao usuário em vez de forçar uma classificação sem base. |

---

## Requisitos Não-Funcionais

| ID | Requisito | Por quê |
|---|---|---|
| RNF1 | Definir timeout e feedback visual ("verificando...") diferente para cada camada | A camada 1 é uma consulta simples e deve ser rápida; a camada 2 tem mais estágios (NLP + RAG + classificador + LLM) e pode demorar mais — o usuário precisa saber em qual etapa está. |
| RNF2 | Implementar fila e/ou cache para a chamada ao Groq | O plano gratuito da Groq tem limite de faixa de tokens por minuto — em picos de uso simultâneo, chamadas repetidas ou concorrentes podem estourar o limite. Cache de explicações para claims recorrentes reduz esse risco. |
| RNF3 | Tratar a Google Fact Check API como atalho oportunista, não como camada garantida | Ela só retorna resultado se alguma agência já publicou uma checagem com marcação ClaimReview sobre aquela claim específica. A cobertura para desinformação em saúde em português depende de quanto Aos Fatos, Lupa e outras agências brasileiras publicam nesse formato — não é seguro assumir que toda claim relevante terá correspondência. |
| RNF4 | Registrar uma API key própria para o PubMed E-utilities | Sem chave, a NCBI limita a poucas requisições por segundo; com chave registrada, o limite sobe. Isso afeta diretamente quantas buscas simultâneas a camada 2 aguenta. |
| RNF5 | Cache de queries repetidas (claims comuns) nas três APIs | Reduz custo, latência e uso de limite de taxa — especialmente relevante para desinformações que circulam repetidamente entre vários usuários. |
| RNF6 | Política clara sobre o que é enviado a terceiros (Google, Groq, PubMed) | O texto do usuário pode conter dado de saúde sensível. Antes de enviar a claim para APIs externas, deve estar claro para o usuário o que sai do sistema e para onde vai — isso conecta direto com a guiding question de privacidade já levantada acima. |
| RNF7 | Fallback quando uma das três APIs estiver fora do ar | O sistema não deve travar se Google Fact Check, PubMed ou Groq falharem — precisa de um caminho degradado (ex: responder só com a evidência disponível, ou avisar que a análise está parcial). |

---

## Arquitetura

```
Usuário envia texto
        │
        ▼
Google Fact Check API  ──── encontrou ────▶  Resposta pronta (cita a agência)
        │
   não encontrou
        │
        ▼
Pré-processamento NLP
        │
   ┌────┴────┐
   ▼         ▼
Busca de    Classificador
evidências  (veracidade/
(PubMed +    tipo/risco)
Saúde sem
Fake News)
   │         │
   └────┬────┘
        ▼
Groq: geração de explicação
        │
        ▼
Resposta estruturada
```

**Camada 1 — Google Fact Check Tools API**
Consulta rápida usando a Claim Search API. Funciona bem como filtro de primeira passada porque muitas claims de saúde que circulam em massa (ex: sobre uma vacina específica) já foram checadas por alguma agência. Quando há correspondência, o custo de responder é baixíssimo — não precisa rodar classificador nem LLM.

**Camada 2 — Análise completa**
Acionada só quando a camada 1 não resolve. NLP identifica o tema → busca de evidências (PubMed API + Saúde sem Fake News/PUBHEALTH) e classificador (BERTimbau fine-tunado) rodam em paralelo → Groq gera a explicação final combinando evidência e classificação → resposta estruturada.

**Por que separar em camadas:** evita gastar o orçamento de latência e de limite de taxa do Groq em claims que já têm resposta pronta em outro lugar. Também dá ao MedFact uma forma de citar uma fonte jornalística já estabelecida (a agência de checagem) quando ela existe, em vez de sempre depender da própria análise do sistema.

### Pipeline de treino do classificador

```
Datasets brutos (6 fontes, esquemas diferentes)
        │
        ▼
Padronização de rótulos (mapeia veracidade e tipo)
        │
        ▼
Dataset unificado (veracidade + tipo + risco + tema)
        │
   ┌────┴────┐
   ▼         ▼
Treino    Validação/teste
(80%)         (20%)
   │         │
   └────┬────┘
        ▼
Fine-tuning do classificador (BERTimbau, 3 tarefas)
        │
        ▼
Avaliação (F1 macro por classe e por tarefa)
        │
        ▼
Deploy em produção ┄┄┄▶ Revisão humana ┄┄▶ ↻ retrain periódico do dataset unificado
```

---

## Pendências para a próxima iteração

- Definir o limiar de confiança da Google Fact Check API para considerar uma correspondência "boa o suficiente" para pular a camada 2 (claims parecidas mas não idênticas podem gerar falso positivo de correspondência).
- Medir, na prática, que fração das claims dos 3 temas (vacinação, COVID, doenças crônicas) tem correspondência na Google Fact Check API — isso define o quanto a camada 1 realmente vai poupar da camada 2.
- Detalhar o mecanismo de cache mencionado no RNF2/RNF5 (o que é armazenado, por quanto tempo, chave de cache por claim normalizada).
- Escrever a tabela de mapeamento de rótulos entre os 6 datasets e definir o plano de anotação semi-automática para a coluna "tipo de desinformação".