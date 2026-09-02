require('dotenv').config();
const fs = require('fs');
const { classificarComGroq } = require('../services/groq');
const { searchPubMed } = require('../services/pubmed');

// Baixe uma amostra do PUBHEALTH e salve como pubhealth_amostra.json:
// [{ "claim": "...", "label": "true" | "false" | "mixture" | "unproven" }, ...]
const amostra = JSON.parse(fs.readFileSync('./pubhealth_amostra.json', 'utf-8'));

function mapearRotulo(labelPubhealth) {
  const mapa = {
    true: 'verdadeira',
    false: 'falsa',
    mixture: 'enganosa',
    unproven: 'não verificável',
  };
  return mapa[labelPubhealth] || labelPubhealth;
}

async function validar() {
  let acertos = 0;
  const resultados = [];

  for (const item of amostra) {
    const evidencias = await searchPubMed(item.claim);
    const predicao = await classificarComGroq(item.claim, evidencias);
    const esperado = mapearRotulo(item.label);
    const correto = predicao.classificacao === esperado;

    if (correto) acertos++;
    resultados.push({ claim: item.claim, esperado, predito: predicao.classificacao, correto });
  }

  const acuracia = (acertos / amostra.length) * 100;
  console.log(`Acurácia simples: ${acuracia.toFixed(1)}% (${acertos}/${amostra.length})`);
  fs.writeFileSync('./resultados_validacao.json', JSON.stringify(resultados, null, 2));
}

validar();