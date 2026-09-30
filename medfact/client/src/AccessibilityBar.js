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
    <div className="barra-acessibilidade" role="region" aria-label="Barra de acessibilidade e informações">
      <div className="grupo-ferramentas">
        {/* Controle de Tamanho de Fonte com Aumentar / Diminuir / Padrão */}
        <div className="controle-fonte">
          <span className="rotulo-ferramenta" id="label-tamanho-fonte">Tamanho do texto:</span>
          <div className="botoes-fonte" aria-labelledby="label-tamanho-fonte">
            <button
              type="button"
              className="btn-acessivel"
              onClick={aoDiminuirFonte}
              aria-label="Diminuir tamanho do texto"
              title="Diminuir texto"
            >
              A-
            </button>
            <button
              type="button"
              className={`btn-acessivel ${tamanhoFonte === 'normal' ? 'ativo' : ''}`}
              onClick={() => aoMudarTamanhoFonte('normal')}
              aria-label="Tamanho de texto normal"
              title="Texto normal"
            >
              Padrão
            </button>
            <button
              type="button"
              className={`btn-acessivel btn-medio ${tamanhoFonte === 'grande' || tamanhoFonte === 'extra-grande' ? 'ativo' : ''}`}
              onClick={aoAumentarFonte}
              aria-label="Aumentar tamanho do texto"
              title="Aumentar texto"
            >
              A+
            </button>
          </div>
        </div>

        <div className="grupo-acoes-direita">
          {/* Botão de Alto Contraste */}
          <button
            type="button"
            className={`btn-acessibilidade-opcao ${altoContraste ? 'ativo' : ''}`}
            onClick={aoAlternarContraste}
            aria-pressed={altoContraste}
          >
            <svg className="svg-icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zM12 19A7 7 0 0 1 12 5v14z"/>
            </svg>
            <span>{altoContraste ? 'Contraste Normal' : 'Alto Contraste'}</span>
          </button>

          {/* Botão para Ouvir Resposta em Áudio */}
          {temResultado && (
            <button
              type="button"
              className={`btn-acessibilidade-opcao btn-audio ${lendoAudio ? 'lendo' : ''}`}
              onClick={aoAlternarAudio}
              aria-label={lendoAudio ? 'Pausar leitura em áudio' : 'Ouvir resposta em áudio'}
            >
              <svg className="svg-icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
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
          )}

          {/* Botão Sobre o Projeto */}
          <button
            type="button"
            className="btn-acessibilidade-opcao btn-sobre"
            onClick={aoAbrirSobre}
            aria-label="Abrir informações sobre o projeto"
          >
            <svg className="svg-icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Sobre o Projeto</span>
          </button>
        </div>
      </div>
    </div>
  );
}
