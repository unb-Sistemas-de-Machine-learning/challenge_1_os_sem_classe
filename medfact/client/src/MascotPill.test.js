import { render, screen, fireEvent } from '@testing-library/react';
import { MascotPill } from './MascotPill';

describe('MascotPill Component - Caixa Branca e Caixa Preta', () => {
  test('renders mascot in idle state with welcoming message', () => {
    render(<MascotPill estado="idle" />);
    const region = screen.getByRole('region', { name: /Mascote do site/i });
    expect(region).toBeInTheDocument();
    expect(
      screen.getByText(/Olá! Digite uma notícia que recebeu sobre saúde/i)
    ).toBeInTheDocument();
  });

  test('renders appropriate message for typing state', () => {
    render(<MascotPill estado="typing" />);
    expect(
      screen.getByText(/Prestando atenção no seu texto/i)
    ).toBeInTheDocument();
  });

  test('renders appropriate message for loading state', () => {
    render(<MascotPill estado="loading" />);
    expect(
      screen.getByText(/Consultando bases médicas e pesquisas científicas/i)
    ).toBeInTheDocument();
  });

  test('renders appropriate message for result state', () => {
    render(<MascotPill estado="result" />);
    expect(
      screen.getByText(/Verificação concluída. Confira os detalhes/i)
    ).toBeInTheDocument();
  });

  test('renders appropriate message for erro state', () => {
    render(<MascotPill estado="erro" />);
    expect(
      screen.getByText(/Não foi possível se conectar ao servidor no momento/i)
    ).toBeInTheDocument();
  });

  test('renders custom message override when provided', () => {
    render(
      <MascotPill
        estado="loading"
        mensagemCustomizada="Mensagem de teste personalizada para o idoso."
      />
    );
    expect(
      screen.getByText(/Mensagem de teste personalizada para o idoso/i)
    ).toBeInTheDocument();
  });

  test('triggers aoClicar callback when clicked', () => {
    const handleClick = jest.fn();
    render(<MascotPill estado="idle" aoClicar={handleClick} />);
    const mascotContainer = screen.getByRole('region', { name: /Mascote do site/i });
    fireEvent.click(mascotContainer);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
