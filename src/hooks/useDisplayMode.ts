import { useCallback, useEffect, useState } from 'react';

export type InstrumentDisplayMode = 'dial' | 'digital';

export const useDisplayMode = (storageKey: string) => {
  const [displayMode, setDisplayMode] = useState<InstrumentDisplayMode>(() => {
    try {
      return localStorage.getItem(storageKey) === 'digital' ? 'digital' : 'dial';
    } catch {
      return 'dial';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, displayMode);
    } catch {
      // Storage unavailable: keep the mode for this session only.
    }
  }, [displayMode, storageKey]);

  const toggleDisplayMode = useCallback(() => {
    setDisplayMode(previous => previous === 'dial' ? 'digital' : 'dial');
  }, []);

  return { displayMode, toggleDisplayMode };
};

export default useDisplayMode;
