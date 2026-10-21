import { render } from '@testing-library/react';
import { LogoIcon } from './LogoIcon';

describe('LogoIcon Component', () => {
  test('renders svg icon with custom dimensions and accessible attributes', () => {
    const { container } = render(<LogoIcon width={48} height={48} className="custom-logo" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('custom-logo');
  });
});
