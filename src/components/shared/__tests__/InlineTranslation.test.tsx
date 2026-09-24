import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineTranslation } from '../InlineTranslation';
import { translate } from '../../../i18n/translate';

describe('InlineTranslation', () => {
  it.each(['en', 'zh'] as const)(
    'preserves %s word order and emphasis without exposing markers',
    (language) => {
      const { container } = render(
        <InlineTranslation
          text={translate(language, 'dashboard.hero.protocolDescription', {
            sacredSeat: '[[sacredSeat]]',
            precedent: '[[precedent]]',
            timeDelay: '[[timeDelay]]',
          })}
          values={{
            sacredSeat: <strong>Seat</strong>,
            precedent: <strong>Precedent</strong>,
            timeDelay: <strong>Delay</strong>,
          }}
        />,
      );
      expect(container.textContent).toBe(
        translate(language, 'dashboard.hero.protocolDescription', {
          sacredSeat: 'Seat',
          precedent: 'Precedent',
          timeDelay: 'Delay',
        }),
      );
      expect(container.querySelectorAll('strong')).toHaveLength(3);
      expect(container.textContent).not.toContain('[[');
    },
  );

  it('renders interpolated user content as text and retains unknown markers', () => {
    const { container } = render(
      <InlineTranslation
        text="Before [[content]] [[unknown]] [[constructor]] after"
        values={{ content: <span>{'<script>alert(1)</script>'}</span> }}
      />,
    );
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toBe(
      'Before <script>alert(1)</script> [[unknown]] [[constructor]] after',
    );
  });
});
