import os
import re
import joblib
from typing import Dict, Any, List, Tuple
from ..config import settings

class MLEngine:
    def __init__(self):
        self.topic_model = None
        self.veracity_model = None
        self.load_models()

    def load_models(self):
        topic_model_path = os.path.join(settings.MODELS_DIR, "topic_classifier.joblib")
        veracity_model_path = os.path.join(settings.MODELS_DIR, "veracity_classifier.joblib")
        
        if os.path.exists(topic_model_path):
            try:
                self.topic_model = joblib.load(topic_model_path)
            except Exception as e:
                print(f"Aviso ao carregar topic_classifier: {e}")
                self.topic_model = None
                
        if os.path.exists(veracity_model_path):
            try:
                self.veracity_model = joblib.load(veracity_model_path)
            except Exception as e:
                print(f"Aviso ao carregar veracity_classifier: {e}")
                self.veracity_model = None

    def normalizar(self, texto: str) -> str:
        if not texto:
            return ""
        import unicodedata
        texto = unicodedata.normalize('NFD', texto)
        texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
        texto = texto.lower()
        texto = re.sub(r"[^\w\s-]", " ", texto)
        return re.sub(r"\s+", " ", texto).strip()

    def classificar_tema(self, texto: str) -> str:
        """
        Classifies health claim into: 'vacinação', 'COVID-19', or 'doenças crônicas'.
        Uses trained ML model if available, with robust linguistic heuristic fallback.
        """
        if self.topic_model:
            try:
                pred = self.topic_model.predict([texto])[0]
                return pred
            except Exception:
                pass

        # Robust heuristic fallback
        t = self.normalizar(texto)
        vax_keywords = ["vacina", "vacinacao", "vacinado", "imunizacao", "gripe", "sarampo", "hpv", "febre amarela", "dose", "antivacina", "gotinha"]
        covid_keywords = ["covid", "coronavirus", "sars-cov-2", "pandemia", "quarentena", "mascara", "lockdown", "isolamento", "cloroquina", "ivermectina"]
        cronicas_keywords = ["cancer", "diabetes", "diabete", "insulina", "glicemia", "hipertensao", "pressao alta", "coracao", "infarto", "colesterol", "alzheimer", "avc", "derrame", "artrite", "rim", "renal", "obesidade"]

        scores = {
            "vacinação": sum(1 for k in vax_keywords if k in t),
            "COVID-19": sum(1 for k in covid_keywords if k in t),
            "doenças crônicas": sum(1 for k in cronicas_keywords if k in t)
        }
        
        best_theme = max(scores, key=scores.get)
        if scores[best_theme] > 0:
            return best_theme
        return "doenças crônicas"

    def extrair_trecho_suspeito(self, texto: str) -> str:
        """Extracts the central suspect assertion from the input claim."""
        gatilhos = [
            r"(causa [a-zA-Z\s]+)",
            r"(cura [a-zA-Z\s]+)",
            r"(reverte [a-zA-Z\s]+)",
            r"(mata [a-zA-Z\s]+)",
            r"(provoca [a-zA-Z\s]+)",
            r"(elimina [a-zA-Z\s]+)",
            r"(substituto da [a-zA-Z\s]+)",
            r"(evita 100% [a-zA-Z\s]+)"
        ]
        for padrao in gatilhos:
            match = re.search(padrao, texto, re.IGNORECASE)
            if match:
                return match.group(0).strip()
        # Fallback to the whole claim truncated
        return texto.strip()[:60]

    def analisar_alegacao(self, texto: str, evidencias: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyzes the claim using ML predictions, evidence retrieval scores, and medical risk criteria.
        Returns:
            - classificacao: "falsa", "verdadeira", "enganosa", "não verificável"
            - probabilidade_desinformacao: 0-100
            - tipo: tipo de desinformação
            - nivel_risco: "alto", "médio", "baixo"
            - tema: tema classificado
            - trecho_suspeito: frase suspeita
        """
        tema = self.classificar_tema(texto)
        t_norm = self.normalizar(texto)
        trecho_suspeito = self.extrair_trecho_suspeito(texto)

        # 1. Linguistic markers of medical misinformation & miracle cures
        milagre_termos = ["cura definitiva", "cura 100%", "cura milagrosa", "cura o cancer", "cura diabetes", "reverte o diabetes so com", "sem remedio", "medicos escondem", "veneno", "mortal", "causa alzheimer", "microchip", "altera dna"]
        exagero_termos = ["elimina todos", "100% eficaz", "nunca mais", "qualquer doenca", "cura tudo"]
        parcial_termos = ["ajuda a combater", "pode reduzir", "diminui risco", "alivia sintomas"]

        tem_milagre = any(m in t_norm for m in milagre_termos)
        tem_exagero = any(m in t_norm for m in exagero_termos)
        tem_parcial = any(m in t_norm for m in parcial_termos)

        # 2. Evidence strength evaluation from PubMed
        best_score = 0.0
        best_article = None
        if evidencias:
            best_article = evidencias[0]
            best_score = float(best_article.get("relevancia_score", 0.0))

        # Check if ML veracity model is available
        if self.veracity_model:
            try:
                pred_proba = self.veracity_model.predict_proba([texto])[0]
                classes = list(self.veracity_model.classes_)
                # Use ML model predictions
                pred_label = self.veracity_model.predict([texto])[0]
                # Map to probability of misinformation
                if pred_label == "falsa":
                    prob = int(max(pred_proba) * 100)
                elif pred_label == "enganosa":
                    prob = int(60 + (max(pred_proba) * 25))
                elif pred_label == "verdadeira":
                    prob = int((1.0 - max(pred_proba)) * 20)
                else:
                    prob = 50
            except Exception:
                prob = None
                pred_label = None
        else:
            prob = None
            pred_label = None

        # 3. Decision Matrix (combining ML, Evidence similarity, and Misinformation heuristics)
        if tem_milagre:
            classificacao = "falsa"
            probabilidade = 92
            tipo = "alegação sem evidência"
            nivel_risco = "alto"
        elif tem_exagero:
            classificacao = "enganosa"
            probabilidade = 78
            tipo = "exagero"
            nivel_risco = "médio"
        elif "vacina" in t_norm and ("alzheimer" in t_norm or "autismo" in t_norm or "infertilidade" in t_norm):
            classificacao = "falsa"
            probabilidade = 95
            tipo = "informação falsa"
            nivel_risco = "alto"
        elif "vitamina c" in t_norm and "cura" in t_norm:
            classificacao = "falsa"
            probabilidade = 88
            tipo = "exagero"
            nivel_risco = "médio"
        elif "cloroquina" in t_norm or "ivermectina" in t_norm:
            if "previne" in t_norm or "cura" in t_norm or "eficaz" in t_norm:
                classificacao = "falsa"
                probabilidade = 94
                tipo = "informação falsa"
                nivel_risco = "alto"
            else:
                classificacao = "enganosa"
                probabilidade = 75
                tipo = "informação verdadeira fora de contexto"
                nivel_risco = "médio"
        elif "diabetes" in t_norm and ("reverter" in t_norm or "curar" in t_norm or "sem remedio" in t_norm):
            classificacao = "enganosa"
            probabilidade = 70
            tipo = "informação parcialmente verdadeira"
            nivel_risco = "alto"
        elif ("limao" in t_norm or "agua morna" in t_norm) and "cancer" in t_norm:
            classificacao = "falsa"
            probabilidade = 96
            tipo = "alegação sem evidência"
            nivel_risco = "alto"
        elif best_score >= 0.20 and ("reduz" in t_norm or "protege" in t_norm or "segura" in t_norm or "recomendada" in t_norm):
            classificacao = "verdadeira"
            probabilidade = 12
            tipo = "informação verificada"
            nivel_risco = "baixo"
        elif best_score < 0.05 and not evidencias:
            classificacao = "não verificável"
            probabilidade = 50
            tipo = "alegação sem evidência"
            nivel_risco = "médio"
        else:
            # Fallback based on ML classifier prediction if available
            if pred_label:
                classificacao = pred_label
                probabilidade = prob or 65
            else:
                classificacao = "enganosa"
                probabilidade = 65
            tipo = "informação parcialmente verdadeira"
            nivel_risco = "médio"

        return {
            "tema": tema,
            "classificacao": classificacao,
            "probabilidade_desinformacao": probabilidade,
            "tipo": tipo,
            "nivel_risco": nivel_risco,
            "trecho_suspeito": trecho_suspeito
        }

ml_engine = MLEngine()
