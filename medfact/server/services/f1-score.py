import json
from sklearn.metrics import classification_report, f1_score

with open("resultados_validacao.json") as f:
    dados = json.load(f)

esperados = [d["esperado"] for d in dados]
preditos = [d["predito"] for d in dados]

# Relatório completo
print(classification_report(esperados, preditos))

# F1-score Macro
f1_macro = f1_score(esperados, preditos, average="macro")

print(f"F1-score Macro: {f1_macro:.4f}")