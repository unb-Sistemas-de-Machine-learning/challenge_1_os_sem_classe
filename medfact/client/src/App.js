import { useState, useEffect, useRef } from 'react';
import './App.css';
import { MascotPill } from './MascotPill';
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

  // Estados de Acessibilidade (Tamanho de Fonte: 'normal' | 'grande' | 'extra-grande')
  const [tamanhoFonte, setTamanhoFonte] = useState('normal');
  const [altoContraste, setAltoContraste] = useState(false);
  const [lendoAudio, setLendoAudio] = useState(false);
  const [gravandoVoz, setGravandoVoz] = useState(false);
  const [modalSobreAberto, setModalSobreAberto] = useState(false);

  const synthRef = useRef(window.speechSynthesis);
  const [estadoMascote, setEstadoMascote] = useState('idle');

  // Funções de Aumentar / Diminuir Fonte
  const aumentarFonte = () => {
    if (tamanhoFonte === 'normal') setTamanhoFonte('grande');
    else if (tamanhoFonte === 'grande') setTamanhoFonte('extra-grande');
  };

  const diminuirFonte = () => {
    if (tamanhoFonte === 'extra-grande') setTamanhoFonte('grande');
    else if (tamanhoFonte === 'grande') setTamanhoFonte('normal');
  };

  useEffect(() => {
    if (carregando) {
      setEstadoMascote('loading');
    } else if (resultado) {
      if (resultado.erro) {
        setEstadoMascote('erro');
      } else {
        setEstadoMascote('result');
      }
    } else if (texto.trim().length > 0) {
      setEstadoMascote('typing');
    } else {
      setEstadoMascote('idle');
    }
  }, [texto, carregando, resultado]);

  useEffect(() => {
    const synth = synthRef.current;
    return () => {
      if (synth) {
        synth.cancel();
      }
    };
  }, []);

  async function verificar(textoParaVerificar) {
    const consulta = textoParaVerificar ?? texto;
    if (!consulta || consulta.trim().length < 5) return;

    if (synthRef.current) {
      synthRef.current.cancel();
      setLendoAudio(false);
    }

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
      console.log('RESPOSTA DO BACKEND:', data);
      setResultado(data);
    } catch (erro) {
      setResultado({ erro: 'Não foi possível conectar ao servidor de verificação. Tente novamente em alguns instantes.' });
    } finally {
      setCarregando(false);
    }
  }

  function novaConsulta() {
    if (synthRef.current) {
      synthRef.current.cancel();
      setLendoAudio(false);
    }
    setTexto('');
    setResultado(null);
  }

  function alternarLeituraAudio() {
    if (!synthRef.current) {
      alert('A leitura em áudio não é suportada neste navegador.');
      return;
    }

    if (lendoAudio) {
      synthRef.current.cancel();
      setLendoAudio(false);
      return;
    }

    if (!resultado) return;

    let textoParaLer = '';
    if (resultado.erro) {
      textoParaLer = resultado.erro;
    } else {
      const classificacao = resultado.origem === 'camada_1'
        ? `Informação já verificada pela agência ${resultado.agencia}`
        : `Classificação da informação: ${resultado.classificacao || 'Indisponível'}`;

      const risco = resultado.nivel_risco ? `Nível de risco: ${resultado.nivel_risco}.` : '';
      const explicacao = resultado.explicacao ? `Análise das fontes: ${resultado.explicacao}` : '';

      textoParaLer = `Resultado da verificação para: "${texto}". ${classificacao}. ${risco} ${explicacao}`;
    }

    const utterance = new SpeechSynthesisUtterance(textoParaLer);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;

    utterance.onend = () => setLendoAudio(false);
    utterance.onerror = () => setLendoAudio(false);

    setLendoAudio(true);
    synthRef.current.speak(utterance);
  }

  function iniciarDitadoVoz() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('O ditado por voz não está disponível neste navegador.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;

      recognition.onstart = () => setGravandoVoz(true);
      recognition.onend = () => setGravandoVoz(false);
      recognition.onerror = () => setGravandoVoz(false);

      recognition.onresult = (e) => {
        const transcricao = e.results[0][0].transcript;
        if (transcricao) {
          setTexto((prev) => (prev ? `${prev} ${transcricao}` : transcricao));
        }
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setGravandoVoz(false);
    }
  }

  return (
    <div className={`pagina fonte-${tamanhoFonte} ${altoContraste ? 'alto-contraste' : ''}`}>
      {/* Barra de Acessibilidade com Controles de Fonte e Sobre */}
      <AccessibilityBar
        tamanhoFonte={tamanhoFonte}
        aoMudarTamanhoFonte={setTamanhoFonte}
        aoAumentarFonte={aumentarFonte}
        aoDiminuirFonte={diminuirFonte}
        altoContraste={altoContraste}
        aoAlternarContraste={() => setAltoContraste(!altoContraste)}
        lendoAudio={lendoAudio}
        aoAlternarAudio={alternarLeituraAudio}
        temResultado={!!resultado && !carregando}
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
            <LogoIcon width={40} height={40} className="logo-imagem-site" />
            <span className="marca">MedFact</span>
          </div>
          <span className="tag-subtitulo">Plataforma de Checagem em Saúde</span>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="conteudo">
        {/* Mascote Pílula */}
        <MascotPill
          estado={estadoMascote}
          aoClicar={() => {
            if (resultado && !carregando) {
              alternarLeituraAudio();
            }
          }}
        />

        {!resultado && !carregando && (
          <div className="bloco-inicial-animado">
            <h1 className="titulo-principal">Como posso ajudar na sua verificação hoje?</h1>

            <form
              className="caixa-busca"
              onSubmit={(e) => {
                e.preventDefault();
                verificar();
              }}
            >
              <label htmlFor="campo-consulta" className="rotulo-busca">
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
                
                {/* Botão de ditado por voz */}
                <button
                  type="button"
                  className={`btn-ditado-voz ${gravandoVoz ? 'gravando' : ''}`}
                  onClick={iniciarDitadoVoz}
                  title="Falar minha pergunta pelo microfone"
                  aria-label="Falar minha pergunta pelo microfone"
                >
                  <svg className="svg-icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  <span>{gravandoVoz ? 'Ouvindo...' : 'Falar Pergunta'}</span>
                </button>
              </div>

              <button
                type="submit"
                className="botao-verificar"
                disabled={!texto.trim() || texto.trim().length < 5}
              >
                <svg className="svg-icone" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span>Verificar Informação</span>
              </button>
            </form>

            <section className="temas" aria-label="Perguntas mais consultadas hoje">
              <h2 className="titulo-secao">Dúvidas frequentes de hoje:</h2>
              <div className="lista-temas">
                {TEMAS.map((tema) => (
                  <button
                    key={tema.id}
                    className="card-tema"
                    onClick={() => verificar(tema.pergunta)}
                  >
                    <div className="card-header-tema">
                      <span className="rotulo-tema">{tema.titulo}</span>
                    </div>
                    <span className="pergunta-tema">"{tema.pergunta}"</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {carregando && (
          <div className="estado-carregando" role="status" aria-live="assertive">
            <div className="spinner-medico"></div>
            <p className="texto-carregando">Verificando a informação nas bases oficiais de saúde...</p>
          </div>
        )}

        {resultado && !carregando && (
          <section className="resultado" aria-live="polite">
            <div className="cabecalho-resultado">
              <span className="subtitulo-resultado">Informação consultada:</span>
              <p className="pergunta-verificada">
                "{texto}"
              </p>
            </div>

            {resultado.erro ? (
              <div className="bloco-erro">
                <p className="linha-erro">
                  {resultado.erro}
                </p>
              </div>
            ) : (
              <>
                {/* SELO DE CLASSIFICAÇÃO */}
                <div className="selo-container">
                  <div
                    className={`selo selo-${(resultado.classificacao || 'indisponivel')
                      .toLowerCase()
                      .replace(/\s/g, '-')}`}
                  >
                    <span>
                      {resultado.origem === 'camada_1'
                        ? `Checado por ${resultado.agencia}`
                        : (resultado.classificacao || 'Resultado indisponível')}
                    </span>
                  </div>
                </div>

                {/* CARD OUVIR RESPOSTA EM ÁUDIO */}
                <div className="card-ouvir-resposta">
                  <div className="texto-ouvir">
                    <strong>Leitura da Resposta em Áudio</strong>
                    <p>Clique no botão para ouvir a explicação em voz alta.</p>
                  </div>
                  <button
                    type="button"
                    className={`btn-ouvir-principal ${lendoAudio ? 'lendo' : ''}`}
                    onClick={alternarLeituraAudio}
                  >
                    <svg className="svg-icone" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      {lendoAudio ? (
                        <rect x="6" y="4" width="12" height="16" rx="2" />
                      ) : (
                        <>
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </>
                      )}
                    </svg>
                    <span>{lendoAudio ? 'Pausar Áudio' : 'Ouvir Resposta'}</span>
                  </button>
                </div>

                {/* NÍVEL DE RISCO */}
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

                {/* EXPLICAÇÃO DETALHADA */}
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

                {/* FONTE DA CHECAGEM */}
                {resultado.origem === 'camada_1' && resultado.url && (
                  <div className="bloco-fonte">
                    <h2 className="titulo-bloco">
                      Fonte da Checagem
                    </h2>

                    <p className="revista-fonte">
                      Agência responsável: <strong>{resultado.agencia}</strong>
                    </p>

                    <a
                      className="link-fonte"
                      href={resultado.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ler matéria completa na {resultado.agencia}
                    </a>
                  </div>
                )}

                {resultado.origem === 'camada_2' &&
                  resultado.evidencias &&
                  resultado.evidencias.length > 0 && (
                    <div className="bloco-fonte">
                      <h2 className="titulo-bloco">
                        Artigos e Estudos Científicos Consultados
                      </h2>

                      <div className="lista-fontes">
                        {resultado.evidencias.map((fonte, index) => (
                          <div className="fonte" key={fonte.id || index}>
                            <p className="titulo-fonte">
                              {fonte.titulo}
                            </p>

                            <p className="revista-fonte">
                              Publicado em: <strong>{fonte.revista}</strong>
                              {fonte.data ? ` • ${fonte.data}` : ''}
                            </p>

                            {fonte.url && (
                              <a
                                className="link-fonte"
                                href={fonte.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Ver pesquisa original no PubMed
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                )}
              </>
            )}

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