export const formatCoordinate = (value: number, isLatitude: boolean): string => {
  const degrees = Math.floor(Math.abs(value));
  const minutes = (Math.abs(value) - degrees) * 60;
  const direction = isLatitude
    ? value >= 0 ? 'N' : 'S'
    : value >= 0 ? 'E' : 'W';
  return `${degrees}°${minutes.toFixed(3)}'${direction}`;
};
