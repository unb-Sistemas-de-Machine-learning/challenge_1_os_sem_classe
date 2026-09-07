import { useState } from 'react';
import './App.css';

function App() {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function verificar() {
    setCarregando(true);
    setResultado(null);
    try {
      const res = await fetch('http://localhost:3001/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const data = await res.json();
      setResultado(data);
    } catch (erro) {
      setResultado({ erro: 'Não foi possível conectar ao servidor.' });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="App" style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>MedFact</h1>
      <textarea
        className="textarea"
        rows={4}
        style={{ width: '100%' }}
        placeholder="Faça sua pergunta"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button onClick={verificar} disabled={carregando || !texto} style={{ marginTop: 8 }}>
        {carregando ? 'Verificando...' : 'Verificar'}
      </button>

      {resultado && (
        <div style={{ marginTop: 24, padding: 16, border: '1px solid #ccc', borderRadius: 8 }}>
          {resultado.erro ? (
            <p>{resultado.erro}</p>
          ) : (
            <>
              <p><strong>Origem:</strong> {resultado.origem === 'camada_1' ? `Checagem existente (${resultado.agencia})` : 'Análise MedFact'}</p>
              <p><strong>Classificação:</strong> {resultado.classificacao}</p>
              {resultado.tipo && <p><strong>Tipo:</strong> {resultado.tipo}</p>}
              {resultado.nivel_risco && <p><strong>Risco:</strong> {resultado.nivel_risco}</p>}
              {resultado.explicacao && <p><strong>Explicação:</strong> {resultado.explicacao}</p>}
              {resultado.url && <p><a href={resultado.url} target="_blank" rel="noreferrer">Ver checagem original</a></p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;