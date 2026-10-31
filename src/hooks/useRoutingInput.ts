import { useCallback, useMemo, useState } from 'react';

import { Position, RoutingPlan } from '../types';

const parseCoordinate = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidPosition = (position: Position | null): position is Position =>
  position !== null
  && Number.isFinite(position.latitude)
  && Number.isFinite(position.longitude)
  && position.latitude >= -90
  && position.latitude <= 90
  && position.longitude >= -180
  && position.longitude <= 180;

const distanceNm = (start: Position, finish: Position): number => {
  const toRadians = Math.PI / 180;
  const deltaLatitude = (finish.latitude - start.latitude) * toRadians;
  const deltaLongitude = (finish.longitude - start.longitude) * toRadians;
  const meanCosLatitude = Math.cos(((start.latitude + finish.latitude) / 2) * toRadians);
  return Math.hypot(deltaLatitude, deltaLongitude * meanCosLatitude) * (180 / Math.PI) * 60;
};

/**
 * Saisie du plan de routage (issue #15) : départ (position courante, manuelle
 * ou point choisi sur la carte) et arrivée (idem). La polaire du bateau est un
 * paramètre global de l'application (voir useRoutingPolar), passé en argument.
 */
export const useRoutingInput = (currentPosition: Position | null, polarId: string | null = null) => {
  const [useCurrentPosition, setUseCurrentPosition] = useState(true);
  const [startText, setStartText] = useState({ latitude: '', longitude: '' });
  const [finishText, setFinishText] = useState({ latitude: '', longitude: '' });

  const setFinishFromPosition = useCallback((position: Position) => {
    setFinishText({
      latitude: position.latitude.toFixed(5),
      longitude: position.longitude.toFixed(5)
    });
  }, []);

  const setStartFromPosition = useCallback((position: Position) => {
    setUseCurrentPosition(false);
    setStartText({
      latitude: position.latitude.toFixed(5),
      longitude: position.longitude.toFixed(5)
    });
  }, []);

  const manualStart = useMemo<Position | null>(() => {
    const latitude = parseCoordinate(startText.latitude);
    const longitude = parseCoordinate(startText.longitude);
    return latitude === null || longitude === null ? null : { latitude, longitude };
  }, [startText]);

  const finishPosition = useMemo<Position | null>(() => {
    const latitude = parseCoordinate(finishText.latitude);
    const longitude = parseCoordinate(finishText.longitude);
    return latitude === null || longitude === null ? null : { latitude, longitude };
  }, [finishText]);

  const startPosition = useCurrentPosition ? currentPosition : manualStart;

  const startError = useCurrentPosition
    ? (isValidPosition(currentPosition) ? null : "En attente d'une position GPS valide.")
    : (isValidPosition(manualStart) ? null : 'Coordonnées de départ invalides (lat -90..90, lon -180..180).');
  const finishError = isValidPosition(finishPosition)
    ? null
    : "Coordonnées d'arrivée invalides (lat -90..90, lon -180..180).";
  const sameError = isValidPosition(startPosition)
    && isValidPosition(finishPosition)
    && startPosition.latitude === finishPosition.latitude
    && startPosition.longitude === finishPosition.longitude
    ? 'Le départ et l\'arrivée sont identiques.'
    : null;
  const polarPlanError = polarId === null ? 'Aucune polaire sélectionnée (réglages).' : null;

  const plan = useMemo<RoutingPlan | null>(() => (
    startError || finishError || sameError || polarPlanError
      ? null
      : {
          useCurrentPosition,
          startPosition: startPosition as Position,
          finishPosition: finishPosition as Position,
          polarId: polarId as string
        }
  ), [useCurrentPosition, startPosition, finishPosition, startError, finishError, sameError, polarPlanError, polarId]);

  return {
    polarId,
    useCurrentPosition,
    setUseCurrentPosition,
    startText,
    setStartText,
    finishText,
    setFinishText,
    setFinishFromPosition,
    setStartFromPosition,
    startPosition: isValidPosition(startPosition) ? startPosition : null,
    finishPosition: isValidPosition(finishPosition) ? finishPosition : null,
    distanceNm: isValidPosition(startPosition) && isValidPosition(finishPosition)
      ? distanceNm(startPosition, finishPosition)
      : null,
    errors: {
      start: startError,
      finish: finishError,
      same: sameError,
      polar: polarPlanError
    },
    plan
  };
};

export type RoutingInput = ReturnType<typeof useRoutingInput>;

export default useRoutingInput;
