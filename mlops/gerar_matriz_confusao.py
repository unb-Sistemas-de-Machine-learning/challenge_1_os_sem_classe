import json

import matplotlib.pyplot as plt
from sklearn.metrics import ConfusionMatrixDisplay, confusion_matrix

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

classes = sorted(set(esperados) | set(predicoes))

matriz = confusion_matrix(
    esperados,
    predicoes,
    labels=classes,
)

display = ConfusionMatrixDisplay(
    confusion_matrix=matriz,
    display_labels=classes,
)

display.plot()

plt.title("Matriz de Confusão - MedFact")
plt.tight_layout()
plt.savefig("mlops/matriz_confusao.png")
plt.close()

print("Matriz de confusão gerada com sucesso.")