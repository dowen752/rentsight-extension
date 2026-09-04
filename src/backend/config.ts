const normalizeOrigin = (value: string): string =>
  value.trim().replace(/\/$/, '');

export const RENT_SIGHT_API_ORIGIN = normalizeOrigin(
  import.meta.env.VITE_RENTSIGHT_API_ORIGIN ?? '',
);

export const backendIsConfigured = (): boolean =>
  RENT_SIGHT_API_ORIGIN.length > 0;
