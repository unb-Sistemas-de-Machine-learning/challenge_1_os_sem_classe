import json

from sklearn.metrics import f1_score, precision_score, recall_score

CAMINHO_RESULTADO = "medfact/server/scripts/resultados_validacao.json"

with open(CAMINHO_RESULTADO, "r", encoding="utf-8") as arquivo:
    dados = json.load(arquivo)

resultados_validos = [
    item
    for item in dados["resultados"]
    if item.get("status") == "ok"
]

esperados = [item["esperado"] for item in resultados_validos]
predicoes = [item["predicao"] for item in resultados_validos]

f1_macro = f1_score(
    esperados,
    predicoes,
    average="macro",
    zero_division=0,
)

precision_macro = precision_score(
    esperados,
    predicoes,
    average="macro",
    zero_division=0,
)

recall_macro = recall_score(
    esperados,
    predicoes,
    average="macro",
    zero_division=0,
)

print(f"F1 macro: {f1_macro:.4f}")
print(f"Precision macro: {precision_macro:.4f}")
print(f"Recall macro: {recall_macro:.4f}")