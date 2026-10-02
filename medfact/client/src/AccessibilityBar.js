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
        <div className="grupo-acoes-direita">
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
