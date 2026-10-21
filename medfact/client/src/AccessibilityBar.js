import React from 'react';
import './AccessibilityBar.css';

export function AccessibilityBar({
  tamanhoFonte,
  aoMudarTamanhoFonte,
  aoAumentarFonte,
  aoDiminuirFonte,
  altoContraste,
  aoAlternarContraste,
  lendoAudio,
  aoAlternarAudio,
  temResultado,
  aoAbrirSobre
}) {
  return (
    <nav className="barra-acessibilidade" role="region" aria-label="Barra de acessibilidade e facilidades de leitura">
      <div className="grupo-ferramentas">
        {/* Controle do Tamanho da Fonte */}
        <div className="controle-fonte">
          <span className="rotulo-ferramenta" id="rotulo-tamanho-fonte">Tamanho da letra:</span>
          <div className="botoes-fonte" role="group" aria-labelledby="rotulo-tamanho-fonte">
            <button
              type="button"
              className={`btn-acessivel ${tamanhoFonte === 'normal' ? 'ativo' : ''}`}
              onClick={() => aoMudarTamanhoFonte('normal')}
              aria-label="Tamanho de letra padrão"
              title="Tamanho padrão (A)"
            >
              A
            </button>
            <button
              type="button"
              className={`btn-acessivel btn-medio ${tamanhoFonte === 'grande' ? 'ativo' : ''}`}
              onClick={() => aoMudarTamanhoFonte('grande')}
              aria-label="Tamanho de letra grande"
              title="Tamanho ampliado (A+)"
            >
              A+
            </button>
            <button
              type="button"
              className={`btn-acessivel ${tamanhoFonte === 'extra-grande' ? 'ativo' : ''}`}
              onClick={() => aoMudarTamanhoFonte('extra-grande')}
              aria-label="Tamanho de letra extra grande"
              title="Tamanho extra ampliado (A++)"
            >
              A++
            </button>
          </div>
        </div>

        {/* Ações da Direita: Contraste, Áudio e Sobre */}
        <div className="grupo-acoes-direita">
          <button
            type="button"
            className={`btn-acessibilidade-opcao ${altoContraste ? 'ativo' : ''}`}
            onClick={aoAlternarContraste}
            aria-pressed={altoContraste}
            aria-label={altoContraste ? 'Desativar modo de alto contraste' : 'Ativar modo de alto contraste'}
          >
            <svg className="svg-icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 0 20Z" fill="currentColor" />
            </svg>
            <span>{altoContraste ? 'Contraste Normal' : 'Alto Contraste'}</span>
          </button>

          <button
            type="button"
            className={`btn-acessibilidade-opcao btn-audio ${lendoAudio ? 'lendo' : ''}`}
            onClick={aoAlternarAudio}
            aria-pressed={lendoAudio}
            aria-label={lendoAudio ? 'Pausar leitura em áudio' : 'Ouvir conteúdo em voz alta'}
          >
            <svg className="svg-icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
            <span>{lendoAudio ? 'Pausar Áudio' : 'Ouvir Página'}</span>
          </button>

          <button
            type="button"
            className="btn-acessibilidade-opcao btn-sobre"
            onClick={aoAbrirSobre}
            aria-label="Abrir informações sobre o projeto MedFact"
          >
            <svg className="svg-icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Sobre o Projeto</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
