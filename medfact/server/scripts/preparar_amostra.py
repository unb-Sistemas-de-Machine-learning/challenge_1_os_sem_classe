import csv
import json
import random

CAMINHO_TSV = r"C:\Users\caiom\Downloads\PUBHEALTH\dev.tsv"  # ajuste pro seu caminho
POR_TEMA = 10  # quantas claims de cada tema você quer (10 x 3 temas = 30 no total)
LABELS_VALIDOS = {"true", "false", "mixture", "unproven"}

# Palavras-chave por tema — case insensitive, feitas pra bater com o texto em inglês do PUBHEALTH
PALAVRAS_CHAVE = {
    "vacinação": [
        "vaccine", "vaccination", "vaccinated", "immunization", "immunisation",
        "mmr", "hpv vaccine", "flu shot", "flu vaccine",
    ],
    "COVID-19": [
        "covid", "coronavirus", "sars-cov-2", "pandemic", "quarantine", "lockdown",
    ],
    "doenças crônicas": [
        "cancer", "diabetes", "hypertension", "cardiovascular", "heart disease",
        "cholesterol", "obesity", "alzheimer", "copd", "arthritis",
        "kidney disease", "stroke", "chronic",
    ],
}


def identificar_tema(texto):
    texto_lower = texto.lower()
    for tema, palavras in PALAVRAS_CHAVE.items():
        if any(palavra in texto_lower for palavra in palavras):
            return tema
    return None


def mapear_rotulo(label):
    mapa = {"true": "verdadeira", "false": "falsa", "mixture": "enganosa", "unproven": "não verificável"}
    return mapa.get(label, label)


# Agrupa as claims válidas por tema
por_tema = {tema: [] for tema in PALAVRAS_CHAVE}

with open(CAMINHO_TSV, encoding="utf-8") as f:
    leitor = csv.reader(f, delimiter="\t")
    for linha in leitor:
        if len(linha) < 8:
            continue
        claim = linha[1].strip()
        label = linha[7].strip().lower()
        if label not in LABELS_VALIDOS or not claim:
            continue

        tema = identificar_tema(claim)
        if tema:
            por_tema[tema].append({"claim": claim, "label": label})

# Monta a amostra final, equilibrada entre os temas
amostra_final = []
print("=== Claims encontradas por tema (antes de sortear) ===")
for tema, claims in por_tema.items():
    print(f"{tema}: {len(claims)} disponíveis")
    quantidade = min(POR_TEMA, len(claims))
    amostra_final.extend(random.sample(claims, quantidade))

random.shuffle(amostra_final)

with open("pubhealth_amostra.json", "w", encoding="utf-8") as f:
    json.dump(amostra_final, f, ensure_ascii=False, indent=2)

print(f"\nAmostra final: {len(amostra_final)} claims salvas em pubhealth_amostra.json")