import { useState, useEffect } from 'react';
import './App.css';
import { AccessibilityBar } from './AccessibilityBar';
import { LogoIcon } from './LogoIcon';
import { AboutModal } from './AboutModal';

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
  const [modalSobreAberto, setModalSobreAberto] = useState(false);

  async function verificar(textoParaVerificar) {
    const consulta = textoParaVerificar ?? texto;

    if (!consulta || consulta.trim().length < 5) {
      return;
    }

    setTexto(consulta);
    setCarregando(true);
    setResultado(null);

    try {
      const API_URL =
        process.env.REACT_APP_API_URL ||
        'http://localhost:3001';

      const res = await fetch(`${API_URL}/api/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texto: consulta,
        }),
      });

      const data = await res.json();

      console.log('RESPOSTA DO BACKEND:', data);

      if (!res.ok) {
        setResultado({
          erro:
            data.erro ||
            'Não foi possível realizar a verificação.',
        });
        return;
      }

      setResultado(data);
    } catch (erro) {
      console.error(erro);

      setResultado({
        erro:
          'Não foi possível conectar ao servidor de verificação. Tente novamente em alguns instantes.',
      });
    } finally {
      setCarregando(false);
    }
  }

  function novaConsulta() {
    setTexto('');
    setResultado(null);
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.key === 'Enter' &&
        (event.ctrlKey || event.metaKey)
      ) {
        verificar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  return (
    <div className="pagina">

      {/* Barra superior */}
      <AccessibilityBar
        aoAbrirSobre={() => setModalSobreAberto(true)}
      />

      {/* Modal Sobre o Projeto */}
      <AboutModal
        aberto={modalSobreAberto}
        aoFechar={() => setModalSobreAberto(false)}
      />

      {/* Cabeçalho */}
      <header className="topo">
        <div className="topo-conteudo">
          <div className="marca-container">
            <LogoIcon
              width={40}
              height={40}
              className="logo-imagem-site"
            />

            <span className="marca">
              MedFact
            </span>
          </div>

          <span className="tag-subtitulo">
            Plataforma de Checagem em Saúde
          </span>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="conteudo">

        {/* Tela inicial */}
        {!resultado && !carregando && (
          <div className="bloco-inicial-animado">

            <h1 className="titulo-principal">
              Como posso ajudar hoje?
            </h1>

            <form
              className="caixa-busca"
              onSubmit={(e) => {
                e.preventDefault();
                verificar();
              }}
            >
              <label
                htmlFor="campo-consulta"
                className="rotulo-busca"
              >
                Digite a informação de saúde que você recebeu:
              </label>

              <div className="wrapper-campo-texto">
                <textarea
                  id="campo-consulta"
                  className="campo-texto"
                  rows={4}
                  placeholder="Exemplo: Falaram que a vacina da gripe causa complicações graves... é verdade?"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="botao-verificar"
                disabled={
                  !texto.trim() ||
                  texto.trim().length < 5
                }
              >
                <svg
                  className="svg-icone"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line
                    x1="21"
                    y1="21"
                    x2="16.65"
                    y2="16.65"
                  />
                </svg>

                <span>
                  Verificar Informação
                </span>
              </button>
            </form>

            {/* Temas frequentes */}
            <section
              className="temas"
              aria-label="Perguntas mais consultadas hoje"
            >
              <h2 className="titulo-secao">
                Dúvidas frequentes de hoje:
              </h2>

              <div className="lista-temas">
                {TEMAS.map((tema) => (
                  <button
                    key={tema.id}
                    className="card-tema"
                    onClick={() =>
                      verificar(tema.pergunta)
                    }
                  >
                    <div className="card-header-tema">
                      <span className="rotulo-tema">
                        {tema.titulo}
                      </span>
                    </div>

                    <span className="pergunta-tema">
                      "{tema.pergunta}"
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Carregando */}
        {carregando && (
          <div
            className="estado-carregando"
            role="status"
            aria-live="assertive"
          >
            <div className="spinner-medico"></div>

            <p className="texto-carregando">
              Verificando a informação nas bases oficiais
              de saúde...
            </p>
          </div>
        )}

        {/* Resultado */}
        {resultado && !carregando && (
          <section
            className="resultado"
            aria-live="polite"
          >
            <div className="cabecalho-resultado">
              <span className="subtitulo-resultado">
                Informação consultada:
              </span>

              <p className="pergunta-verificada">
                "{texto}"
              </p>
            </div>

            {/* Erro */}
            {resultado.erro ? (
              <div className="bloco-erro">
                <p className="linha-erro">
                  {resultado.erro}
                </p>
              </div>
            ) : (
              <>
                {/* Selo de classificação */}
                <div className="selo-container">
                  <div
                    className={`selo selo-${(
                      resultado.classificacao ||
                      'indisponivel'
                    )
                      .toLowerCase()
                      .replace(/\s/g, '-')}`}
                  >
                    <span>
                      {resultado.origem === 'camada_1'
                        ? `Checado por ${
                            resultado.evidencias?.[0]
                              ?.fonte ||
                            'uma fonte de checagem'
                          }`
                        : (
                            resultado.classificacao ||
                            'Resultado indisponível'
                          )}
                    </span>
                  </div>
                </div>

                {/* Nível de risco */}
                {resultado.nivel_risco && (
                  <div className="bloco-explicacao bloco-risco">
                    <h2 className="titulo-bloco">
                      Nível de Risco
                    </h2>

                    <p className="linha-detalhe">
                      {resultado.nivel_risco}
                    </p>
                  </div>
                )}

                {/* Explicação */}
                {resultado.explicacao && (
                  <div className="bloco-explicacao">
                    <h2 className="titulo-bloco">
                      O que dizem os órgãos de saúde e pesquisas:
                    </h2>

                    <p className="explicacao">
                      {resultado.explicacao}
                    </p>
                  </div>
                )}

                {/* Fontes */}
                {resultado.evidencias &&
                  resultado.evidencias.length > 0 && (
                    <div className="bloco-fonte">
                      <h2 className="titulo-bloco">
                        Fontes consultadas
                      </h2>

                      <div className="lista-fontes">
                        {resultado.evidencias.map(
                          (fonte, index) => (
                            <div
                              className="fonte"
                              key={
                                fonte.id || index
                              }
                            >
                              <p className="titulo-fonte">
                                {fonte.titulo ||
                                  'Fonte sem título'}
                              </p>

                              <p className="revista-fonte">
                                {fonte.fonte ||
                                  fonte.revista ||
                                  fonte.journal ||
                                  'Fonte não informada'}

                                {fonte.data
                                  ? ` • ${fonte.data}`
                                  : ''}
                              </p>

                              {fonte.classificacao && (
                                <p className="classificacao-fonte">
                                  Resultado da checagem:{' '}
                                  <strong>
                                    {
                                      fonte.classificacao
                                    }
                                  </strong>
                                </p>
                              )}

                              {fonte.url && (
                                <a
                                  className="link-fonte"
                                  href={fonte.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Ver fonte completa
                                </a>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Nenhuma fonte */}
                {(!resultado.evidencias ||
                  resultado.evidencias.length === 0) && (
                  <div className="bloco-fonte">
                    <h2 className="titulo-bloco">
                      Fontes consultadas
                    </h2>

                    <p>
                      Não foram encontradas fontes
                      específicas para esta verificação.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Nova consulta */}
            <button
              className="botao-nova-consulta"
              onClick={novaConsulta}
            >
              Fazer Nova Consulta
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;