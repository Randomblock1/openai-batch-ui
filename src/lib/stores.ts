import { writable } from 'svelte/store';
import type { Batch, Request } from './db';

export const apiKey = writable('');

export const batches = writable<Batch[]>([]);
export const pendingRequests = writable<Request[]>([]);

// Define Writable store for selected model
export const selectedModel = writable<string>();
