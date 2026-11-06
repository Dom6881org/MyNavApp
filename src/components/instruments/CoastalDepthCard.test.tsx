import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import CoastalDepthCard from './CoastalDepthCard';

beforeEach(() => {
  window.localStorage.clear();
});

describe('CoastalDepthCard — colonne 0 m en bas (#186)', () => {
  it('géométrie des zones : rouge 0-2 m en BAS, orange 2-3, vert au-dessus', () => {
    render(<CoastalDepthCard depth={8.4} temperature={17.2} />);
    const col = screen.getByTestId('coastal-depth-column');
    const red = col.querySelector('.coastal-depth-zone-danger') as SVGRectElement;
    const orange = col.querySelector('.coastal-depth-zone-caution') as SVGRectElement;
    const green = col.querySelector('.coastal-depth-zone-safe') as SVGRectElement;
    // Échelle 0-15 sur 560 unités : 37.33 px/m, 0 m à y=560.
    expect(Number(red.getAttribute('y'))).toBeCloseTo(560 - 2 * (560 / 15), 1);
    expect(Number(red.getAttribute('height'))).toBeCloseTo(2 * (560 / 15), 1);
    expect(Number(orange.getAttribute('y'))).toBeCloseTo(560 - 3 * (560 / 15), 1);
    // Le rouge est bien EN BAS (y plus grand que l'orange).
    expect(Number(red.getAttribute('y'))).toBeGreaterThan(Number(orange.getAttribute('y')));
    expect(Number(green.getAttribute('y'))).toBe(0);
  });

  it('le marqueur est plus HAUT que la zone rouge quand ça s’approfondit', () => {
    const { rerender } = render(<CoastalDepthCard depth={8.4} temperature={17} />);
    const markerY = Number(
      (screen.getByTestId('coastal-depth-column').querySelector('.coastal-depth-marker line') as SVGLineElement).getAttribute('y1')
    );
    const redTop = Number(
      (screen.getByTestId('coastal-depth-column').querySelector('.coastal-depth-zone-danger') as SVGRectElement).getAttribute('y')
    );
    expect(markerY).toBeLessThan(redTop);

    // Plus profond → marqueur plus haut (l'échelle monte).
    rerender(<CoastalDepthCard depth={14.9} temperature={17} />);
    const markerY2 = Number(
      (screen.getByTestId('coastal-depth-column').querySelector('.coastal-depth-marker line') as SVGLineElement).getAttribute('y1')
    );
    expect(markerY2).toBeLessThan(markerY);
  });

  it('eau : voile du bas (0 m) jusqu’au marqueur', () => {
    render(<CoastalDepthCard depth={8.4} temperature={17} />);
    const water = screen.getByTestId('coastal-depth-column').querySelector('.coastal-depth-water') as SVGRectElement;
    const markerY = Number(
      (screen.getByTestId('coastal-depth-column').querySelector('.coastal-depth-marker line') as SVGLineElement).getAttribute('y1')
    );
    expect(Number(water.getAttribute('y'))).toBeCloseTo(markerY, 1);
    expect(Number(water.getAttribute('y')) + Number(water.getAttribute('height'))).toBeCloseTo(560, 1);
  });

  it('alarme sonde (flag NMEA) : alerte même au-dessus du seuil fixe', () => {
    render(<CoastalDepthCard depth={2.4} temperature={17} sensorAlarm />);
    expect(screen.getByTestId('coastal-depth-alert')).toBeTruthy();
  });
});
