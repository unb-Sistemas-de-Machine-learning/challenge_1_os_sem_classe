import React from 'react';
import './AboutModal.css';

export function AboutModal({ aberto, aoFechar }) {
  if (!aberto) return null;

  return (
    <div className="modal-overlay" onClick={aoFechar} role="dialog" aria-modal="true" aria-labelledby="titulo-modal-sobre">
      <div className="modal-conteudo" onClick={(e) => e.stopPropagation()}>
        <div className="modal-cabecalho">
          <h2 id="titulo-modal-sobre" className="modal-titulo">Sobre o MedFact</h2>
          <button
            type="button"
            className="modal-btn-fechar"
            onClick={aoFechar}
            aria-label="Fechar janela Sobre"
          >
            &times;
          </button>
        </div>

        <div className="modal-corpo">
          {/* Resumo e Objetivos */}
          <section className="modal-secao">
            <h3 className="modal-subtitulo">Resumo e Objetivos</h3>
            <p>
              O <strong>MedFact</strong> é uma plataforma acessível desenvolvida para auxílio na verificação de notícias e afirmações sobre saúde (como vacinação, COVID-19 e doenças crônicas), com foco no atendimento a pessoas idosas.
            </p>
            <p>
              Nosso objetivo é combater a desinformação oferecendo explicações fundamentadas em linguagem simples, direta e transparente, citando agências oficiais de checagem e artigos científicos.
            </p>
          </section>

          {/* Tecnologias Utilizadas */}
          <section className="modal-secao">
            <h3 className="modal-subtitulo">Tecnologias Utilizadas</h3>
            <ul className="modal-lista-tech">
              <li><strong>Frontend:</strong> React, CSS3 Acessível, Web Speech API (Síntese e Ditado por Voz).</li>
              <li><strong>Backend:</strong> Node.js, Express.</li>
              <li><strong>Modelos e APIs:</strong> Groq LLM (Análise e linguagem acessível), Google Fact Check Tools API, PubMed E-utilities.</li>
            </ul>
          </section>

          {/* Equipe / Integrantes */}
          <section className="modal-secao">
            <h3 className="modal-subtitulo">Equipe do Projeto</h3>
            <p className="modal-equipe-nome">
              Desenvolvido pela equipe <strong>Os Sem Classe</strong>
            </p>
            <p className="modal-disciplina">
              Disciplina de Tópicos Especiais em Engenharia de Software &mdash; Universidade de Brasília (UnB)
            </p>
          </section>
        </div>

        <div className="modal-rodape">
          <button type="button" className="modal-btn-ok" onClick={aoFechar}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
