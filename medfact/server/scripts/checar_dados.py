import json
from sklearn.metrics import classification_report

with open('resultados_validacao.json', encoding='utf-8') as f:
    dados = json.load(f)

# Só considera classificações que de fato aconteceram
validos = [d for d in dados if d.get('status') == 'sucesso']

print(f"Total: {len(dados)} | Válidos: {len(validos)} | Erros de API: {len(dados) - len(validos)}")

esperados = [d['esperado'] for d in validos]
preditos = [d['predito'] for d in validos]

print("\n=== Valores únicos ===")
print("Esperado:", set(esperados))
print("Predito:", set(preditos))

print("\n=== Classification report ===")
print(classification_report(esperados, preditos))