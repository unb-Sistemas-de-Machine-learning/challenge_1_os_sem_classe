import httpx
from typing import List, Dict, Any, Optional
from ..config import settings

class ElderlyExplanationSynthesizer:
    def __init__(self):
        self.groq_key = settings.GROQ_API_KEY
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"

    async def gerar_explicacao(
        self,
        texto: str,
        classificacao: str,
        tema: str,
        nivel_risco: str,
        tipo: str,
        evidencias: List[Dict[str, Any]]
    ) -> str:
        """
        Synthesizes an explanation specifically adapted for elderly readers.
        Uses Groq LLM if key is available, otherwise uses rich contextual template synthesis.
        """
        if self.groq_key:
            try:
                explicacao_llm = await self._chamar_groq(texto, classificacao, tema, nivel_risco, evidencias)
                if explicacao_llm:
                    return explicacao_llm
            except Exception as e:
                print(f"Aviso ao chamar Groq API: {e}")

        # Fallback to contextual heuristic synthesis
        return self._sintese_didatica(texto, classificacao, tema, evidencias)

    async def _chamar_groq(
        self,
        texto: str,
        classificacao: str,
        tema: str,
        nivel_risco: str,
        evidencias: List[Dict[str, Any]]
    ) -> Optional[str]:
        titulos_evidencias = "\n".join([f"- {e.get('titulo')} ({e.get('revista', 'PubMed')})" for e in evidencias[:2]])

        system_prompt = (
            "Você é o MedFact, um assistente de saúde amigável, acolhedor e didático, criado para orientar pessoas idosas sobre informações que circulam na internet.\n"
            "Diretrizes de comunicação:\n"
            "1. Escreva em português do Brasil com clareza, empatia e frases curtas e objetivas.\n"
            "2. Não use termos técnicos difíceis sem explicar. Nunca zombe ou repreenda a pessoa por ter acreditado.\n"
            "3. Explique de forma simples o motivo científico pelo qual a informação é verdadeira, falsa ou enganosa.\n"
            "4. Crie uma resposta em 1 ou 2 parágrafos (máximo 120 palavras).\n"
            "5. Lembre com carinho de nunca abandonar tratamentos prescritos sem conversar antes com seu médico de confiança."
        )

        user_content = (
            f"Afirmação recebida: '{texto}'\n"
            f"Classificação preliminar: {classificacao.upper()}\n"
            f"Tema: {tema}\n"
            f"Nível de risco: {nivel_risco}\n"
            f"Evidências científicas consultadas:\n{titulos_evidencias if titulos_evidencias else 'Conhecimento médico estabelecido'}\n\n"
            f"Por favor, elabore a explicação ideal para um idoso ler com facilidade."
        )

        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.3,
            "max_tokens": 300
        }

        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(self.groq_url, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"].strip()
        return None

    def _sintese_didatica(
        self,
        texto: str,
        classificacao: str,
        tema: str,
        evidencias: List[Dict[str, Any]]
    ) -> str:
        t = texto.lower()

        # Specific well-known claims
        if "alzheimer" in t and "vacina" in t:
            return (
                "A vacina da gripe é muito segura e recomendada para proteger a sua saúde. "
                "Pesquisas científicas com milhões de idosos acompanhados por anos mostram que a vacina não causa Alzheimer. "
                "Pelo contrário: os estudos indicam que prevenir infecções graves pode até ajudar a proteger o cérebro. "
                "Pode tomar sua vacina com tranquilidade!"
            )
        
        if "limao" in t and "cancer" in t:
            return (
                "Beber água morna com limão é um hábito comum e hidratante, mas não tem a capacidade de curar ou eliminar tumores de câncer. "
                "Nenhum alimento ou fruta cura o câncer sozinho. Os tratamentos comprovados pela ciência são os indicados pelos médicos oncologistas. "
                "Nunca interrompa exames ou remédios por receitas caseiras da internet."
            )

        if "diabetes" in t and ("reverter" in t or "sem remedio" in t or "curar" in t):
            return (
                "Uma alimentação saudável e perder peso ajudam muito a controlar o diabetes e podem deixar a glicose excelente. "
                "Porém, o diabetes exige acompanhamento contínuo e não é curado milagrosamente por dietas caseiras. "
                "Nunca pare de tomar seus remédios de pressão ou insulina por conta própria sem falar antes com seu médico."
            )

        if "vitamina c" in t and ("covid" in t or "cura" in t):
            return (
                "A vitamina C é importante para a saúde geral, mas não cura nem evita a COVID-19. "
                "Estudos clínicos em hospitais comprovaram que doses altas de vitamina C não curam infecções virais. "
                "A melhor proteção continua sendo manter suas doses da vacina em dia e higienizar as mãos."
            )

        # General thematic syntheses
        if classificacao == "falsa":
            return (
                f"Pesquisas médicas e estudos científicos confiáveis mostram que essa informação sobre {tema} não é verdadeira. "
                "Notícias com promessas de curas milagrosas ou alertas alarmistas costumam ser inventadas para enganar. "
                "Para sua segurança, não compartilhe essa mensagem e sempre converse com seu médico ou vá ao posto de saúde."
            )
        elif classificacao == "enganosa":
            return (
                f"Essa mensagem sobre {tema} mistura uma parte verdadeira com informações exageradas ou fora de contexto. "
                "Cuidados com a saúde precisam de equilíbrio: receitas caseiras podem complementar, mas nunca substituem o acompanhamento médico regular. "
                "Fique atento e tire dúvidas na sua próxima consulta de rotina."
            )
        elif classificacao == "verdadeira":
            return (
                f"Essa informação sobre {tema} é confirmada por estudos científicos e órgãos de saúde respeitados. "
                "Seguir essas orientações fundamentadas é um passo importante para cuidar bem da sua saúde e viver com mais qualidade."
            )
        else:
            return (
                f"Não encontramos estudos científicos suficientes que comprovem essa afirmação sobre {tema}. "
                "Na dúvida, o mais seguro é não repassar a mensagem para amigos e familiares e buscar orientação com os profissionais do seu posto de saúde."
            )

synthesizer = ElderlyExplanationSynthesizer()
