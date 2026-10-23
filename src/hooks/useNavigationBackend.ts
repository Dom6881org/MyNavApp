import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendNavigationSnapshot, BrowserNavigationUpdate } from '../types';

interface BackendStatus {
  isConnected: boolean;
  error: string | null;
}

export const useNavigationBackend = () => {
  const [snapshot, setSnapshot] = useState<BackendNavigationSnapshot | null>(null);
  const [status, setStatus] = useState<BackendStatus>({ isConnected: false, error: null });
  const lastPostError = useRef<string | null>(null);

  useEffect(() => {
    const events = new EventSource('/api/navigation/events');
    events.onopen = () => {
      lastPostError.current = null;
      setStatus({ isConnected: true, error: null });
    };
    events.onmessage = event => {
      try {
        const value: unknown = JSON.parse(event.data);
        if (typeof value !== 'object' || value === null || !('navigation' in value)) {
          throw new Error('Backend sent an invalid navigation event.');
        }
        setSnapshot(value as BackendNavigationSnapshot);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid navigation event.';
        console.error(message, error);
        setStatus({ isConnected: false, error: message });
      }
    };
    events.onerror = () => setStatus({
      isConnected: false,
      error: 'Local navigation backend is unavailable.'
    });
    return () => events.close();
  }, []);

  const postBrowserNavigation = useCallback(async (update: BrowserNavigationUpdate) => {
    try {
      const response = await fetch('/api/navigation/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      if (!response.ok) {
        throw new Error(`Local navigation backend returned status ${response.status}.`);
      }
      lastPostError.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send browser navigation data.';
      setStatus(previous => previous.error === message ? previous : { ...previous, error: message });
      if (lastPostError.current !== message) console.error(message, error);
      lastPostError.current = message;
    }
  }, []);

  return { snapshot, status, postBrowserNavigation };
};
