import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportMapPerformance } from './mapPerformance';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('reportMapPerformance', () => {
  it('does not record or log measurements unless profiling is enabled', () => {
    vi.stubEnv('VITE_MAP_PERF', '0');
    const mark = vi.spyOn(performance, 'mark');
    const measure = vi.spyOn(performance, 'measure');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    reportMapPerformance('wind-barb-sync', 2, { count: 4 });

    expect(mark).not.toHaveBeenCalled();
    expect(measure).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('records a Performance timeline mark and logs the measurement when enabled', () => {
    vi.stubEnv('VITE_MAP_PERF', '1');
    const mark = vi.spyOn(performance, 'mark');
    const measure = vi.spyOn(performance, 'measure');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    reportMapPerformance('wind-barb-sync', 2, { count: 4, zoom: 14 });

    expect(mark).toHaveBeenCalledWith('wind-barb-sync', {
      detail: { durationMs: 2, count: 4, zoom: 14 }
    });
    expect(measure).toHaveBeenCalledWith('wind-barb-sync', expect.objectContaining({
      start: expect.any(Number),
      end: expect.any(Number)
    }));
    expect(log).toHaveBeenCalledWith('[map-perf] wind-barb-sync', {
      durationMs: 2,
      count: 4,
      zoom: 14
    });
  });
});
