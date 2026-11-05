import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import InstrumentCard from './InstrumentCard';

// Persistance par instrument (#160) : isolement des tests.
beforeEach(() => {
  window.localStorage.clear();
});

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

  it('hideToggle : pas de bouton 123/◉ pour un instrument sans cadran (#166)', () => {
    render(<InstrumentCard title="DEPTH" hideToggle>contenu</InstrumentCard>);
    expect(screen.queryByRole('button', { name: 'DEPTH display mode' })).toBeNull();
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

  it('#184 retour n°21-quater : headerPrefix rendu AVANT le titre', () => {
    render(
      <InstrumentCard
        title="COMPASS"
        hideToggle
        headerPrefix={
          <div className="helm-mode-switch" data-testid="helm-mode-switch">
            <button type="button">CADRAN</button>
          </div>
        }
      >
        <p>137°</p>
      </InstrumentCard>
    );
    const header = screen
      .getByTestId('instrument-COMPASS')
      .querySelector('.instrument-card-header');
    const children = header ? Array.from(header.children) : [];
    // le switch vient en tête, AVANT le titre
    expect(children[0].getAttribute('data-testid')).toBe('helm-mode-switch');
    expect(children[1].textContent).toBe('COMPASS');
    // hideToggle : pas de bouton 123/◉
    expect(screen.queryByRole('button', { name: 'COMPASS display mode' })).toBeNull();
  });

  it('zone info optionnelle rendue si fournie', () => {
    render(
      <InstrumentCard title="WIND" info={<span role="status">GRIB</span>}>
        <p>12 kt</p>
      </InstrumentCard>
    );
    expect(screen.getByText('GRIB')).toBeTruthy();
  });

  /* #184 retour n°21-quater : les tests du mode contrôlé et du bouton
     désactivé sont retirés avec les props mode/onModeChange/toggleDisabled
     — remplacés par headerPrefix (switch segmenté du central HELM). */
});

describe('InstrumentCard — persistance du mode (Phase 2 #160)', () => {
  it('mode persiste par titre entre deux rendus', () => {
    const { unmount } = render(
      <InstrumentCard title="WIND">
        <p>12 kt</p>
      </InstrumentCard>
    );
    fireEvent.click(screen.getByLabelText('WIND display mode'));
    expect(screen.getByLabelText('WIND display mode').getAttribute('data-mode')).toBe('numeric');
    unmount();
    // nouveau rendu : la préférence survit
    render(
      <InstrumentCard title="WIND">
        <p>12 kt</p>
      </InstrumentCard>
    );
    expect(screen.getByLabelText('WIND display mode').getAttribute('data-mode')).toBe('numeric');
  });

  it('titres distincts, préférences indépendantes', () => {
    render(
      <>
        <InstrumentCard title="WIND"><p>12 kt</p></InstrumentCard>
        <InstrumentCard title="SOG"><p>4.8 kn</p></InstrumentCard>
      </>
    );
    fireEvent.click(screen.getByLabelText('WIND display mode'));
    expect(screen.getByLabelText('WIND display mode').getAttribute('data-mode')).toBe('numeric');
    expect(screen.getByLabelText('SOG display mode').getAttribute('data-mode')).toBe('dial');
  });
});
