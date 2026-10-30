import { useCallback, useState } from 'react';
import { RoutingPlan, RoutingRouteResult, RoutingWindInput } from '../types';

export interface RoutingRouteApi {
  route: RoutingRouteResult | null;
  isLoading: boolean;
  error: string | null;
  compute: (plan: RoutingPlan, wind: RoutingWindInput | null) => Promise<void>;
  clear: () => void;
}

/**
 * Calcul de la route (issue #17) : appelle POST /api/routing/compute avec le
 * plan de routage et le vent courant, expose le résultat pour l'affichage carte
 * (LineString GeoJSON ou meilleure progression) et le statut du panneau.
 */
export const useRoutingRoute = (): RoutingRouteApi => {
  const [route, setRoute] = useState<RoutingRouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(async (plan: RoutingPlan, wind: RoutingWindInput | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/routing/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: plan.startPosition,
          finish: plan.finishPosition,
          polarId: plan.polarId,
          wind
        })
      });
      const value = await response.json() as RoutingRouteResult & { error?: string };
      if (!response.ok) {
        setError(value.error ?? 'Routing computation failed.');
        setRoute(null);
        return;
      }
      setRoute(value);
    } catch {
      setError('Backend unreachable: routing computation unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setRoute(null);
    setError(null);
  }, []);

  return { route, isLoading, error, compute, clear };
};

export default useRoutingRoute;
