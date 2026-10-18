import httpx
from typing import Optional, Dict, Any
from ..config import settings

class FactCheckService:
    def __init__(self):
        self.api_key = settings.GOOGLE_FACTCHECK_KEY
        self.endpoint = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

    async def consultar_checagem(self, texto: str) -> Optional[Dict[str, Any]]:
        """
        Queries Google Fact Check Tools API (Camada 1).
        Returns structured fact-check info if an existing review is found.
        """
        if not self.api_key:
            return None

        params = {
            "query": texto,
            "languageCode": "pt-BR",
            "key": self.api_key
        }

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(self.endpoint, params=params)
                if res.status_code != 200:
                    return None

                data = res.json()
                claims = data.get("claims", [])
                if not claims:
                    return None

                first_claim = claims[0]
                reviews = first_claim.get("claimReview", [])
                if not reviews:
                    return None

                first_review = reviews[0]
                agencia = first_review.get("publisher", {}).get("name", "Agência de Checagem")
                url = first_review.get("url", "")
                rating = first_review.get("textualRating", "Falso")
                title = first_claim.get("text", texto)

                # Classify standard veracity from review text
                rating_lower = rating.lower()
                if any(w in rating_lower for w in ["falso", "fake", "mentira", "incorreto"]):
                    classificacao = "falsa"
                    probabilidade = 95
                    risco = "alto"
                elif any(w in rating_lower for w in ["verdadeiro", "fato", "correto"]):
                    classificacao = "verdadeira"
                    probabilidade = 10
                    risco = "baixo"
                elif any(w in rating_lower for w in ["distorcido", "enganoso", "impreciso", "exagero", "fora de contexto"]):
                    classificacao = "enganosa"
                    probabilidade = 80
                    risco = "médio"
                else:
                    classificacao = "não verificável"
                    probabilidade = 50
                    risco = "médio"

                return {
                    "origem": "camada_1",
                    "agencia": agencia,
                    "url": url,
                    "classificacao": classificacao,
                    "probabilidade_desinformacao": probabilidade,
                    "nivel_risco": risco,
                    "tipo": "checagem jornalística oficial",
                    "explicacao": f"Essa afirmação já foi investigada e checada por jornalistas da agência {agencia}. A classificação atribuída foi '{rating}'.",
                    "evidencias": [
                        {
                            "id": "factcheck-1",
                            "titulo": title,
                            "fonte": agencia,
                            "revista": agencia,
                            "classificacao": rating,
                            "url": url,
                            "resumo": f"Checagem realizada por {agencia}."
                        }
                    ]
                }
        except Exception as e:
            print(f"Aviso ao consultar Google Fact Check API: {e}")
            return None

fact_check_service = FactCheckService()
