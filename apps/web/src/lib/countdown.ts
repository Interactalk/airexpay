export interface CountdownParts {
  clock: string;
  label: string;
  minutes: number;
}

export function formatCountdown(expiresAt: string, now: number): CountdownParts | null {
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return null;
  const totalSeconds = Math.max(0, Math.floor((end - now) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const minuteWord = minutes === 1 ? 'minute' : 'minutes';
  const secondWord = seconds === 1 ? 'second' : 'seconds';
  return {
    clock,
    minutes,
    label: `Time left ${minutes} ${minuteWord} ${seconds} ${secondWord}`,
  };
}
