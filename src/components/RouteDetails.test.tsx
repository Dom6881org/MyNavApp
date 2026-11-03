import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RouteDetails from './RouteDetails';
import { ANCHOR_GAP_PX, MOTOR_PANEL_WIDTH_PX, PANEL_WIDTH_PX, SIDE_LIFT_PX } from '../utils/popoverPosition';

/** 5 points : 2 segments plein nord (cap 000°) puis 2 plein est (cap 090°). */
const COORDS: [number, number][] = [
  [47.5, -4.5],
  [47.51, -4.5],
  [47.52, -4.5],
  [47.52, -4.44],
  [47.52, -4.38]
];
/** Convention moteur (#123) : une entrée PAR POINT — timesS[0] = 0, timesS[last] = etaS,
 *  sogKts[j] = vitesse d'arrivée au point j (sogKts[0] artificiel). */
const TIMES_S = [0, 1800, 3600, 5400, 7200];
const SOG_KTS = [5.2, 5.2, 5.0, 4.4, 4.2];
const ETA_S = 7200;
const START_EPOCH_S = 1730000000;

/** Heure de passage recalculée comme le composant (déterminisme même environnement). */
const clockAt = (epochS: number): string =>
  new Date(epochS * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Mock du rect du bouton toggle (#127) : jsdom ne fait pas de layout, on
 * fournit une géométrie explicite pour vérifier la position calculée du bloc.
 */
const mockToggleRect = (left: number, top: number, bottom: number): void => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    bottom,
    right: left + 100,
    width: 100,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RouteDetails', () => {
  it('résumé replié par défaut : jambes et changements de cap, pas de table ni de bloc', () => {
    const { container } = render(
      <RouteDetails
        coords={COORDS}
        etaS={ETA_S}
        timesS={TIMES_S}
        sogKts={SOG_KTS}
        startEpochS={START_EPOCH_S}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Route details · 2 legs · 1 course change' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Route details · 2 legs · 1 course change' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('route-details-panel')).not.toBeInTheDocument();
    expect(container.querySelector('.route-details-panel')).not.toBeInTheDocument();
  });

  it('dépliage : bloc en PORTAL hors du panneau (jamais clippable par son overflow, #127), positionné à gauche du bouton', async () => {
    mockToggleRect(800, 100, 130);
    const { container } = render(
      <RouteDetails
        coords={COORDS}
        etaS={ETA_S}
        timesS={TIMES_S}
        sogKts={SOG_KTS}
        startEpochS={START_EPOCH_S}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Route details/i }));

    const panel = screen.getByTestId('route-details-panel');
    // Cause racine #127 : le bloc vit en portal dans document.body, il n'est
    // le descendant NI du conteneur rendu, NI de .route-details (le panneau de
    // routage et son overflow-y: auto ne peuvent plus le clipper).
    expect(document.body.contains(panel)).toBe(true);
    expect(container.contains(panel)).toBe(false);
    expect(panel.closest('.route-details')).toBeNull();
    // Position fixed ancrée au bouton : à gauche (800 - largeur - écart), et
    // un peu PLUS HAUT que le bouton (#129) — plus de place pour les jambes.
    expect(panel.style.left).toBe(`${800 - PANEL_WIDTH_PX - ANCHOR_GAP_PX}px`);
    expect(panel.style.top).toBe(`${100 - SIDE_LIFT_PX}px`);
    // #137 : sans jambe moteur, la largeur reste 17rem (rendu inchangé).
    expect(panel.style.width).toBe(`${PANEL_WIDTH_PX}px`);
    // #129 : hauteur étirée jusqu'au bas de la fenêtre (moins la marge).
    expect(panel.style.maxHeight).toBe(`${window.innerHeight - (100 - SIDE_LIFT_PX) - ANCHOR_GAP_PX}px`);
    // Contenu du bloc.
    expect(screen.getByText('ROUTE DETAILS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close route details' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // entête + 2 jambes
    expect(screen.getByText('000°')).toBeInTheDocument();
    expect(screen.getByText('090°')).toBeInTheDocument();
    expect(screen.getByText('5.1 kt')).toBeInTheDocument();
    expect(screen.getByText('4.3 kt')).toBeInTheDocument();
    expect(screen.getAllByText(clockAt(START_EPOCH_S + 3600))).toHaveLength(1);
    expect(screen.getAllByText(clockAt(START_EPOCH_S + 7200))).toHaveLength(1);
    expect(screen.getByText(/^Arr\. /)).toHaveTextContent(clockAt(START_EPOCH_S + ETA_S));
    expect(screen.getByText(/^Arr\. /)).toHaveTextContent(/NM/);
  });

  it('pas de place à gauche : le bloc s’ouvre EN DESSOUS du bouton (repli géométrique #127)', async () => {
    mockToggleRect(150, 100, 130);
    render(
      <RouteDetails
        coords={COORDS}
        etaS={ETA_S}
        timesS={TIMES_S}
        sogKts={SOG_KTS}
        startEpochS={START_EPOCH_S}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Route details/i }));

    const panel = screen.getByTestId('route-details-panel');
    expect(panel.style.left).toBe('150px');
    expect(panel.style.top).toBe(`${130 + ANCHOR_GAP_PX}px`);
    // #129 : en repli dessous aussi, la hauteur exploite tout l'espace restant.
    expect(panel.style.maxHeight).toBe(`${window.innerHeight - (130 + ANCHOR_GAP_PX) - ANCHOR_GAP_PX}px`);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('fermeture par ×, re-clip du bouton, repli au recalcul (#124)', async () => {
    const { rerender } = render(
      <RouteDetails
        coords={COORDS}
        etaS={ETA_S}
        timesS={TIMES_S}
        sogKts={SOG_KTS}
        startEpochS={START_EPOCH_S}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Route details/i }));
    expect(screen.getByTestId('route-details-panel')).toBeInTheDocument();

    // × ferme le bloc, le toggle repasse replié, le bloc est démonté du DOM.
    await user.click(screen.getByRole('button', { name: 'Close route details' }));
    expect(screen.getByRole('button', { name: 'Route details · 2 legs · 1 course change' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('route-details-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Re-clip du bouton : déplie à nouveau (en portal).
    await user.click(screen.getByRole('button', { name: /Route details/i }));
    expect(screen.getByTestId('route-details-panel')).toBeInTheDocument();

    // Recalcul (nouveau tracé) : la fiche se replie, jamais de fiche périmée.
    rerender(
      <RouteDetails
        coords={[[47.6, -4.5], [47.7, -4.5]]}
        etaS={5400}
        timesS={[0, 5400]}
        sogKts={[4.5, 4.5]}
        startEpochS={START_EPOCH_S}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Route details · 1 leg · 0 course changes' })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('route-details-panel')).not.toBeInTheDocument();
  });

  it('sans timesS/sogKts : jambes affichées avec caps et distances, cellules « — »', async () => {
    render(
      <RouteDetails coords={COORDS} etaS={ETA_S} startEpochS={START_EPOCH_S} />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Route details/i }));

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('000°')).toBeInTheDocument();
    expect(screen.getByText('090°')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(4); // 2 jambes × (temps + SOG)
    expect(screen.getByText(/^Arr\. /)).toBeInTheDocument();
  });

  it('tracé trop court : rien ne s’affiche', () => {
    const { container } = render(
      <RouteDetails coords={[[47.5, -4.5]]} etaS={ETA_S} startEpochS={START_EPOCH_S} />
    );

    expect(container.querySelector('.route-details')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Route details/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('route-details-panel')).not.toBeInTheDocument();
  });

  it('#137 : route avec jambe moteur — bloc élargi à 320px, position recalculée, badge MOTOR affiché', async () => {
    mockToggleRect(800, 100, 130);
    // Convention #123 : une entrée PAR POINT — flags[2] = tronçon d'arrivée
    // au point 2 = 2e segment → 1re jambe (nord) moteur, 2e jambe (est) voile.
    render(
      <RouteDetails
        coords={COORDS}
        etaS={ETA_S}
        timesS={TIMES_S}
        sogKts={SOG_KTS}
        motorFlags={[false, false, true, false, false]}
        startEpochS={START_EPOCH_S}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Route details/i }));

    const panel = screen.getByTestId('route-details-panel');
    // #137 : le badge MOTOR tient en ligne dans la colonne cap — le bloc
    // s'élargit (272 → 320px) au lieu de comprimer les colonnes nowrap.
    expect(panel.style.width).toBe(`${MOTOR_PANEL_WIDTH_PX}px`);
    // La géométrie « à gauche » compte la largeur effective (320px).
    expect(panel.style.left).toBe(`${800 - MOTOR_PANEL_WIDTH_PX - ANCHOR_GAP_PX}px`);
    expect(panel.style.top).toBe(`${100 - SIDE_LIFT_PX}px`);
    expect(screen.getByText('MOTOR')).toBeInTheDocument();
    // Une seule des deux jambes est moteur.
    expect(screen.getAllByText('MOTOR')).toHaveLength(1);
  });
});
