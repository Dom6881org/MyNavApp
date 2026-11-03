import React from 'react';
import { createPortal } from 'react-dom';

import { computeRouteLegs } from '../utils/routeLegs';
import { computePopoverMaxHeightPx, computePopoverPosition, MOTOR_PANEL_WIDTH_PX, PopoverAnchor, PANEL_WIDTH_PX } from '../utils/popoverPosition';

/** Même convention d’affichage que RoutingPanel (arrivée locale, #18). */
const formatClock = (epochS: number): string =>
  new Date(epochS * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatHeading = (deg: number): string => `${deg.toFixed(0).padStart(3, '0')}°`;

const formatSog = (kt: number): string => `${kt.toFixed(1)} kt`;

const formatDist = (nm: number): string => `${nm.toFixed(1)} NM`;

interface RouteDetailsProps {
  coords: [number, number][];
  etaS: number;
  /** Temps cumulés par point du tracé (optionnels : colonnes « — » si absents). */
  timesS?: number[] | null;
  /** SOG par point du tracé (optionnels : colonnes « — » si absents). */
  sogKts?: number[] | null;
  /** B1 (#133) : flags moteur par point (convention #123) — null = pur voile. */
  motorFlags?: boolean[] | null;
  /** Départ en secondes epoch — défaut : maintenant. */
  startEpochS?: number;
}

/**
 * Fiche route détaillée (issues #121/#124/#127) : repliée par défaut, un
 * bouton résume le nombre de jambes et de changements de cap. Dépliée : la
 * table s’ouvre dans un bloc **rendu en portal vers document.body** — jamais
 * dans le panneau de routage, dont l’`overflow-y: auto` clipperait tout
 * enfant positionné sortant (#127) — en `position: fixed` ancré au bouton
 * toggle (`getBoundingClientRect`, recalculé au resize et au scroll), à
 * gauche du bouton — légèrement au-dessus de lui (#129) — ou en dessous si la
 * place manque ; hauteur étirée jusqu'au bas de la fenêtre (#129) : la table
 * affiche un maximum de jambes sans jamais sortir de l'écran. Fermeture par ×,
 * re-clip, disparition de la route ; un recalcul (nouveau tracé) replie la
 * fiche. Données 100 % dérivées du résultat côté client.
 */
const RouteDetails: React.FC<RouteDetailsProps> = ({ coords, etaS, timesS, sogKts, motorFlags, startEpochS }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [anchor, setAnchor] = React.useState<PopoverAnchor | null>(null);
  const toggleRef = React.useRef<HTMLButtonElement | null>(null);

  const legs = React.useMemo(
    () => computeRouteLegs(coords, timesS, sogKts, undefined, motorFlags),
    [coords, timesS, sogKts, motorFlags]
  );

  // Nouveau tracé (recalcul) → fiche repliée, jamais une fiche périmée.
  React.useEffect(() => {
    setExpanded(false);
  }, [coords]);

  // Réancrage pendant l’ouverture : le bloc suit le bouton au resize et au
  // scroll (capture : inclut le scroll interne du panneau de routage).
  React.useEffect(() => {
    if (!expanded) return undefined;
    const measure = () => {
      const rect = toggleRef.current?.getBoundingClientRect();
      if (rect) setAnchor({ left: rect.left, top: rect.top, bottom: rect.bottom });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [expanded]);

  if (legs.length === 0) return null;

  // #137 : une route avec jambes moteur affiche le badge MOTOR en ligne dans
  // la colonne cap — le bloc s'élargit (17rem → 20rem) pour l'accueillir sans
  // décaler/comprimer les colonnes nowrap de la table ; sans moteur, rendu
  // inchangé. La largeur effective est consommée par le positionnement.
  const hasMotor = legs.some((leg) => leg.motor);
  const panelWidthPx = hasMotor ? MOTOR_PANEL_WIDTH_PX : PANEL_WIDTH_PX;

  const start = startEpochS ?? Date.now() / 1000;
  const changes = legs.length - 1;
  const summary = `${legs.length} leg${legs.length > 1 ? 's' : ''} · ${changes} course change${changes === 1 ? '' : 's'}`;
  const totalNm = legs.reduce((total, leg) => total + leg.distanceNm, 0);

  // #127 : le bloc est mesuré AVANT l’ouverture (pas de flash de bloc mal
  // placé), rendu en portal hors du panneau, et simplement absent si l’ancre
  // n’a pas pu être mesurée.
  const openPanel = () => {
    const rect = toggleRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ left: rect.left, top: rect.top, bottom: rect.bottom });
    setExpanded(true);
  };

  // Position dérivée de l'ancre : à gauche du bouton (un peu plus haut, #129)
  // ou en dessous ; hauteur maximale étirée jusqu'au bas de la fenêtre.
  // #137 : calculé avec la largeur effective (272 px, 320 px si jambes moteur).
  const position = expanded && anchor ? computePopoverPosition(anchor, panelWidthPx) : null;

  const panel =
    expanded && anchor && position ? (
      <div
        className="route-details-panel"
        style={{
          ...position,
          // #137 : largeur effective du bloc (272 px, ou 320 px si jambes
          // moteur) — le badge MOTOR tient en ligne sans comprimer la table.
          width: panelWidthPx,
          // #129 : le bloc s'étire jusqu'au bas de la fenêtre (moins la
          // marge), plancher minimal — la table affiche un maximum de jambes
          // sans jamais sortir de l'écran. Le CSS (.route-details-panel en
          // flex column) fait fléchir la zone scrollable sur cette hauteur.
          maxHeight: computePopoverMaxHeightPx(position.top)
        }}
        data-testid="route-details-panel"
      >
        <div className="map-settings-heading">
          <strong>ROUTE DETAILS</strong>
          <button
            type="button"
            aria-label="Close route details"
            title="Close route details"
            onClick={() => setExpanded(false)}
          >
            ×
          </button>
        </div>
        <div className="route-details-scroll">
          <table className="route-details-table">
            <thead>
              <tr>
                <th>Time</th>
                {/* #139 : colonne dédiée MOTOR (Time · MOTOR · Hdg · SOG · Dist)
                    — uniquement si la route contient des jambes moteur ; entête
                    vide (le badge est sa propre légende). */}
                {hasMotor && <th aria-label="Motor" />}
                <th>Hdg</th>
                <th>SOG</th>
                <th>Dist</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, index) => (
                <tr key={`${leg.startIndex}-${leg.endIndex}-${index}`}>
                  <td>{leg.durationS !== null ? formatClock(start + leg.durationS) : '—'}</td>
                  {/* B1 (#133) : badge des jambes contenant au moins un tronçon
                      moteur ; #139 : colonne dédiée, badge centré, cellule
                      vide pour les jambes voile. */}
                  {hasMotor && (
                    <td className="route-leg-motor-cell">
                      {leg.motor && <span className="route-leg-motor">MOTOR</span>}
                    </td>
                  )}
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
      </div>
    ) : null;

  return (
    <div className="route-details">
      <button
        ref={toggleRef}
        type="button"
        className="routing-details-toggle routing-mini-button"
        aria-expanded={expanded}
        aria-haspopup="dialog"
        onClick={() => (expanded ? setExpanded(false) : openPanel())}
      >
        {expanded ? `Hide route details · ${summary}` : `Route details · ${summary}`}
      </button>
      {panel !== null && createPortal(panel, document.body)}
    </div>
  );
};

export default RouteDetails;
