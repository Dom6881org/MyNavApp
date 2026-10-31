import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import WindIndicator from './WindIndicator';
import { WindForecastStatus } from '../types';

const FORECAST_STATUS: WindForecastStatus = {
  isLoading: false,
  error: null,
  updatedAt: null,
  gridError: null
};

const renderIndicator = (headingDegrees: number | null) => render(
  <WindIndicator
    apparentWind={{ angleDegrees: 33, speedKnots: 20 }}
    trueWind={{ angleDegrees: 315, speedKnots: 15 }}
    forecastWind={null}
    forecastStatus={FORECAST_STATUS}
    headingDegrees={headingDegrees}
    unit="knots"
    boatSpeedKnots={6}
  />
);

describe('WindIndicator true wind (TWA)', () => {
  it('WIMWV T = TWD absolu : laiguille vraie vaut TWA = TWD - cap (315 - 270 = 45)', () => {
    const { container } = renderIndicator(270);

    const trueNeedle = container.querySelector('.wind-gauge-needle-true');
    expect(trueNeedle).not.toBeNull();
    expect(trueNeedle?.getAttribute('transform')).toBe('rotate(45 120 120)');
  });

  it('mode digital : la ligne TWA affiche TWD - cap, constant quand vent et cap constants', async () => {
    renderIndicator(270);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'DIGITAL' }));
    expect(screen.getByText('TWA')).toBeInTheDocument();
    expect(screen.getByText('45°')).toBeInTheDocument();
    expect(screen.getByText('15.0')).toBeInTheDocument();
  });

  it('sans cap connu, le TWD absolu est affiché tel quel', () => {
    const { container } = renderIndicator(null);

    const trueNeedle = container.querySelector('.wind-gauge-needle-true');
    // TWA non calculable sans cap : aiguille sur le TWD absolu normalisé (-180..180)
    expect(trueNeedle?.getAttribute('transform')).toBe('rotate(-45 120 120)');
  });
});
