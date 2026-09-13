import { useState } from 'react';
import './App.css';

const TEMAS = [
  {
    id: 'vacinacao',
    titulo: 'Vacinação',
    pergunta: 'A vacina da gripe pode causar Alzheimer?',
  },
  {
    id: 'covid',
    titulo: 'COVID-19',
    pergunta: 'Vitamina C em dose alta cura a COVID-19?',
  },
  {
    id: 'cronicas',
    titulo: 'Doenças crônicas',
    pergunta: 'Dá para reverter o diabetes só com dieta, sem remédio?',
  },
];

function App() {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function verificar(textoParaVerificar) {
    const consulta = textoParaVerificar ?? texto;
    if (!consulta || consulta.trim().length < 5) return;

    setTexto(consulta);
    setCarregando(true);
    setResultado(null);

    try {
      const res = await fetch('http://localhost:3001/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: consulta }),
      });
      const data = await res.json();
      setResultado(data);
    } catch (erro) {
      setResultado({ erro: 'Não foi possível conectar ao servidor. Tente novamente.' });
    } finally {
      setCarregando(false);
    }
  }

  function novaConsulta() {
    setTexto('');
    setResultado(null);
  }

  return (
    <div className="pagina">
      <header className="topo">
        <span className="marca">MedFact</span>
      </header>

      <main className="conteudo">
        {!resultado && !carregando && (
          <>
            <h1 className="titulo-principal">O que você quer verificar hoje?</h1>

            <form
              className="caixa-busca"
              onSubmit={(e) => {
                e.preventDefault();
                verificar();
              }}
            >
              <label htmlFor="campo-consulta" className="rotulo-busca">
                Cole ou digite a mensagem que você recebeu
              </label>
              <textarea
                id="campo-consulta"
                className="campo-texto"
                rows={4}
                placeholder="Exemplo: essa vacina causa problema no coração?"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <button type="submit" className="botao-verificar" disabled={!texto.trim()}>
                Verificar
              </button>
            </form>

            <section className="temas" aria-label="Temas mais consultados hoje">
              <h2 className="titulo-secao">Perguntas mais frequentes hoje</h2>
              <div className="lista-temas">
                {TEMAS.map((tema) => (
                  <button
                    key={tema.id}
                    className="card-tema"
                    onClick={() => verificar(tema.pergunta)}
                  >
                    <span className="rotulo-tema">{tema.titulo}</span>
                    <span className="pergunta-tema">{tema.pergunta}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {carregando && (
          <div className="estado-carregando" role="status">
            <p>Verificando essa informação, um momento...</p>
          </div>
        )}

        {resultado && !carregando && (
          <section className="resultado" aria-live="polite">
            <p className="pergunta-verificada">"{texto}"</p>

            {resultado.erro ? (
              <p className="linha-erro">{resultado.erro}</p>
            ) : (
              <>
                <p className={`selo selo-${(resultado.classificacao || '').replace(/\s/g, '-')}`}>
                  {resultado.origem === 'camada_1'
                    ? `Já verificado por ${resultado.agencia}`
                    : (resultado.classificacao || 'Resultado indisponível')}
                </p>

                {resultado.nivel_risco && (
                  <p className="linha-detalhe">
                    <strong>Nível de risco:</strong> {resultado.nivel_risco}
                  </p>
                )}

                {resultado.explicacao && (
                  <p className="explicacao">{resultado.explicacao}</p>
                )}

                {resultado.url && (
                  <a className="link-fonte" href={resultado.url} target="_blank" rel="noreferrer">
                    Ver checagem completa
                  </a>
                )}
              </>
            )}

            <button className="botao-nova-consulta" onClick={novaConsulta}>
              Verificar outra informação
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;