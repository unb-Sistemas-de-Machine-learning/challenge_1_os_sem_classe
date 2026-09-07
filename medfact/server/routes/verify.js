const express = require('express');
const { searchFactCheck } = require('../services/googleFactCheck');
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

    if (checagemExistente && !checagemExistente.indisponivel) {
      return res.json({
        origem: 'camada_1',
        classificacao: checagemExistente.classificacao,
        agencia: checagemExistente.agencia,
        url: checagemExistente.url,
      });
    }

    // Se a camada 1 não encontrou nada (ou estava indisponível por limite de taxa),
    // segue pra camada 2 do mesmo jeito.
    const evidencias = await searchPubMed(texto);
    const resultado = await classificarComGroq(texto, evidencias);

    return res.json({
      origem: 'camada_2',
      ...resultado,
      evidencias,
    });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: 'Falha ao analisar o texto. Tente novamente.' });
  }
});

module.exports = router;