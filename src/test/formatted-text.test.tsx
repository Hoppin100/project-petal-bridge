import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormattedText } from '@/components/FormattedText';

describe('FormattedText', () => {
  it('renders inline formatting without injecting HTML', () => {
    const { container } = render(
      <FormattedText text={'**Bold** and *italic* with `code` and <script>alert(1)</script>'} />,
    );
    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('renders headings and lists', () => {
    render(<FormattedText text={'## Route notes\n\n- First step\n- Second step'} />);
    expect(screen.getByRole('heading', { level: 5, name: 'Route notes' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('embeds a standalone YouTube link', () => {
    render(<FormattedText text={'https://www.youtube.com/watch?v=dQw4w9WgXcQ'} />);
    const frame = screen.getByTitle('YouTube video');
    expect(frame).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('renders images and safe links only', () => {
    const { container } = render(
      <FormattedText text={'![Gate skip](https://example.com/gate.png)'} />,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/gate.png');

    const unsafe = render(<FormattedText text={'[click](javascript:alert(1))'} />);
    expect(unsafe.container.querySelector('a')).toBeNull();
    expect(unsafe.container.textContent).toContain('click');
  });
});
