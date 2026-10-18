from typing import List, Optional
from pydantic import BaseModel, Field

class VerifyRequest(BaseModel):
    texto: str = Field(..., min_length=5, description="Afirmação ou claim de saúde enviada pelo usuário")

class EvidenciaItem(BaseModel):
    id: Optional[str] = None
    titulo: str = Field(..., description="Título do artigo científico ou checagem")
    fonte: Optional[str] = Field("PubMed / NCBI", description="Fonte da evidência")
    revista: Optional[str] = Field(None, description="Revista científica ou agência")
    journal: Optional[str] = Field(None, description="Nome alternativo do periódico")
    data: Optional[str] = Field(None, description="Ano ou data de publicação")
    classificacao: Optional[str] = Field(None, description="Resultado ou força da evidência")
    url: Optional[str] = Field(None, description="Link direto para o artigo ou checagem")
    resumo: Optional[str] = Field(None, description="Resumo ou abstract do estudo")
    relevancia_score: Optional[float] = Field(None, description="Score de similaridade semântica ML")

class VerifyResponse(BaseModel):
    origem: str = Field(..., description="'camada_1' (Fact Check) ou 'camada_2' (Análise ML + PubMed)")
    probabilidade_desinformacao: int = Field(..., ge=0, le=100, description="Probabilidade estimada de desinformação (0 a 100)")
    classificacao: str = Field(..., description="falsa, verdadeira, enganosa ou não verificável")
    tipo: str = Field(..., description="Mecanismo da desinformação (ex: alegação sem evidência, exagero)")
    tema: str = Field(..., description="Tema identificado: vacinação, COVID-19 ou doenças crônicas")
    nivel_risco: str = Field(..., description="Nível de risco de dano: alto, médio ou baixo")
    explicacao: str = Field(..., description="Explicação clara, empática e acessível adaptada para idosos")
    trecho_suspeito: Optional[str] = Field(None, description="Trecho suspeito identificado na alegação")
    evidencias: List[EvidenciaItem] = Field(default_factory=list, description="Artigos e estudos científicos que embasam a análise")
    agencia: Optional[str] = Field(None, description="Agência de checagem caso venha da Camada 1")
    url: Optional[str] = Field(None, description="Link da checagem externa da Camada 1")
    latencia_ms: Optional[float] = Field(None, description="Tempo total de processamento em milissegundos")

class UserFeedbackRequest(BaseModel):
    claim_text: str
    compreendeu: bool
    achou_util: bool
    comentario: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    servico: str
    versao: str
    banco_dados: bool
    artigos_indexados: int
    modelo_ml_carregado: bool

class PubMedIngestRequest(BaseModel):
    query: str
    tema: str
    max_results: int = 5
