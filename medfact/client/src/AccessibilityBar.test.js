import { render, screen, fireEvent } from '@testing-library/react';
import { AccessibilityBar } from './AccessibilityBar';

describe('AccessibilityBar Component - Caixa Branca e Caixa Preta', () => {
  const defaultProps = {
    tamanhoFonte: 'normal',
    aoMudarTamanhoFonte: jest.fn(),
    aoAumentarFonte: jest.fn(),
    aoDiminuirFonte: jest.fn(),
    altoContraste: false,
    aoAlternarContraste: jest.fn(),
    lendoAudio: false,
    aoAlternarAudio: jest.fn(),
    temResultado: false,
    aoAbrirSobre: jest.fn(),
  };

  test('renders all accessibility tools and controls', () => {
    render(<AccessibilityBar {...defaultProps} />);
    expect(screen.getByText(/Tamanho da letra:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tamanho de letra padrão/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tamanho de letra grande/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tamanho de letra extra grande/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ativar modo de alto contraste/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ouvir conteúdo em voz alta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir informações sobre o projeto MedFact/i })).toBeInTheDocument();
  });

  test('clicking font size buttons triggers aoMudarTamanhoFonte', () => {
    const handleMudarFonte = jest.fn();
    render(<AccessibilityBar {...defaultProps} aoMudarTamanhoFonte={handleMudarFonte} />);

    fireEvent.click(screen.getByRole('button', { name: /Tamanho de letra grande/i }));
    expect(handleMudarFonte).toHaveBeenCalledWith('grande');

    fireEvent.click(screen.getByRole('button', { name: /Tamanho de letra extra grande/i }));
    expect(handleMudarFonte).toHaveBeenCalledWith('extra-grande');
  });

  test('toggles high contrast button and text state', () => {
    const handleAlternarContraste = jest.fn();
    const { rerender } = render(
      <AccessibilityBar
        {...defaultProps}
        altoContraste={false}
        aoAlternarContraste={handleAlternarContraste}
      />
    );

    const btnContraste = screen.getByRole('button', { name: /Ativar modo de alto contraste/i });
    expect(btnContraste).toHaveTextContent(/Alto Contraste/i);
    fireEvent.click(btnContraste);
    expect(handleAlternarContraste).toHaveBeenCalledTimes(1);

    // Re-render in high contrast mode
    rerender(
      <AccessibilityBar
        {...defaultProps}
        altoContraste={true}
        aoAlternarContraste={handleAlternarContraste}
      />
    );
    expect(screen.getByRole('button', { name: /Desativar modo de alto contraste/i })).toHaveTextContent(/Contraste Normal/i);
  });

  test('toggles audio button and text state', () => {
    const handleAlternarAudio = jest.fn();
    const { rerender } = render(
      <AccessibilityBar
        {...defaultProps}
        lendoAudio={false}
        aoAlternarAudio={handleAlternarAudio}
      />
    );

    const btnAudio = screen.getByRole('button', { name: /Ouvir conteúdo em voz alta/i });
    expect(btnAudio).toHaveTextContent(/Ouvir Página/i);
    fireEvent.click(btnAudio);
    expect(handleAlternarAudio).toHaveBeenCalledTimes(1);

    // Re-render during active audio playback
    rerender(
      <AccessibilityBar
        {...defaultProps}
        lendoAudio={true}
        aoAlternarAudio={handleAlternarAudio}
      />
    );
    expect(screen.getByRole('button', { name: /Pausar leitura em áudio/i })).toHaveTextContent(/Pausar Áudio/i);
  });

  test('clicking about button triggers aoAbrirSobre', () => {
    const handleAbrirSobre = jest.fn();
    render(<AccessibilityBar {...defaultProps} aoAbrirSobre={handleAbrirSobre} />);

    fireEvent.click(screen.getByRole('button', { name: /Abrir informações sobre o projeto MedFact/i }));
    expect(handleAbrirSobre).toHaveBeenCalledTimes(1);
  });
});
