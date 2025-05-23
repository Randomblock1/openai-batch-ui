import { get, writable } from 'svelte/store';
import type { Batch, Request } from './db';
import { db } from './db';

export const apiKey = writable<string>();
const storedApiKey = localStorage.getItem('openai_api_key');
if (storedApiKey) {
	apiKey.set(storedApiKey);
}

apiKey.subscribe((value) => {
	if (value) {
		localStorage.setItem('openai_api_key', get(apiKey));
	}
});

export const batches = writable<Batch[]>([]);
batches.set(await db.batches.toArray());

export const pendingRequests = writable<Request[]>([]);
pendingRequests.set(await db.pendingMessages.toArray());

const storedSelectedModel = localStorage.getItem('selected_model');
export const selectedModel = writable<string | undefined>(
	storedSelectedModel ? storedSelectedModel : undefined
);

selectedModel.subscribe((value) => {
	if (value) {
		localStorage.setItem('selected_model', value);
	}
});

export const defaultSystemPrompt = writable<string>('You are a helpful assistant.');
const storedDefaultSystemPrompt = localStorage.getItem('default_system_prompt');
if (storedDefaultSystemPrompt) {
	defaultSystemPrompt.set(storedDefaultSystemPrompt);
}

defaultSystemPrompt.subscribe((value) => {
	if (value) {
		localStorage.setItem('default_system_prompt', get(defaultSystemPrompt));
	}
});
