import { useState, useEffect } from 'react';
import { DashboardLayout, InstrumentType, UnitChangeHandler } from '../types';

const DEFAULT_LAYOUT: DashboardLayout = {
  instruments: [
    { id: 'speed', type: 'speed', title: 'Speed', visible: true, position: { x: 0, y: 0 }, size: { width: 2, height: 2 } },
    { id: 'compass', type: 'compass', title: 'Course', visible: true, position: { x: 2, y: 0 }, size: { width: 2, height: 2 } },
    { id: 'wind', type: 'wind', title: 'Wind', visible: true, position: { x: 0, y: 2 }, size: { width: 2, height: 2 } },
    { id: 'depth', type: 'depth', title: 'Depth', visible: true, position: { x: 2, y: 2 }, size: { width: 2, height: 2 } },
    { id: 'map', type: 'map', title: 'Map', visible: false, position: { x: 0, y: 0 }, size: { width: 2, height: 2 } }
  ],
  theme: 'dark',
  units: {
    speed: 'knots',
    depth: 'meters',
    temperature: 'celsius'
  }
};


export const useDashboardLayout = () => {
  const [layout, setLayout] = useState<DashboardLayout>(() => {
    const saved = localStorage.getItem('dashboardLayout');
    if (!saved) return DEFAULT_LAYOUT;

    const parsed: DashboardLayout = JSON.parse(saved);
    // The GPS card was removed: drop it from layouts saved by earlier versions.
    return {
      ...parsed,
      instruments: parsed.instruments
        .filter(instr => (instr.type as string) !== 'gps')
        .map(instr => instr.type === 'depth' ? { ...instr, visible: true } : instr)
    };
  });

  const [selectedInstrument, setSelectedInstrument] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('dashboardLayout', JSON.stringify(layout));
  }, [layout]);

  const setTheme =  (theme: 'light' | 'dark' | 'night') => {
    setLayout(prev => ({ ...prev, theme }));
  };

  const setUnit: UnitChangeHandler = (unitType, value) => {
    setLayout(prev => ({
      ...prev,
      units: { ...prev.units, [unitType]: value }
    }));
  };

  const moveInstrument = (id: string, newPosition: { x: number; y: number }) => {
    setLayout(prev => ({
      ...prev,
      instruments: prev.instruments.map(instr =>
        instr.id === id ? { ...instr, position: newPosition } : instr
      )
    }));
  };

  const resizeInstrument = (id: string, newSize: { width: number; height: number }) => {
    setLayout(prev => ({
      ...prev,
      instruments: prev.instruments.map(instr =>
        instr.id === id ? { ...instr, size: newSize } : instr
      )
    }));
  };

  const addInstrument = (type: InstrumentType) => {
    const newId = `${type}-${Date.now()}`;
    setLayout(prev => ({
      ...prev,
      instruments: [
        ...prev.instruments,
        {
          id: newId,
          type,
          title: type.charAt(0).toUpperCase() + type.slice(1),
          visible: true,
          position: { x: 0, y: prev.instruments.length * 2 },
          size: { width: 2, height: 2 }
        }
      ]
    }));
  };

  const removeInstrument = (id: string) => {
    setLayout(prev => ({
      ...prev,
      instruments: prev.instruments.filter(instr => instr.id !== id)
    }));
  };

  return {
    layout,
    selectedInstrument,
    setSelectedInstrument,
    setTheme,
    setUnit,
    moveInstrument,
    resizeInstrument,
    addInstrument,
    removeInstrument
  };
};

export default useDashboardLayout;
