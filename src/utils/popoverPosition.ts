/**
 * Positionnement d'un bloc popover en `position: fixed` (issue #127).
 *
 * Le bloc de détail de route est rendu en portal vers document.body et ancré
 * à son bouton toggle via getBoundingClientRect : à gauche du bouton si la
 * place suffit, sinon en dessous (repli géométrique réel — écran étroit ou
 * bouton près du bord gauche). Fonction pure, testée isolément.
 */

/** Largeur du bloc (doit rester synchrone avec .route-details-panel en CSS). */
export const PANEL_WIDTH_PX = 17 * 16;

/** Écart entre le bloc et son bouton d'ancrage (px). */
export const ANCHOR_GAP_PX = 8;

/** Rect du bouton d'ancrage, tel que mesuré par getBoundingClientRect. */
export interface PopoverAnchor {
  left: number;
  top: number;
  bottom: number;
}

export const computePopoverPosition = (anchor: PopoverAnchor): { left: number; top: number } => {
  const sideLeft = anchor.left - PANEL_WIDTH_PX - ANCHOR_GAP_PX;
  if (sideLeft >= ANCHOR_GAP_PX) return { left: sideLeft, top: anchor.top };
  // Pas de place à gauche : en dessous du bouton, borné aux bords de la fenêtre.
  const belowLeft = Math.max(
    ANCHOR_GAP_PX,
    Math.min(anchor.left, window.innerWidth - PANEL_WIDTH_PX - ANCHOR_GAP_PX)
  );
  return { left: belowLeft, top: anchor.bottom + ANCHOR_GAP_PX };
};
