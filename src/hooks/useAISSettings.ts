import { useEffect, useState } from 'react';
import type { AISBackendState, AISSource } from '../types';

const readAISSource = (): AISSource => localStorage.getItem('aisSource') === 'internet' ? 'internet' : 'local';
const readAISVisibility = (): boolean => localStorage.getItem('showAIS') !== 'false';

export const useAISSettings = (backendConnected: boolean, aisState: AISBackendState | null) => {
  const [source, setSource] = useState<AISSource>(readAISSource);
  const [isVisible, setIsVisible] = useState(readAISVisibility);

  useEffect(() => {
    localStorage.setItem('aisSource', source);
    localStorage.setItem('showAIS', String(isVisible));
  }, [source, isVisible]);

  useEffect(() => {
    if (!backendConnected) return;
    const controller = new AbortController();
    void fetch('/api/ais/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, visible: isVisible }),
      signal: controller.signal
    }).then(response => {
      if (!response.ok) throw new Error(`Local navigation backend returned status ${response.status}.`);
    }).catch(error => {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Unable to configure AIS source.', error);
    });
    return () => controller.abort();
  }, [backendConnected, source, isVisible]);

  return { source, setSource, isVisible, setIsVisible, aisState };
};
