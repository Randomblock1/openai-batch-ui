import { writable } from 'svelte/store';
import type { Batch, Request } from './db';

export const apiKey = writable('');
apiKey.subscribe((value) => localStorage.setItem('openai_api_key', value));

export const batches = writable<Batch[]>([]);
export const pendingRequests = writable<Request[]>([]);