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

export const defaultPrompt = writable<string>();
const storedPrompt = localStorage.getItem('default_prompt');
if (storedPrompt) {
    defaultPrompt.set(storedPrompt);
} else {
    defaultPrompt.set('You are a helpful assistant.');
}
defaultPrompt.subscribe((value) => {
    if (value) {
        localStorage.setItem('default_prompt', value);
    }
});

export const selectedModel = writable<string>();
const storedModel = localStorage.getItem('selected_model');
if (storedModel) {
    selectedModel.set(storedModel);
} else {
    selectedModel.set('gpt-4.1');
}
selectedModel.subscribe((value) => {
    if (value) {
        localStorage.setItem('selected_model', value);
    }
});
