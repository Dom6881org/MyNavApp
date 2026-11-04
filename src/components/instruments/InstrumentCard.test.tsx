import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InstrumentCard from './InstrumentCard';

describe('InstrumentCard', () => {
  it('rend le titre et le contenu enfants', () => {
    render(
      <InstrumentCard title="COG">
        <p>137°</p>
      </InstrumentCard>
    );
    expect(screen.getByText('COG')).toBeTruthy();
    expect(screen.getByText('137°')).toBeTruthy();
  });

  it('bouton de bascule cadran/numerique avec aria-label et data-mode', () => {
    render(
      <InstrumentCard title="HEEL">
        <p>12°</p>
      </InstrumentCard>
    );
    const toggle = screen.getByLabelText('HEEL display mode');
    expect(toggle.getAttribute('data-mode')).toBe('dial');
  });

  it('clic sur la bascule : dial -> numeric -> dial', () => {
    render(
      <InstrumentCard title="SOG">
        <p>4.8 kt</p>
      </InstrumentCard>
    );
    const toggle = screen.getByLabelText('SOG display mode');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('data-mode')).toBe('numeric');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('data-mode')).toBe('dial');
  });

  it('defaultMode numeric respecte au premier rendu', () => {
    render(
      <InstrumentCard title="VMG" defaultMode="numeric">
        <p>3.2 kt</p>
      </InstrumentCard>
    );
    expect(screen.getByLabelText('VMG display mode').getAttribute('data-mode')).toBe('numeric');
  });

  it('zone info optionnelle rendue si fournie', () => {
    render(
      <InstrumentCard title="WIND" info={<span role="status">GRIB</span>}>
        <p>12 kt</p>
      </InstrumentCard>
    );
    expect(screen.getByText('GRIB')).toBeTruthy();
  });
});
