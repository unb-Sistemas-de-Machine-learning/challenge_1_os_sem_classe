import { render, screen, fireEvent } from '@testing-library/react';
import { AboutModal } from './AboutModal';

describe('AboutModal Component - Caixa Branca e Caixa Preta', () => {
  test('does not render when aberto is false', () => {
    const { container } = render(<AboutModal aberto={false} aoFechar={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders dialog content when aberto is true', () => {
    render(<AboutModal aberto={true} aoFechar={jest.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Sobre o MedFact')).toBeInTheDocument();
    expect(screen.getByText(/Resumo e Objetivos/i)).toBeInTheDocument();
    expect(screen.getByText(/Tecnologias Utilizadas/i)).toBeInTheDocument();
    expect(screen.getByText(/Os Sem Classe/i)).toBeInTheDocument();
    expect(screen.getByText(/Universidade de Brasília/i)).toBeInTheDocument();
  });

  test('calls aoFechar when close button (x) is clicked', () => {
    const handleFechar = jest.fn();
    render(<AboutModal aberto={true} aoFechar={handleFechar} />);

    const closeBtn = screen.getByRole('button', { name: /Fechar janela Sobre/i });
    fireEvent.click(closeBtn);
    expect(handleFechar).toHaveBeenCalledTimes(1);
  });

  test('calls aoFechar when Entendido button is clicked', () => {
    const handleFechar = jest.fn();
    render(<AboutModal aberto={true} aoFechar={handleFechar} />);

    const okBtn = screen.getByRole('button', { name: /Entendido/i });
    fireEvent.click(okBtn);
    expect(handleFechar).toHaveBeenCalledTimes(1);
  });

  test('calls aoFechar when clicking the overlay backdrop', () => {
    const handleFechar = jest.fn();
    render(<AboutModal aberto={true} aoFechar={handleFechar} />);

    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(handleFechar).toHaveBeenCalledTimes(1);
  });
});
