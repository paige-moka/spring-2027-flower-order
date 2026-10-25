import { BUSINESS } from './config';
import type { Settings } from './store/types';

export type OrderingState = { open: boolean; reason: 'open' | 'closed_by_admin' | 'deadline_passed'; deadline: string };

export function orderingState(settings: Settings, now: Date = new Date()): OrderingState {
  if (!settings.ordersOpen) return { open: false, reason: 'closed_by_admin', deadline: settings.orderDeadline };
  if (now.getTime() > new Date(settings.orderDeadline).getTime())
    return { open: false, reason: 'deadline_passed', deadline: settings.orderDeadline };
  return { open: true, reason: 'open', deadline: settings.orderDeadline };
}

/** "Tuesday, November 10, 2026 at 11:59 p.m. MST" in Alberta time. */
export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-CA', { timeZone: BUSINESS.timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = d.toLocaleTimeString('en-CA', { timeZone: BUSINESS.timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${date} at ${time}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    timeZone: BUSINESS.timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Converts an Alberta local date and time from the admin form ("2026-11-10", "23:59") to an ISO timestamp. */
export function albertaLocalToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Try both Alberta offsets (MST -7, MDT -6) and keep the one that reads back as the same local time.
  for (const offset of [7, 6]) {
    const guess = new Date(Date.UTC(y, m - 1, d, hh + offset, mm));
    const back = guess.toLocaleString('en-CA', { timeZone: BUSINESS.timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const want = `${date}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (back.replace(/^24/, '00') === want) return guess.toISOString();
  }
  return null;
}

/** The reverse: ISO timestamp to Alberta local date and time strings for the admin form. */
export function isoToAlbertaLocal(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS.timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}` };
}
