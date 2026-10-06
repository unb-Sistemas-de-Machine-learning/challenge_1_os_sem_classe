# MedFact — Escopo do Projeto

## 1. Visão Geral

O MedFact é um sistema inteligente de verificação de desinformação em saúde.

O sistema recebe uma afirmação fornecida pelo usuário e realiza uma análise em múltiplas camadas, buscando evidências em fontes externas antes de produzir uma classificação.

O fluxo principal do sistema é:

Usuário
→ Google Fact Check
→ PubMed
→ avaliação de relevância
→ avaliação de evidência
→ Groq
→ classificação
→ resposta ao usuário

O projeto utiliza recuperação de informações externas para fornecer contexto ao modelo de linguagem. Essa abordagem é semelhante a um sistema RAG, porém a implementação atual não utiliza banco vetorial, embeddings ou busca semântica baseada em vetores.

O sistema atual é, portanto, melhor caracterizado como um pipeline inteligente de recuperação e análise de evidências.

---

## 2. Problema

A circulação de informações falsas, enganosas ou fora de contexto relacionadas à saúde pode influenciar decisões individuais e coletivas.

Afirmações relacionadas a vacinação, doenças, tratamentos, medicamentos, alimentação e outros temas médicos podem apresentar diferentes níveis de veracidade e podem exigir fontes especializadas para serem avaliadas.

O MedFact busca auxiliar o usuário nesse processo por meio da recuperação automática de verificações existentes e de literatura científica.

---

## 3. Objetivo Geral

Desenvolver um sistema capaz de analisar afirmações relacionadas à saúde, recuperar evidências relevantes e classificá-las como:

- verdadeira;
- falsa;
- enganosa;
- não verificável.

A classificação deve ser acompanhada das evidências utilizadas quando existirem fontes adequadas.

---

## 4. Objetivos Específicos

O sistema deve:

1. receber uma afirmação textual do usuário;
2. consultar bases externas de informação;
3. verificar se a afirmação já foi analisada por organizações de checagem;
4. recuperar literatura científica relacionada à afirmação;
5. avaliar a relevância dos artigos encontrados;
6. avaliar se os artigos realmente constituem evidência para a afirmação;
7. diferenciar evidência direta, evidência indireta e ausência de evidência;
8. utilizar um modelo de linguagem para realizar a classificação;
9. apresentar uma explicação simples ao usuário;
10. apresentar as fontes utilizadas na análise;
11. evitar apresentar resultados apenas por semelhança de palavras;
12. manter mecanismos de cache e controle de requisições;
13. permitir a avaliação do sistema utilizando um conjunto de dados de referência.

---

## 5. Escopo do MVP

A versão atual do MVP concentra-se na análise de afirmações textuais.

O fluxo principal recebe um texto e executa:

1. normalização da afirmação;
2. consulta ao Google Fact Check;
3. análise das checagens encontradas;
4. caso não exista uma checagem adequada, consulta ao PubMed;
5. recuperação de artigos científicos;
6. ranking inicial por relevância;
7. filtragem semântica;
8. avaliação da relação entre os artigos e a afirmação;
9. seleção somente de evidências diretas;
10. classificação da afirmação pelo Groq;
11. geração da resposta final.

A implementação futura poderá expandir o sistema para imagens, vídeos e áudios.

---

## 6. Camada de Fact Check

A primeira camada de análise utiliza a API do Google Fact Check Tools.

Seu objetivo é verificar se a afirmação enviada pelo usuário já foi analisada por alguma organização de checagem de fatos.

Quando uma checagem adequada é encontrada, o sistema pode retornar as informações dessa checagem diretamente ao usuário.

As informações podem incluir:

- afirmação analisada;
- título da checagem;
- organização responsável;
- classificação textual utilizada pela organização;
- data da revisão;
- URL da checagem.

A classificação fornecida pela organização deve ser preservada como originalmente apresentada pela fonte.

O sistema não deve reinterpretar automaticamente uma classificação externa como sendo uma classificação própria do MedFact.

Por exemplo, uma organização pode utilizar classificações como:

- verdadeiro;
- falso;
- enganoso;
- parcialmente verdadeiro;
- fora de contexto.

Essas classificações pertencem à organização responsável pela checagem e devem ser apresentadas como resultado da fonte.

---

## 7. Camada de Evidências Científicas

Quando nenhuma checagem adequada é encontrada no Google Fact Check, o sistema consulta o PubMed.

O PubMed é utilizado como fonte de literatura científica para auxiliar na análise da afirmação.

O processo atual envolve:

1. identificação de conceitos médicos;
2. construção de consultas biomédicas;
3. utilização de termos MeSH quando apropriado;
4. realização de consultas no PubMed;
5. recuperação de PMIDs;
6. remoção de duplicatas;
7. recuperação dos dados dos artigos;
8. ranking inicial por relevância;
9. seleção de candidatos;
10. filtragem semântica;
11. avaliação da evidência;
12. retorno apenas das evidências consideradas diretas.

---

## 8. Relevância e Evidência

O sistema diferencia dois conceitos importantes.

### 8.1 Relevância

A avaliação de relevância responde à pergunta:

"Este artigo possui relação suficiente com a afirmação para ser analisado?"

Um artigo pode ser semanticamente relevante sem fornecer evidência direta para a afirmação.

### 8.2 Evidência

A avaliação de evidência responde à pergunta:

"Este artigo realmente fornece evidência utilizável para avaliar a afirmação?"

