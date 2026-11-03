import React from 'react';

import { computeRouteLegs } from '../utils/routeLegs';

/** Même convention d’affichage que RoutingPanel (arrivée locale, #18). */
const formatClock = (epochS: number): string =>
  new Date(epochS * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatHeading = (deg: number): string => `${deg.toFixed(0).padStart(3, '0')}°`;

const formatSog = (kt: number): string => `${kt.toFixed(1)} kt`;

const formatDist = (nm: number): string => `${nm.toFixed(1)} NM`;

interface RouteDetailsProps {
  coords: [number, number][];
  etaS: number;
  /** Temps cumulés par tronçon (optionnels : colonnes « — » si absents). */
  timesS?: number[] | null;
  /** SOG par tronçon (optionnels : colonnes « — » si absents). */
  sogKts?: number[] | null;
  /** Départ en secondes epoch — défaut : maintenant. */
  startEpochS?: number;
}

/**
 * Fiche route détaillée (issue #121) : repliée par défaut, un bouton résume
 * le nombre de jambes (tronçons à cap quasi constant) et de changements de
 * cap. Dépliée : une ligne par jambe — heure de passage au cap, cap (3
 * chiffres), SOG moyen et distance de la jambe — puis l’arrivée avec
 * distance totale. Données 100 % dérivées du résultat de routage côté
 * client : aucun appel réseau, aucun changement serveur/moteur.
 */
const RouteDetails: React.FC<RouteDetailsProps> = ({ coords, etaS, timesS, sogKts, startEpochS }) => {
  const [expanded, setExpanded] = React.useState(false);

  const legs = React.useMemo(
    () => computeRouteLegs(coords, timesS, sogKts),
    [coords, timesS, sogKts]
  );

  if (legs.length === 0) return null;

  const start = startEpochS ?? Date.now() / 1000;
  const changes = legs.length - 1;
  const summary = `${legs.length} leg${legs.length > 1 ? 's' : ''} · ${changes} course change${changes === 1 ? '' : 's'}`;
  const totalNm = legs.reduce((total, leg) => total + leg.distanceNm, 0);

  return (
    <div className="route-details">
      <button
        type="button"
        className="routing-details-toggle routing-mini-button"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
      >
        {expanded ? `Hide route details · ${summary}` : `Route details · ${summary}`}
      </button>
      {expanded && (
        <div className="route-details-scroll">
          <table className="route-details-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Hdg</th>
                <th>SOG</th>
                <th>Dist</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, index) => (
                <tr key={`${leg.startIndex}-${leg.endIndex}-${index}`}>
                  <td>{leg.durationS !== null ? formatClock(start + leg.durationS) : '—'}</td>
                  <td>{formatHeading(leg.headingDeg)}</td>
                  <td>{leg.sogKts !== null ? formatSog(leg.sogKts) : '—'}</td>
                  <td>{formatDist(leg.distanceNm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="route-details-arrival">
            Arr. {formatClock(start + etaS)} · {formatDist(totalNm)}
          </p>
        </div>
      )}
    </div>
  );
};

export default RouteDetails;
