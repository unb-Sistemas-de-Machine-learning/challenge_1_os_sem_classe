const express = require('express');
const { searchFactCheck, mapearClassificacaoAgencia } = require('../services/googleFactCheck');
const { searchPubMed } = require('../services/pubmed');
const { classificarComGroq } = require('../services/groq');

const router = express.Router();

router.post('/verify', async (req, res) => {
  const { texto } = req.body;

  if (!texto || texto.trim().length < 5) {
    return res.status(400).json({ erro: 'Envie um texto para análise.' });
  }

  try {
    const checagemExistente = await searchFactCheck(texto);

    if (
        checagemExistente &&
        !checagemExistente.indisponivel &&
        checagemExistente.encontrado &&
        checagemExistente.evidencias.length > 0
    ) {
        const principal = checagemExistente.evidencias[0];
        const classificacao = mapearClassificacaoAgencia(principal.classificacao);

        return res.json({
            origem: 'camada_1',
            classificacao,
            explicacao: `Segundo ${principal.fonte}, essa informação foi classificada como "${principal.classificacao}".`,
            fonteEvidencia: 'Google Fact Check',
            evidencias: checagemExistente.evidencias,
        });
    }

    const evidencias = await searchPubMed(texto);
    const resultado = await classificarComGroq(texto, evidencias);

    return res.json({
      origem: 'camada_2',
      fonteEvidencia: 'PubMed',
      ...resultado,
      evidencias,
    });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: 'Falha ao analisar o texto. Tente novamente.' });
  }
});

module.exports = router;