Essa segunda etapa é necessária porque a simples presença das mesmas palavras no artigo não significa que o artigo sustente a afirmação.

---

## 9. Tipos de Evidência

Cada artigo analisado pode ser classificado internamente como:

- direta;
- indireta;
- não evidência.

### 9.1 Evidência direta

Uma evidência é considerada direta quando o artigo apresenta uma relação suficientemente próxima entre a intervenção ou exposição da afirmação e o resultado analisado.

Para ser considerada direta, a evidência deve, de forma geral:

1. abordar a intervenção ou exposição apresentada na afirmação;
2. abordar o resultado mencionado;
3. permitir avaliar a relação entre os dois;
4. possuir metodologia compatível com a conclusão que está sendo analisada.

### 9.2 Evidência indireta

Uma evidência é indireta quando existe alguma relação científica com a afirmação, mas o estudo não testa diretamente aquilo que foi afirmado.

Exemplos:

- estudo com extrato de uma substância quando a afirmação trata do alimento inteiro;
- estudo com composto isolado quando a afirmação trata do consumo do alimento;
- estudo em células quando a afirmação trata de tratamento em humanos;
- estudo em animais quando a afirmação trata de eficácia clínica em humanos;
- estudo sobre mecanismo biológico sem avaliar o resultado afirmado.

Evidências indiretas não devem ser apresentadas como evidências diretas ao usuário.

### 9.3 Não evidência

Um artigo é considerado não evidência quando não fornece informações suficientes para avaliar a afirmação.

Nesse caso, o artigo deve ser descartado da resposta final.

---

## 10. Critério de Correspondência

A correspondência entre o artigo e a afirmação deve considerar o significado da afirmação e não somente palavras compartilhadas.

A busca por palavras-chave é utilizada para encontrar candidatos.

Ela não é suficiente para determinar que um artigo é evidência.

Por exemplo, uma afirmação como:

"Beber água morna com limão cura câncer."

pode retornar artigos sobre:

- câncer;
- limão;
- compostos cítricos;
- extratos de limão;
- nanovesículas derivadas de limão;
- atividade anticâncer em células.

Esses artigos possuem relação temática com a afirmação, mas isso não significa que demonstrem que beber água morna com limão cura câncer.

Portanto, eles não devem ser apresentados como evidências diretas da afirmação.

---

## 11. Exemplo de Validação de Evidência

Para a afirmação:

"Beber água morna com limão cura câncer?"

o PubMed pode retornar estudos relacionados a:

- nanovesículas derivadas de limão;
- extratos de cítricos;
- compostos derivados de frutas cítricas;
- modelos experimentais de câncer.

Esses resultados podem ser relevantes para uma análise científica mais ampla, mas não correspondem diretamente à intervenção apresentada na afirmação.

O sistema deve classificá-los como evidências indiretas ou não evidências e removê-los da lista final de evidências.

Se nenhuma evidência direta for encontrada, o sistema deve retornar zero evidências científicas diretas.

Isso evita que o usuário interprete uma relação temática como comprovação científica.

---

## 12. Classificação da Afirmação

Após a recuperação e avaliação das evidências, o sistema utiliza o modelo de linguagem Groq para classificar a afirmação.

As categorias utilizadas pelo MedFact são:

- verdadeira;
- falsa;
- enganosa;
- não verificável.

### 12.1 Verdadeira

A afirmação é considerada verdadeira quando as informações disponíveis sustentam seu conteúdo principal.

### 12.2 Falsa

A afirmação é considerada falsa quando as evidências ou o conhecimento científico disponível contradizem seu conteúdo.

### 12.3 Enganosa

A afirmação é considerada enganosa quando apresenta uma informação que possui algum elemento verdadeiro, mas utiliza generalizações, omissões, exageros ou contexto inadequado que podem levar a uma interpretação incorreta.

### 12.4 Não verificável

A classificação é utilizada quando não existem informações suficientes para confirmar ou refutar adequadamente a afirmação.

A ausência de evidência direta não significa automaticamente que a afirmação seja falsa.

---

## 13. Uso do Groq

O Groq é utilizado como camada de interpretação e classificação.

O modelo recebe:

- a afirmação original;
- as evidências consideradas válidas;
- informações necessárias para a análise.

O modelo pode realizar:

- filtragem semântica;
- avaliação da evidência;
- classificação;
- geração de explicação.

O modelo não deve considerar automaticamente qualquer artigo recuperado pelo PubMed como evidência.

A arquitetura separa explicitamente:

- recuperação;
- relevância;
- evidência;
- classificação.

---

## 14. Conhecimento Geral

Quando não existem evidências diretas suficientes, o modelo ainda pode utilizar conhecimento científico geral para realizar a classificação.

Esse comportamento é necessário porque uma ausência de evidência recuperada não significa necessariamente ausência de conhecimento científico sobre determinado assunto.

Entretanto, quando a resposta for baseada principalmente em conhecimento geral, o sistema deve evitar apresentar artigos não relacionados diretamente como se fossem comprovação da classificação.

---

## 15. Estrutura das Evidências

As evidências retornadas pelo backend possuem estrutura semelhante a:

```json
{
  "id": "pmid-123456",
  "titulo": "Título do artigo",
  "texto": "Resumo ou conteúdo utilizado na análise",
  "fonte": "Nome da revista ou fonte",
  "data": "2025",
  "url": "https://...",
  "tipo": "pubmed"
}