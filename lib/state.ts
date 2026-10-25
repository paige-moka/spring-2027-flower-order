import 'server-only';
import { DEFAULT_DEADLINE_ISO } from './config';
import { formatDeadline, orderingState, type OrderingState } from './deadline';
import { getStore } from './store';

/** Ordering state for public pages. If the database cannot be reached, ordering shows as closed. */
export async function loadOrderingState(): Promise<{ state: OrderingState; deadlineText: string; configured: boolean }> {
  try {
    const state = orderingState(await getStore().getSettings());
    return { state, deadlineText: formatDeadline(state.deadline), configured: true };
  } catch (e) {
    console.error('Could not load settings', e);
    const state: OrderingState = { open: false, reason: 'closed_by_admin', deadline: DEFAULT_DEADLINE_ISO };
    return { state, deadlineText: formatDeadline(DEFAULT_DEADLINE_ISO), configured: false };
  }
}
