import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WindNeedleSwitch from './WindNeedleSwitch';

/** #188 : switch segmenté APPARENT | VRAI du header des cartes vent
 * (pattern #184 — jamais sur le cadran), état partagé mynav:wind-needle. */

describe('WindNeedleSwitch (#188)', () => {
  it('deux segments APPARENT et VRAI', () => {
    render(<WindNeedleSwitch mode="apparent" onChange={() => {}} testId="wind-needle-switch" />);
    expect(screen.getByRole('button', { name: 'APPARENT' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'VRAI' })).toBeTruthy();
  });

  it('segment actif marqué aria-pressed et classe active', () => {
    const { container } = render(
      <WindNeedleSwitch mode="true" onChange={() => {}} testId="wind-needle-switch" />
    );
    const apparent = screen.getByRole('button', { name: 'APPARENT' });
    const vrai = screen.getByRole('button', { name: 'VRAI' });
    expect(apparent.getAttribute('aria-pressed')).toBe('false');
    expect(vrai.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('.helm-switch-btn.active').length).toBe(1);
  });

  it('clic VRAI → onChange("true")', () => {
    const onChange = vi.fn();
    render(<WindNeedleSwitch mode="apparent" onChange={onChange} testId="wind-needle-switch" />);
    fireEvent.click(screen.getByRole('button', { name: 'VRAI' }));
    expect(onChange).toHaveBeenCalledWith('true');
  });
});
