import React from 'react';
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
const TIMES_S = [1800, 3600, 5400, 7200];
const SOG_KTS = [5.2, 5.0, 4.4, 4.2];
const ETA_S = 7200;
const START_EPOCH_S = 1730000000;

/** Heure de passage recalculée comme le composant (déterminisme même environnement). */
const clockAt = (epochS: number): string =>
  new Date(epochS * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

describe('RouteDetails', () => {
  it('résumé replié par défaut : jambes et changements de cap, pas de table', () => {
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
  });

  it('dépliage au clic : une ligne par jambe (heure, cap, SOG moyen, distance) + arrivée', async () => {
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
