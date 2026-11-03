/**
 * Positionnement d'un bloc popover en `position: fixed` (issues #127/#129).
 *
 * Le bloc de détail de route est rendu en portal vers document.body et ancré
 * à son bouton toggle via getBoundingClientRect : à gauche du bouton si la
 * place suffit, sinon en dessous (repli géométrique réel — écran étroit ou
 * bouton près du bord gauche). #129 : en mode « à gauche », le bloc est
 * décalé légèrement AU-DESSUS du bouton (SIDE_LIFT_PX) pour gagner de la
 * place, et sa hauteur est étirée jusqu'au bas de la fenêtre — la table
 * affiche ainsi un maximum de jambes sans jamais sortir de l'écran.
 * Fonction pure, testée isolément.
 */

/** Largeur du bloc (doit rester synchrone avec .route-details-panel en CSS). */
export const PANEL_WIDTH_PX = 17 * 16;

/** #137 : largeur quand la route contient des jambes moteur. Le badge MOTOR
 * (en ligne dans la cellule cap, ~49 px) ne tient pas dans 17rem sans élargir
 * la colonne Hdg et décaler/comprimer les colonnes nowrap de la table — le
 * bloc s'élargit de 3rem pour l'accueillir sur la ligne du cap. */
export const MOTOR_PANEL_WIDTH_PX = 20 * 16;

/** Écart entre le bloc et son bouton d'ancrage (px). */
export const ANCHOR_GAP_PX = 8;

/** #129 : décalage du bloc vers le HAUT par rapport au bouton en mode « à gauche » (px). */
export const SIDE_LIFT_PX = 40;

/** #129 : hauteur minimale du bloc (px) — même au prix d'un léger débord bas sur tout petit écran. */
export const POPOVER_MIN_HEIGHT_PX = 160;

/** Rect du bouton d'ancrage, tel que mesuré par getBoundingClientRect. */
export interface PopoverAnchor {
  left: number;
  top: number;
  bottom: number;
}

export interface PopoverPosition {
  left: number;
  top: number;
}

/** #137 : la largeur du bloc est paramétrable (272 px par défaut, 320 px quand
 * la fiche contient des jambes moteur) — les deux modes « à gauche » et
 * « en dessous » comptent la largeur effective du bloc rendu. */
export const computePopoverPosition = (
  anchor: PopoverAnchor,
  panelWidthPx: number = PANEL_WIDTH_PX
): PopoverPosition => {
  const sideLeft = anchor.left - panelWidthPx - ANCHOR_GAP_PX;
  if (sideLeft >= ANCHOR_GAP_PX) {
    // #129 : un peu plus haut que le bouton — plus de place pour les jambes,
    // sans jamais passer au-dessus du bord supérieur de la fenêtre.
    return { left: sideLeft, top: Math.max(ANCHOR_GAP_PX, anchor.top - SIDE_LIFT_PX) };
  }
  // Pas de place à gauche : en dessous du bouton, borné aux bords de la fenêtre.
  const belowLeft = Math.max(
    ANCHOR_GAP_PX,
    Math.min(anchor.left, window.innerWidth - panelWidthPx - ANCHOR_GAP_PX)
  );
  return { left: belowLeft, top: anchor.bottom + ANCHOR_GAP_PX };
};

/**
 * #129 : hauteur maximale du bloc pour que son bas reste dans la fenêtre :
 * tout l'espace vertical sous `top`, moins la marge de bord — plancher
 * POPOVER_MIN_HEIGHT_PX pour que le bloc reste utilisable sur tout petit
 * écran (un léger débord bas y vaut mieux qu'une fiche illisible).
 */
export const computePopoverMaxHeightPx = (top: number): number =>
  Math.max(POPOVER_MIN_HEIGHT_PX, window.innerHeight - top - ANCHOR_GAP_PX);
