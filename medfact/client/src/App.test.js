import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

describe('App Main Component - Testes Caixa Branca e Caixa Preta', () => {
  test('renders header, mascot, input, and accessibility bar', () => {
    render(<App />);

    // Brand and Subtitle
    const brandElements = screen.getAllByText(/MedFact/i);
    expect(brandElements.length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Checagem em Saúde com Evidências Científicas/i)
    ).toBeInTheDocument();

    // Mascot Region
    expect(screen.getByRole('region', { name: /Mascote do site/i })).toBeInTheDocument();

    // Verify Button (initially disabled because text is empty)
    const buttonElement = screen.getByRole('button', { name: /Verificar Informação/i });
    expect(buttonElement).toBeInTheDocument();
    expect(buttonElement).toBeDisabled();

    // Accessibility Bar Controls
    expect(screen.getByText(/Tamanho da letra:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alto Contraste/i })).toBeInTheDocument();

    // Skip to main content link
    expect(
      screen.getByRole('link', { name: /Pular para o conteúdo principal/i })
    ).toBeInTheDocument();
  });

  test('typing text enables submit button and shows clean button', () => {
    render(<App />);
    const textarea = screen.getByRole('textbox', {
      name: /Digite ou dite a afirmação sobre saúde que deseja checar:/i
    });

    // Type 4 characters (below minimum 5)
    fireEvent.change(textarea, { target: { value: 'cura' } });
    const verifyBtn = screen.getByRole('button', { name: /Verificar Informação/i });
    expect(verifyBtn).toBeDisabled();

    // Type valid claim (>= 5 chars)
    fireEvent.change(textarea, { target: { value: 'A vacina da gripe causa Alzheimer?' } });
    expect(verifyBtn).toBeEnabled();

    // Limpar button appears
    const clearBtn = screen.getByRole('button', { name: /Limpar texto digitado/i });
    expect(clearBtn).toBeInTheDocument();

    // Click Limpar button
    fireEvent.click(clearBtn);
    expect(textarea.value).toBe('');
    expect(verifyBtn).toBeDisabled();
  });

  test('clicking an example question populates input and triggers verification', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            origem: 'camada_2',
            classificacao: 'falsa',
            nivel_risco: 'alto',
            probabilidade_desinformacao: 95,
            tipo: 'informação falsa',
            tema: 'vacinação',
            explicacao: 'A vacina contra a gripe é segura e não causa Alzheimer.',
            evidencias: []
          })
      })
    );

    render(<App />);

    // Click example button
    const exampleBtn = screen.getByRole('button', {
      name: /Verificar exemplo: A vacina da gripe pode causar Alzheimer\?/i
    });
    fireEvent.click(exampleBtn);

    // Should display loading or result
    await waitFor(() => {
      expect(screen.getByText(/FALSA/i)).toBeInTheDocument();
    });

    // Should display result details
    expect(
      screen.getByText(/A vacina contra a gripe é segura e não causa Alzheimer/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Fazer uma nova pergunta ou checagem de saúde/i })
    ).toBeInTheDocument();

    // Reset fetch
    global.fetch.mockClear();
  });

  test('toggles the evidence classification guide disclosure', () => {
    render(<App />);
    const guideToggle = screen.getByRole('button', {
      name: /Como o MedFact classifica as afirmações\?/i
    });
    expect(guideToggle).toHaveAttribute('aria-expanded', 'false');

    // Click to open guide
    fireEvent.click(guideToggle);
    expect(guideToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText(/VERDADEIRA/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ENGANOSA', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('NÃO VERIFICÁVEL', { selector: 'span' })).toBeInTheDocument();

    // Click to close guide
    fireEvent.click(guideToggle);
    expect(guideToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('toggles high contrast mode on the whole page', () => {
    const { container } = render(<App />);
    const paginaDiv = container.querySelector('.pagina');
    expect(paginaDiv).not.toHaveClass('alto-contraste');

    const contrastBtn = screen.getByRole('button', { name: /Ativar modo de alto contraste/i });
    fireEvent.click(contrastBtn);

    expect(paginaDiv).toHaveClass('alto-contraste');
  });
});
