# MedFact
## Detector multimodal de desinformação

Em vez de aceitar somente texto, o sistema analisa diferentes modalidades:

**Entrada**

- Texto
- Link
- Imagem
- Vídeo
- Áudio

**Análise**

- NLP para analisar o texto
- OCR para extrair texto de imagens
- Visão computacional para identificar manipulações
- Speech-to-text para áudio/vídeo
- Busca de evidências em bases científicas
- Classificador de desinformação

**Saída**

Em vez de simplesmente:

> ❌ Fake News
> 

o sistema poderia retornar algo como:

> **Probabilidade de desinformação: 87%**
> 
> 
> **Classificação:** Enganosa
> 
> **Tema:** Vacinação
> 
> **Nível de risco:** Alto
> 
> **Evidências encontradas:**
> 
> - Estudo X contradiz a afirmação.
> - Organização Y apresenta dados diferentes.
> - A imagem utilizada foi originalmente publicada em outro contexto.
> 
> **Trechos suspeitos:**
> 
> "A vacina causa..." ← afirmação sem evidência científica.
> 

---

## Fazer o sistema detectar o tipo de desinformação

Não classificar simplesmente:

> verdadeiro / falso
> 

Mas identificar **qual é o mecanismo da desinformação**.

Por exemplo:

| Tipo | Exemplo |
| --- | --- |
| Informação falsa | "A vacina X contém vírus vivo." |
| Informação verdadeira fora de contexto | Estudo antigo apresentado como atual |
| Exagero | "Remédio X cura 100% dos casos" |
| Informação parcialmente verdadeira | Mistura de fatos verdadeiros e falsos |
| Fonte falsa | Site imitando um portal conhecido |
| Estatística manipulada | Gráfico enganoso |
| Imagem fora de contexto | Foto real associada a outro acontecimento |
| Conteúdo manipulado | Imagem alterada por IA |
| Alegação sem evidência | Afirmação sem estudo confiável |

## Guiding Questions
(Legenda:  
🟩​​Responda já
​🟦 Planejar
​🟪​ Se sobrar tempo
🟥​ Cortar)
Guidind questions:

•Dados:
-Quais os sites mais confiáveis sobre saúde que servem como base científica?🟩
-Existem informações sensíveis que o chat bot não pode acessar🟦
-O chatbot precisa consultar dados em tempo real?🟩

•Usuário:
-Quais são os principais usuários do chatbot?​🟪​
-Como saber se o chatbot realmente resolveu o problema do usuário?🟦
-Como saber se o chatbot entendeu a pergunta do usuário?🟩

•Modelo:
-Quais os tipo de modelo de ia atende melhor a necessidade do chatbot?🟦
-Modelo precisa ser treinado ou ele acessa uma base de conhecimento?🟩
-Qual o equilíbrio entre qualidade da resposta, velocidade e custo?​🟪​

•Produção:
-Quantos usuários podem ser acessados simultaneamente?​🟪​
-Como atualizar as informações que o chatbot utiliza?🟦
-Qual seria o MVP que já resolve problema?🟩

•Ética:
-Como evitar que o chatbot gere respostas preconceituosas ou discriminatórias🟥​
-Como garantir a privacidade do usuário?🟦
-Como evitar que o usuário apresente uma informação falsa com muita confiança🟦

## Objetivo de Negócio

Reduzir o impacto da desinformação sobre saúde na população, oferecendo uma ferramenta acessível capaz de analisar diferentes tipos de conteúdo — texto, links, imagens, vídeos e áudios — e apresentar ao usuário uma avaliação baseada em evidências científicas, indicando o nível de confiabilidade, o tipo de desinformação identificado e as evidências que sustentam a análise.

O que muda para a nossa audiência?

Atualmente, uma pessoa que recebe uma informação duvidosa sobre saúde precisa pesquisar manualmente diferentes fontes para descobrir se aquela informação é verdadeira, parcialmente verdadeira ou enganosa.

Com o MedFact, o usuário passa a ter um primeiro ponto de verificação antes de acreditar ou compartilhar uma informação.

A mudança esperada é:

Antes:

Recebe uma informação → não sabe se é verdadeira → pesquisa em várias fontes → dificuldade para avaliar as evidências → pode compartilhar uma informação falsa.

Depois:

Recebe uma informação → envia para o MedFact → sistema analisa o conteúdo → apresenta classificação, nível de risco, trechos suspeitos e evidências → usuário consegue tomar uma decisão mais informada.

Além de dizer se uma informação é confiável ou não, o sistema deve explicar o motivo da classificação, permitindo que o usuário desenvolva maior capacidade de avaliar informações de saúde por conta própria.

### Como medir o impacto?

• 1. Taxa de identificação correta

Avaliar a capacidade do sistema de identificar corretamente conteúdos previamente classificados por especialistas.

Métrica:
Acurácia/F1-score do classificador.
Precisão na identificação dos diferentes tipos de desinformação.

Exemplo de meta:
Atingir F1-score ≥ 80% no conjunto de validação do MVP.

• 2. Taxa de respostas fundamentadas

Medir quantas análises apresentadas pelo sistema possuem evidências confiáveis que sustentam a conclusão.

Métrica:
% de respostas que apresentam pelo menos uma evidência científica relevante e verificável.

• 3. Compreensão do usuário

Verificar se o usuário realmente entende a análise produzida pelo sistema.

Métrica:
% de usuários que conseguem identificar corretamente, após utilizar o MedFact, se o conteúdo analisado é confiável, enganoso ou falso.
Pode ser medido através de testes antes e depois do uso da ferramenta.

• 4. Redução do tempo de verificação

Comparar quanto tempo uma pessoa leva para verificar uma informação manualmente contra o tempo utilizando o MedFact.

Métrica:
Tempo médio necessário para chegar a uma conclusão sobre uma informação de saúde.

• 5. Utilidade percebida

Avaliar se o sistema realmente ajuda o usuário a tomar uma decisão.

Métrica:
% de usuários que consideram a análise útil para decidir se devem confiar ou compartilhar determinado conteúdo.
Pode ser coletado através de uma avaliação simples após a análise.

• 6. Cobertura multimodal

Como o diferencial do MedFact é analisar diferentes formatos, também é importante medir a capacidade de atender às diferentes entradas.

Métrica:
% de análises realizadas com sucesso para texto, links, imagens, vídeos e áudios.
Indicador principal de sucesso

Para o MVP, o principal indicador poderia ser:
Percentual de usuários que, após utilizar o MedFact, conseguem identificar corretamente conteúdos de desinformação em saúde e compreender os motivos apresentados pela ferramenta.

Isso mantém o foco no resultado para a audiência, e não apenas em métricas técnicas do sistema.

## Objetivo ML

| Objetivo de ML | O que o modelo prevê? |	Métrica
| --- | --- |--- |
| Detectar desinformação | Verdadeiro, falso ou enganoso | F1-score|
| Identificar o tipo de desinformação	| Fora de contexto, exagero, manipulação etc. | F1-score|
| Classificar o risco | Baixo, médio ou alto| F1-score|

• Resumido para apresentação
Detectar desinformação → prevê se a informação é confiável → F1-score

Classificar desinformação → prevê qual é o tipo → F1-score

Avaliar risco → prevê o nível de risco → F1-score

Objetivo geral de ML:
Identificar, classificar e avaliar o risco de desinformação em conteúdos relacionados à saúde.
