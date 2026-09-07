import json
from sklearn.metrics import classification_report

with open('resultados_validacao.json', encoding='utf-8') as f:
    dados = json.load(f)

esperados = [d['esperado'] for d in dados]
preditos = [d['predito'] for d in dados]

print("=== Valores únicos ===")
print("Esperado:", set(esperados))
print("Predito:", set(preditos))

print("\n=== Entradas indisponíveis (rate limit) ===")
indisponiveis = sum(1 for d in dados if d['predito'] == 'indisponível')
print(f"{indisponiveis} de {len(dados)} vieram indisponíveis")

print("\n=== Classification report ===")
print(classification_report(esperados, preditos))