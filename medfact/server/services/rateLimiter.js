// Um limitador por serviço, com janela de 1 minuto.
// Ajuste LIMITE_POR_MINUTO pra ficar com margem abaixo do limite real de cada plano.
function criarLimitador(limitePorMinuto) {
  let chamadas = 0;
  let inicioJanela = Date.now();

  return function podeChamar() {
    const agora = Date.now();
    if (agora - inicioJanela > 60_000) {
      chamadas = 0;
      inicioJanela = agora;
    }
    if (chamadas >= limitePorMinuto) return false;
    chamadas++;
    return true;
  };
}

module.exports = { criarLimitador };