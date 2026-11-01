export const isMapProfilingEnabled = () => import.meta.env.VITE_MAP_PERF === '1';

export const reportMapPerformance = (
  name: string,
  durationMs: number,
  details: Record<string, string | number | boolean | null>
) => {
  if (!isMapProfilingEnabled() || typeof performance === 'undefined') return;

  const end = performance.now();
  const start = Math.max(0, end - durationMs);
  performance.mark(name, { detail: { durationMs, ...details } });
  performance.measure(name, { start, end });
  console.info(`[map-perf] ${name}`, { durationMs, ...details });
};
