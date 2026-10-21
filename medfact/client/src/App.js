import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { LogoIcon } from './LogoIcon';
import { AboutModal } from './AboutModal';
import { AccessibilityBar } from './AccessibilityBar';
import { MascotPill } from './MascotPill';

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

const EXPLICACAO_EVIDENCIAS = [
  {
    classificacao: 'VERDADEIRA',
    badgeClass: 'badge-guia-verdadeira',
    texto: 'As pesquisas clínicas e informações científicas confirmam que essa afirmação é verdadeira e confiável.',
  },
  {
    classificacao: 'FALSA',
    badgeClass: 'badge-guia-falsa',
    texto: 'Estudos biomédicos e agências de checagem mostram que essa informação não procede e pode gerar desinformação.',
  },
  {
    classificacao: 'ENGANOSA',
    badgeClass: 'badge-guia-enganosa',
    texto: 'A mensagem mistura dados reais com conclusões incorretas, descontextualizadas ou exageradas.',
  },
  {
    classificacao: 'NÃO VERIFICÁVEL',
    badgeClass: 'badge-guia-nao-verificavel',
    texto: 'Não existem evidências científicas sólidas suficientes para comprovar ou refutar. Por segurança, não compartilhe.',
  },
];

function App() {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [modalSobreAberto, setModalSobreAberto] = useState(false);
  const [tamanhoFonte, setTamanhoFonte] = useState('normal'); // 'normal' | 'grande' | 'extra-grande'
  const [altoContraste, setAltoContraste] = useState(false);
  const [lendoAudio, setLendoAudio] = useState(false);
  const [mostrarGuiaEvidencias, setMostrarGuiaEvidencias] = useState(false);
  const [gravandoVoz, setGravandoVoz] = useState(false);

  // Determina o estado dinâmico do mascote amigável
  const estadoMascote = carregando
    ? 'loading'
    : resultado?.erro
    ? 'erro'
    : resultado
    ? 'result'
    : texto.trim().length > 0
    ? 'typing'
    : 'idle';

  const interromperAudio = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setLendoAudio(false);
    }
  }, []);

  const verificar = useCallback(
    async (textoParaVerificar) => {
      const consulta = textoParaVerificar ?? texto;

      if (!consulta || consulta.trim().length < 5) {
        return;
      }

      setTexto(consulta);
      setCarregando(true);
      setResultado(null);
      interromperAudio();

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

        if (!res.ok) {
          setResultado({
            erro:
              data.erro ||
              'Não foi possível realizar a verificação no momento.',
          });
          return;
        }

        setResultado(data);
      } catch (erro) {
        console.error(erro);
        setResultado({
          erro:
            'Não foi possível conectar ao servidor de checagem. Verifique sua conexão e tente novamente.',
        });
      } finally {
        setCarregando(false);
      }
    },
    [texto, interromperAudio]
  );

  function novaConsulta() {
    setTexto('');
    setResultado(null);
    interromperAudio();
  }

  function alternarAudio(textoEspecifico) {
    if (!('speechSynthesis' in window)) {
      alert('Seu navegador não possui suporte para leitura em voz alta.');
      return;
    }

    if (lendoAudio && !textoEspecifico) {
      interromperAudio();
      return;
    }

    window.speechSynthesis.cancel();

    let textoParaFalar = '';
    if (textoEspecifico && typeof textoEspecifico === 'string') {
      textoParaFalar = textoEspecifico;
    } else if (resultado) {
      textoParaFalar = `Resultado da checagem: ${resultado.classificacao || 'Concluído'}. `;
      if (resultado.explicacao) {
        textoParaFalar += `Explicação: ${resultado.explicacao}. `;
      }
      if (resultado.nivel_risco) {
        textoParaFalar += `Nível de risco estimado: ${resultado.nivel_risco}. `;
      }
      textoParaFalar += 'Lembre-se: nunca mude ou pare seus medicamentos por conta própria. Consulte sempre o médico do posto de saúde.';
    } else {
      textoParaFalar =
        'MedFact. Plataforma de checagem em saúde para a terceira idade. Digite a informação ou escolha um dos exemplos para verificar.';
    }

    const utter = new SpeechSynthesisUtterance(textoParaFalar);
    utter.lang = 'pt-BR';
    utter.rate = 0.92; // Ritmo mais calmo e claro para facilidade de compreensão
    utter.onstart = () => setLendoAudio(true);
    utter.onend = () => setLendoAudio(false);
    utter.onerror = () => setLendoAudio(false);

    window.speechSynthesis.speak(utter);
  }

  function alternarDitadoVoz() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        'Seu navegador não suporta ditado por voz. Recomendamos utilizar o navegador Google Chrome no computador ou celular.'
      );
      return;
    }

    if (gravandoVoz) {
      setGravandoVoz(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setGravandoVoz(true);
      recognition.onresult = (event) => {
        const transcricao = event.results[0][0].transcript;
        if (transcricao) {
          setTexto((prev) =>
            prev.trim() ? `${prev.trim()} ${transcricao}` : transcricao
          );
        }
      };
      recognition.onerror = () => setGravandoVoz(false);
      recognition.onend = () => setGravandoVoz(false);

      recognition.start();
    } catch (e) {
      console.error(e);
      setGravandoVoz(false);
    }
  }

  // Cancelar áudio ao desmontar componente
  useEffect(() => {
    return () => {
      interromperAudio();
    };
  }, [interromperAudio]);

  // Atalho de teclado acessível (Ctrl + Enter ou Cmd + Enter)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        if (texto.trim().length >= 5 && !carregando) {
          verificar();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [texto, carregando, verificar]);

  return (
    <div
      className={`pagina fonte-${tamanhoFonte} ${
        altoContraste ? 'alto-contraste' : ''
      }`}
    >
      {/* Link de Acessibilidade Direta para Navegação por Teclado */}
      <a href="#conteudo-principal" className="link-pular-conteudo">
        Pular para o conteúdo principal
      </a>

      {/* Modal Informativo Sobre o Projeto */}
      <AboutModal
        aberto={modalSobreAberto}
        aoFechar={() => setModalSobreAberto(false)}
      />

      {/* Barra de Acessibilidade Superior */}
      <AccessibilityBar
        tamanhoFonte={tamanhoFonte}
        aoMudarTamanhoFonte={setTamanhoFonte}
        aoAumentarFonte={() => {
          if (tamanhoFonte === 'normal') setTamanhoFonte('grande');
          else if (tamanhoFonte === 'grande') setTamanhoFonte('extra-grande');
        }}
        aoDiminuirFonte={() => {
          if (tamanhoFonte === 'extra-grande') setTamanhoFonte('grande');
          else if (tamanhoFonte === 'grande') setTamanhoFonte('normal');
        }}
        altoContraste={altoContraste}
        aoAlternarContraste={() => setAltoContraste((prev) => !prev)}
        lendoAudio={lendoAudio}
        aoAlternarAudio={() => alternarAudio()}
        temResultado={!!resultado}
        aoAbrirSobre={() => setModalSobreAberto(true)}
      />

      {/* Cabeçalho da Aplicação */}
      <header className="topo" role="banner">
        <div className="topo-conteudo">
          <div className="marca-container">
            <LogoIcon
              width={42}
              height={42}
              className="logo-imagem-site"
            />
            <span className="marca">MedFact</span>
          </div>

          <span className="tag-subtitulo">
            Checagem em Saúde com Evidências Científicas
          </span>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main
        id="conteudo-principal"
        className="conteudo"
        role="main"
        tabIndex="-1"
      >
        {/* TELA INICIAL (BUSCA E MASCOTE) */}
        {!resultado && !carregando && (
          <div className="bloco-inicial-animado">
            {/* Mascote Acolhedor MedFact */}
            <section
              className="secao-mascote-home"
              aria-label="Assistente amigável MedFact"
            >
              <MascotPill
                estado={estadoMascote}
                aoClicar={() =>
                  alternarAudio(
                    'Olá! Sou o mascote do MedFact. Digite uma dúvida sobre saúde que você recebeu no WhatsApp ou clique em um dos exemplos abaixo para checar a veracidade científica.'
                  )
                }
              />
            </section>

            <h1 className="titulo-principal">
              Como podemos ajudar com sua saúde hoje?
            </h1>

            <p className="subtitulo-inicial">
              Verifique boatos, remédios caseiros ou mensagens recebidas na
              internet com respaldo de estudos médicos oficiais.
            </p>

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
                Digite ou dite a afirmação sobre saúde que deseja checar:
              </label>

              <div className="wrapper-campo-texto">
                <textarea
                  id="campo-consulta"
                  className="campo-texto"
                  rows={4}
                  placeholder="Exemplo: Me mandaram no WhatsApp dizendo que a vacina da gripe causa complicações graves... isso é verdade?"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  aria-describedby="instrucao-consulta contador-letras"
                />

                <div className="acoes-campo-texto">
                  <div className="grupo-auxiliares-input">
                    {/* Botão de Ditado por Voz */}
                    <button
                      type="button"
                      className={`btn-ditado-voz ${
                        gravandoVoz ? 'gravando' : ''
                      }`}
                      onClick={alternarDitadoVoz}
                      aria-pressed={gravandoVoz}
                      aria-label={
                        gravandoVoz
                          ? 'Parar gravação por voz'
                          : 'Ditar pergunta usando o microfone'
                      }
                      title="Falar ao invés de digitar"
                    >
                      <svg
                        className="svg-icone"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                      <span>
                        {gravandoVoz ? 'Ouvindo sua voz...' : 'Ditar por Voz'}
                      </span>
                    </button>

                    {/* Botão para Limpar texto digitado */}
                    {texto.trim().length > 0 && (
                      <button
                        type="button"
                        className="btn-limpar-texto"
                        onClick={() => setTexto('')}
                        aria-label="Limpar texto digitado"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>Limpar</span>
                      </button>
                    )}
                  </div>

                  <span
                    id="contador-letras"
                    className={`contador-caracteres ${
                      texto.trim().length >= 5 ? 'valido' : ''
                    }`}
                  >
                    {texto.trim().length < 5
                      ? 'Mínimo de 5 letras para verificar'
                      : `${texto.trim().length} letras`}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="botao-verificar"
                disabled={!texto.trim() || texto.trim().length < 5}
                aria-label="Verificar Informação"
              >
                <svg
                  className="svg-icone"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>

                <span>Verificar Informação</span>
                <span className="dica-atalho-teclado" aria-hidden="true">
                  Ctrl + Enter
                </span>
              </button>
            </form>

            {/* Temas e Dúvidas Frequentes */}
            <section
              className="temas"
              aria-label="Perguntas frequentes e exemplos de consulta"
            >
              <h2 className="titulo-secao">
                Dúvidas comuns de saúde para testar:
              </h2>

              <div className="lista-temas">
                {TEMAS.map((tema) => (
                  <button
                    key={tema.id}
                    type="button"
                    className="card-tema"
                    onClick={() => verificar(tema.pergunta)}
                    aria-label={`Verificar exemplo: ${tema.pergunta}`}
                  >
                    <div className="card-header-tema">
                      <span className="rotulo-tema">{tema.titulo}</span>
                    </div>

                    <span className="pergunta-tema">"{tema.pergunta}"</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Guia Didático e Acessível de Classificações */}
            <section
              className="guia-classificacoes"
              aria-labelledby="titulo-guia-classificacoes"
            >
              <button
                type="button"
                className="guia-classificacoes-toggle"
                onClick={() =>
                  setMostrarGuiaEvidencias(!mostrarGuiaEvidencias)
                }
                aria-expanded={mostrarGuiaEvidencias}
                aria-controls="conteudo-guia-classificacoes"
              >
                <span id="titulo-guia-classificacoes">
                  Como o MedFact classifica as afirmações? (Entenda os selos)
                </span>
                <svg
                  className={`svg-icone icone-toggle-guia ${
                    mostrarGuiaEvidencias ? 'aberto' : ''
                  }`}
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {mostrarGuiaEvidencias && (
                <div
                  id="conteudo-guia-classificacoes"
                  className="guia-classificacoes-conteudo"
                >
                  {EXPLICACAO_EVIDENCIAS.map((item) => (
                    <div key={item.classificacao} className="item-guia">
                      <span
                        className={`badge-guia ${item.badgeClass}`}
                      >
                        {item.classificacao}
                      </span>
                      <p className="texto-guia">{item.texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ESTADO DE CARREGAMENTO */}
        {carregando && (
          <div
            className="estado-carregando"
            role="status"
            aria-live="assertive"
          >
            <MascotPill
              estado="loading"
              mensagemCustomizada="Consultando bases médicas, agências de checagem e artigos científicos no PubMed. Um momento..."
            />

            <div className="spinner-medico" aria-hidden="true"></div>

            <p className="texto-carregando">
              Analisando a veracidade com rigor biomédico...
            </p>
          </div>
        )}

        {/* TELA DE RESULTADO */}
        {resultado && !carregando && (
          <section
            className="resultado"
            aria-live="polite"
            aria-labelledby="titulo-resultado"
          >
            {/* Mascote Reagindo ao Resultado */}
            <div className="secao-mascote-home">
              <MascotPill
                estado={resultado.erro ? 'erro' : 'result'}
                mensagemCustomizada={
                  resultado.erro
                    ? 'Tivemos uma dificuldade para contatar o servidor. Tente novamente em alguns segundos.'
                    : 'Pronto! Analisamos a informação. Veja os detalhes e artigos científicos abaixo.'
                }
              />
            </div>

            <div className="cabecalho-resultado">
              <span className="subtitulo-resultado" id="titulo-resultado">
                Informação que foi consultada:
              </span>

              <p className="pergunta-verificada">"{texto}"</p>
            </div>

            {/* Tratamento de Erro */}
            {resultado.erro ? (
              <div className="bloco-erro" role="alert">
                <p className="linha-erro">{resultado.erro}</p>
              </div>
            ) : (
              <>
                {/* Selo Principal de Classificação */}
                <div className="selo-container">
                  <div
                    className={`selo selo-${(
                      resultado.classificacao || 'indisponivel'
                    )
                      .toLowerCase()
                      .replace(/\s/g, '-')}`}
                    role="status"
                  >
                    <span>
                      {(
                        resultado.classificacao ||
                        'RESULTADO INDISPONÍVEL'
                      ).toUpperCase()}
                    </span>
                  </div>

                  {resultado.origem === 'camada_1' && (
                    <p className="checado-por">
                      Checado por agência jornalística:{' '}
                      <strong>
                        {resultado.evidencias?.[0]?.fonte ||
                          'Agência de Fact-Checking'}
                      </strong>
                    </p>
                  )}
                </div>

                {/* Card de Leitura em Áudio Acessível */}
                <div className="card-ouvir-resposta">
                  <div className="texto-ouvir">
                    <strong>Deseja ouvir a resposta em voz alta?</strong>
                    <p>
                      Nosso sintetizador de voz lê toda a explicação com clareza.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`btn-ouvir-principal ${
                      lendoAudio ? 'lendo' : ''
                    }`}
                    onClick={() => alternarAudio()}
                    aria-pressed={lendoAudio}
                    aria-label={
                      lendoAudio
                        ? 'Pausar leitura em voz alta'
                        : 'Ouvir resultado da checagem em voz alta'
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
                      aria-hidden="true"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                    <span>
                      {lendoAudio ? 'Pausar Leitura' : 'Ouvir Explicação'}
                    </span>
                  </button>
                </div>

                {/* Nível de Risco Clínico */}
                {resultado.nivel_risco && (
                  <div className="bloco-explicacao bloco-risco">
                    <h2 className="titulo-bloco">Nível de Risco Clínico</h2>
                    <p className="linha-detalhe">
                      Gravidade identificada: <strong>{resultado.nivel_risco}</strong>
                    </p>
                  </div>
                )}

                {/* Explicação Didática */}
                {resultado.explicacao && (
                  <div className="bloco-explicacao">
                    <h2 className="titulo-bloco">
                      O que a ciência e os órgãos médicos explicam:
                    </h2>
                    <p className="explicacao">{resultado.explicacao}</p>
                  </div>
                )}

                {/* Salvaguarda Clínica Obrigatória */}
                <div className="alerta-saude-idoso" role="note">
                  <div className="alerta-icone" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <p className="alerta-texto">
                    <strong>Aviso importante aos cuidados com sua saúde:</strong>{' '}
                    Nunca interrompa tratamentos prescritos, como remédios de
                    pressão ou insulina, nem consuma substâncias milagrosas por
                    conta própria. Converse sempre com seu médico de confiança no
                    posto de saúde ou hospital.
                  </p>
                </div>

                {/* Fontes e Estudos Científicos */}
                {resultado.evidencias && resultado.evidencias.length > 0 && (
                  <div className="bloco-fonte">
                    <h2 className="titulo-bloco">
                      Fontes Biomédicas e Estudos Consultados (PubMed / Agências)
                    </h2>

                    <div className="lista-fontes">
                      {resultado.evidencias.map((fonte, index) => (
                        <div
                          className="fonte"
                          key={fonte.id || index}
                        >
                          <p className="titulo-fonte">
                            {fonte.titulo || 'Estudo biomédico de referência'}
                          </p>

                          <p className="revista-fonte">
                            {fonte.fonte ||
                              fonte.revista ||
                              fonte.journal ||
                              'Base científica oficial'}
                            {fonte.data ? ` • Publicado em ${fonte.data}` : ''}
                          </p>

                          {fonte.classificacao && (
                            <p className="classificacao-fonte">
                              Classificação da fonte:{' '}
                              <strong>
                                {fonte.classificacao.toUpperCase()}
                              </strong>
                            </p>
                          )}

                          {fonte.url && (
                            <a
                              className="link-fonte"
                              href={fonte.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Acessar artigo: ${fonte.titulo || 'Fonte científica'}`}
                            >
                              Ver artigo no PubMed / NCBI &rarr;
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nenhuma fonte localizada */}
                {(!resultado.evidencias ||
                  resultado.evidencias.length === 0) && (
                  <div className="bloco-fonte">
                    <h2 className="titulo-bloco">Fontes consultadas</h2>
                    <p>
                      Não foram necessárias fontes externas complementares para
                      esta avaliação.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Botão de Nova Consulta */}
            <button
              type="button"
              className="botao-nova-consulta"
              onClick={novaConsulta}
              aria-label="Fazer uma nova pergunta ou checagem de saúde"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              <span>Fazer Nova Consulta</span>
            </button>
          </section>
        )}
      </main>

      {/* Rodapé Acessível e Informativo */}
      <footer className="rodape-acessivel" role="contentinfo">
        <div className="rodape-conteudo">
          <p className="rodape-titulo">
            MedFact &mdash; Plataforma de Combate à Desinformação em Saúde
          </p>

          <div className="rodape-links">
            <button
              type="button"
              onClick={() => setModalSobreAberto(true)}
              className="btn-link-rodape"
            >
              Sobre o Projeto
            </button>
            <span aria-hidden="true">&bull;</span>
            <a
              href="https://unb-sistemas-de-machine-learning.github.io/challenge_1_os_sem_classe/"
              target="_blank"
              rel="noreferrer"
              className="btn-link-rodape"
            >
              Documentação Completa
            </a>
            <span aria-hidden="true">&bull;</span>
            <span style={{ fontSize: '0.9rem', color: '#4a5568' }}>
              Universidade de Brasília (UnB)
            </span>
          </div>

          <p className="rodape-aviso">
            Desenvolvido pela equipe <strong>Os Sem Classe</strong> com foco em
            acessibilidade para pessoas idosas e cuidadores.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;