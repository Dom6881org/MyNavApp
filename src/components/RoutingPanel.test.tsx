import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RoutingPanel, { RoutingPickTarget } from './RoutingPanel';
import { useRoutingInput } from '../hooks/useRoutingInput';
import { Position } from '../types';

const POSITION: Position = { latitude: 47.5, longitude: -4.5 };

const stubPolarsFetch = () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({
      polars: [{ id: 'polaire-sugar', name: 'Sugar (Bavaria 36)' }]
    })
  }));
};

interface HarnessProps {
  currentPosition: Position | null;
  pickTarget: RoutingPickTarget | null;
  onRequestPick: (target: RoutingPickTarget) => void;
  onClose: () => void;
}

const Harness: React.FC<HarnessProps> = ({ currentPosition, pickTarget, onRequestPick, onClose }) => {
  const routing = useRoutingInput(currentPosition);
  return (
    <RoutingPanel
      routing={routing}
      pickTarget={pickTarget}
      onRequestPick={onRequestPick}
      onClose={onClose}
    />
  );
};

const renderPanel = (overrides: Partial<HarnessProps> = {}) => render(
  <Harness
    currentPosition={POSITION}
    pickTarget={null}
    onRequestPick={vi.fn()}
    onClose={vi.fn()}
    {...overrides}
  />
);

describe('RoutingPanel', () => {
  it('affiche le titre et les sections Départ / Arrivée / Polaire', async () => {
    stubPolarsFetch();
    renderPanel();

    expect(screen.getByText('ROUTING')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Departure' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Polar' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue('polaire-sugar');
    });
    expect(screen.getByRole('combobox')).toHaveDisplayValue('Sugar (Bavaria 36)');
  });

  it('le bouton de sélection du départ est désactivé tant que la position courante est utilisée', async () => {
    stubPolarsFetch();
    renderPanel();
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Pick departure on chart' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Pick departure on chart' })).toBeEnabled();
  });

  it('les boutons de sélection demandent la bonne cible', async () => {
    stubPolarsFetch();
    const onRequestPick = vi.fn();
    renderPanel({ onRequestPick });
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Pick departure on chart' }));
    expect(onRequestPick).toHaveBeenCalledWith('start');

    await user.click(screen.getByRole('button', { name: 'Pick destination on chart' }));
    expect(onRequestPick).toHaveBeenCalledWith('finish');
  });

  it('la cible active met son bouton en état sélection', () => {
    stubPolarsFetch();
    renderPanel({ pickTarget: 'finish' });

    const destinationButton = screen.getByRole('button', { name: 'Click on the chart…' });
    expect(destinationButton).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Pick destination on chart' })).not.toBeInTheDocument();
  });

  it('affiche les erreurs de validation en direct', async () => {
    stubPolarsFetch();
    renderPanel({ currentPosition: null });

    await waitFor(() => {
      expect(screen.getByText(/En attente/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Plan ready/i)).not.toBeInTheDocument();
  });

  it('saisie d’une arrivée valide : plan prêt avec distance et polaire', async () => {
    stubPolarsFetch();
    renderPanel();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('polaire-sugar'));
    await user.type(screen.getByLabelText('Destination latitude'), '47.6');
    await user.type(screen.getByLabelText('Destination longitude'), '-4.6');

    const status = await screen.findByText(/Plan ready/i);
    expect(status).toHaveTextContent(/NM/);
    expect(status).toHaveTextContent(/Sugar \(Bavaria 36\)/);
  });

  it('le bouton de fermeture appelle onClose', async () => {
    stubPolarsFetch();
    const onClose = vi.fn();
    renderPanel({ onClose });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close routing panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
