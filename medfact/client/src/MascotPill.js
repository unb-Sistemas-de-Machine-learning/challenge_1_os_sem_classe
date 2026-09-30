import React, { useState, useEffect } from 'react';
import './MascotPill.css';

export function MascotPill({ estado = 'idle', mensagemCustomizada, aoClicar }) {
  const [piscando, setPiscando] = useState(false);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setPiscando(true);
      setTimeout(() => setPiscando(false), 220);
    }, 4000);

    return () => clearInterval(intervalo);
  }, []);

  const obterMensagem = () => {
    if (mensagemCustomizada) return mensagemCustomizada;
    switch (estado) {
      case 'typing':
        return 'Prestando atenção no seu texto... Pode continuar.';
      case 'loading':
        return 'Consultando bases médicas e pesquisas científicas. Um momento...';
      case 'result':
        return 'Verificação concluída. Confira os detalhes e as fontes abaixo.';
      case 'erro':
        return 'Não foi possível se conectar ao servidor no momento. Tente novamente.';
      case 'idle':
      default:
        return 'Olá! Digite uma notícia que recebeu sobre saúde ou clique em um exemplo abaixo para verificar se é verdadeira.';
    }
  };

  return (
    <div 
      className={`mascote-container mascote-estado-${estado}`}
      onClick={aoClicar}
      role="region"
      aria-label="Mascote do site"
    >
      {/* Balão de fala sem emojis e sem fala robotizada de IA */}
      <div className="mascote-balao" aria-live="polite">
        <p className="mascote-texto-balao">{obterMensagem()}</p>
      </div>

      {/* Ilustração da Pílula */}
      <div className="mascote-figura-wrapper">
        <svg
          className="mascote-svg"
          viewBox="0 0 160 220"
          width="120"
          height="165"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="sombra-mascote" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0f6b5c" floodOpacity="0.2" />
            </filter>

            <linearGradient id="grad-pilula-topo" x1="0" y1="0" x2="0" y2="100%">
              <stop offset="0%" stopColor="#128371" />
              <stop offset="100%" stopColor="#0f6b5c" />
            </linearGradient>

            <linearGradient id="grad-pilula-base" x1="0" y1="0" x2="0" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2f5f1" />
            </linearGradient>

            <linearGradient id="grad-bochecha" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff8a8a" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ff6b6b" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Sombra no chão */}
          <ellipse cx="80" cy="208" rx="42" ry="7" fill="#0f6b5c" opacity="0.18" className="mascote-sombra-chao" />

          {/* Grupo da Pílula */}
          <g className="mascote-corpo-grupo" filter="url(#sombra-mascote)">
            {/* Metade Superior */}
            <path
              d="M 30 90 L 30 65 A 50 50 0 0 1 130 65 L 130 90 Z"
              fill="url(#grad-pilula-topo)"
            />

            {/* Metade Inferior */}
            <path
              d="M 30 90 L 130 90 L 130 135 A 50 50 0 0 1 30 135 Z"
              fill="url(#grad-pilula-base)"
              stroke="#0f6b5c"
              strokeWidth="2.5"
            />

            {/* Divisória */}
            <line x1="28" y1="90" x2="132" y2="90" stroke="#0a4b41" strokeWidth="3.5" strokeLinecap="round" />

            {/* Brilho na pílula */}
            <path
              d="M 42 40 A 35 35 0 0 1 65 24"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.5"
            />

            {/* Cruz/Estetoscópio discreto */}
            <path
              d="M 48 92 Q 80 118 112 92"
              stroke="#1a8371"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="80" cy="110" r="6" fill="#2dd4bf" stroke="#0f6b5c" strokeWidth="2" />

            {/* Bochechas */}
            <ellipse cx="50" cy="80" rx="6" ry="3.5" fill="url(#grad-bochecha)" />
            <ellipse cx="110" cy="80" rx="6" ry="3.5" fill="url(#grad-bochecha)" />

            {/* OLHOS */}
            {piscando ? (
              <g className="mascote-olhos-piscando" stroke="#0f6b5c" strokeWidth="3.5" strokeLinecap="round">
                <path d="M 52 70 Q 60 62 68 70" />
                <path d="M 92 70 Q 100 62 108 70" />
              </g>
            ) : estado === 'loading' ? (
              <g className="mascote-olhos-loading">
                <circle cx="60" cy="68" r="8.5" fill="#1a1a1a" />
                <circle cx="100" cy="68" r="8.5" fill="#1a1a1a" />
                <circle cx="62" cy="65" r="3" fill="#ffffff" />
                <circle cx="102" cy="65" r="3" fill="#ffffff" />
              </g>
            ) : estado === 'result' ? (
              <g className="mascote-olhos-sucesso">
                <circle cx="60" cy="68" r="8" fill="#0f6b5c" />
                <circle cx="62" cy="65" r="3" fill="#ffffff" />
                <path d="M 92 68 Q 100 60 108 68" stroke="#0f6b5c" strokeWidth="3.5" strokeLinecap="round" />
              </g>
            ) : (
              <g className="mascote-olhos-normais">
                <circle cx="60" cy="68" r="9.5" fill="#0f6b5c" />
                <circle cx="62" cy="65" r="3" fill="#ffffff" />
                <circle cx="57" cy="71" r="1.2" fill="#ffffff" />

                <circle cx="100" cy="68" r="9.5" fill="#0f6b5c" />
                <circle cx="102" cy="65" r="3" fill="#ffffff" />
                <circle cx="97" cy="71" r="1.2" fill="#ffffff" />
              </g>
            )}

            {/* BOCA */}
            {estado === 'loading' ? (
              <ellipse cx="80" cy="80" rx="4.5" ry="5" fill="#0f6b5c" />
            ) : estado === 'result' ? (
              <path d="M 68 76 Q 80 90 92 76 Z" fill="#0f6b5c" />
            ) : (
              <path
                d="M 68 76 Q 80 86 92 76"
                stroke="#0f6b5c"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
