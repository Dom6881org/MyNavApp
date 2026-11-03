import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import RouteDetails from './RouteDetails';

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

describe('RouteDetails', () => {
  it('résumé replié par défaut : jambes et changements de cap, pas de table ni de bloc', () => {
    render(
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
    expect(screen.queryByText('ROUTE DETAILS')).not.toBeInTheDocument();
  });

  it('dépliage au clic : bloc à côté avec titre, une ligne par jambe + arrivée', async () => {
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

    expect(screen.getByRole('button', { name: /Hide route details/i }))
      .toHaveAttribute('aria-expanded', 'true');
    // Bloc flottant #124 : titre et bouton × propres au bloc.
    expect(screen.getByText('ROUTE DETAILS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close route details' })).toBeInTheDocument();
    // Entête + 2 jambes.
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('columnheader', { name: 'Time' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Hdg' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'SOG' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Dist' })).toBeInTheDocument();
    // Jambe 1 : plein nord, 30 min après le départ, SOG moyen (5,2+5,0)/2 = 5,1 kt.
    expect(screen.getByText('000°')).toBeInTheDocument();
    expect(screen.getAllByText(clockAt(START_EPOCH_S + 3600))).toHaveLength(1);
    expect(screen.getByText('5.1 kt')).toBeInTheDocument();
    // Jambe 2 : plein est, 1 h après le départ, SOG moyen (4,4+4,2)/2 = 4,3 kt.
    expect(screen.getByText('090°')).toBeInTheDocument();
    expect(screen.getByText('4.3 kt')).toBeInTheDocument();
    // Heure de fin de jambe 2 == heure d’arrivée (timesS[last] == etaS).
    // getByText ne matche que le texte complet d’un élément : l’heure de la
    // jambe 2 est seule exacte (l’arrivée est un « Arr. … · … NM » plus long,
    // vérifié ci-dessous par sous-chaîne).
    expect(screen.getAllByText(clockAt(START_EPOCH_S + 7200))).toHaveLength(1);
    // Ligne d’arrivée : heure locale + distance totale.
    expect(screen.getByText(/^Arr\. /)).toHaveTextContent(clockAt(START_EPOCH_S + ETA_S));
    expect(screen.getByText(/^Arr\. /)).toHaveTextContent(/NM/);
  });

  it('bloc à côté : fermeture par ×, re-clip du bouton, repli au recalcul (#124)', async () => {
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
    expect(screen.getByRole('table')).toBeInTheDocument();

    // × ferme le bloc, le toggle repasse replié.
    await user.click(screen.getByRole('button', { name: 'Close route details' }));
    expect(screen.getByRole('button', { name: 'Route details · 2 legs · 1 course change' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('ROUTE DETAILS')).not.toBeInTheDocument();

    // Re-clip du bouton : déplie à nouveau.
    await user.click(screen.getByRole('button', { name: /Route details/i }));
    expect(screen.getByRole('table')).toBeInTheDocument();

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
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
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
    // La ligne d’arrivée reste utile : heure locale + distance totale.
    expect(screen.getByText(/^Arr\. /)).toBeInTheDocument();
  });

  it('tracé trop court : rien ne s’affiche', () => {
    const { container } = render(
      <RouteDetails coords={[[47.5, -4.5]]} etaS={ETA_S} startEpochS={START_EPOCH_S} />
    );

    expect(container.querySelector('.route-details')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Route details/i })).not.toBeInTheDocument();
  });
});
