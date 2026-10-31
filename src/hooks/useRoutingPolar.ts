import { useCallback, useEffect, useState } from 'react';
import { RoutingPolarSummary } from '../types';

const POLARS_FALLBACK: RoutingPolarSummary[] = [
  { id: 'polaire-sugar', name: 'Sugar (Bavaria 36)' }
];

const POLAR_STORAGE_KEY = 'routingPolarId';

export interface RoutingPolarApi {
  polars: RoutingPolarSummary[];
  polarId: string | null;
  polarName: string;
  polarError: string | null;
  setPolarId: (id: string) => void;
}

/**
 * Polaire du bateau : paramètre global de l'application (réglages carte),
 * partagé par tous les calculs de route. Persisté en localStorage ; repli sur
 * la polaire embarquée si le backend est hors ligne.
 */
export const useRoutingPolar = (): RoutingPolarApi => {
  const [polars, setPolars] = useState<RoutingPolarSummary[]>(POLARS_FALLBACK);
  const [polarsLoaded, setPolarsLoaded] = useState(false);
  const [polarId, setPolarIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(POLAR_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [polarError, setPolarError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPolars = async () => {
      try {
        const response = await fetch('/api/routing/polars');
        const value = await response.json() as { polars?: RoutingPolarSummary[] };
        if (cancelled) return;
        const available = (value.polars ?? []).map(polar => ({ id: polar.id, name: polar.name }));
        setPolars(available.length > 0 ? available : POLARS_FALLBACK);
        setPolarError(null);
      } catch {
        if (cancelled) return;
        setPolars(POLARS_FALLBACK);
        setPolarError('Backend hors ligne : polaire par défaut');
      } finally {
        if (!cancelled) setPolarsLoaded(true);
      }
    };
    void loadPolars();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sélectionne la préférence mémorisée si elle existe, sinon la première polaire.
  // Attend le chargement réel : la liste de repli ne doit pas écraser une
  // préférence mémorisée tant que les polaires du backend ne sont pas arrivées.
  useEffect(() => {
    if (!polarsLoaded) return;
    if (polarId !== null && polars.some(polar => polar.id === polarId)) return;
    if (polars[0]) setPolarIdState(polars[0].id);
  }, [polars, polarId, polarsLoaded]);

  const setPolarId = useCallback((id: string) => {
    setPolarIdState(id);
    try {
      localStorage.setItem(POLAR_STORAGE_KEY, id);
    } catch {
      // Stockage indisponible : le choix ne dure que la session.
    }
  }, []);

  const polarName = polars.find(polar => polar.id === polarId)?.name ?? polarId ?? '';

  return { polars, polarId, polarName, polarError, setPolarId };
};

export default useRoutingPolar;
