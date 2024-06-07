<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store';
	import Dexie, { type Table } from 'dexie';

	// Define Dexie database schema
	class OpenAIDatabase extends Dexie {
		requests!: Table<Payload, string>; // 'custom_id' is primary key
		batches!: Table<Batch, string>; // 'id' is primary key

		constructor() {
			super('openai-batches');
			this.version(1).stores({
				requests: 'custom_id',
				batches: 'id'
			});
		}
	}

	// Create database instance
	const db = new OpenAIDatabase();

	// Define types for messages, payload, API responses and batches
	type Message = {
		role: string;
		content: string;
	};

	type Payload = {
		custom_id: string;
		method: string;
		url: string;
		body: {
			model: string;
			messages: Message[];
			max_tokens: number;
		};
	};

	type ApiResponse = {
		id: string;
		custom_id: string;
		response: {
			status_code: number;
			body: {
				id: string;
				object: string;
				created: number;
				model: string;
				choices: {
					index: number;
					message: {
						role: string;
						content: string;
					};
					logprobs: null;
					finish_reason: string;
				}[];
				usage: {
					prompt_tokens: number;
					completion_tokens: number;
					total_tokens: number;
				};
				system_fingerprint: string;
			};
			request_id: string;
		};
		error: any;
	};

	type Batch = {
		id: string;
		status: string;
		created_at: number;
		output_file_id: string | null;
	};

	// Define Writable stores for UI elements and data
	const model = writable('gpt-4o');
	const apiKey = writable('');
	const userMessage = writable('');
	let role: string = 'user'; // Default to 'user'
	const messages = writable<Message[]>([
		{
			role: 'system',
			content:
				'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture. Knowledge cutoff: 2023-10.'
		}
	]);
	const batches = writable<Batch[]>([]);

	// Load API Key from localStorage on mount
	onMount(() => {
		const storedApiKey = localStorage.getItem('openai_api_key');
		if (storedApiKey) {
			apiKey.set(storedApiKey);
		}
		loadBatches();
	});

	// Persist API key to localStorage
	const handleApiKeyChange = (event: Event) => {
		const target = event.target as HTMLInputElement;
		const value = target.value;
		apiKey.set(value);
		localStorage.setItem('openai_api_key', value);
	};

	// Add a new message to the conversation
	const addMessage = (role: string, content: string) => {
		messages.update((msgs) => [...msgs, { role, content }]);
		userMessage.set('');
	};

	// Delete a message from the conversation thread
	const deleteMessage = (index: number) => {
		messages.update((msgs) => msgs.filter((_, i) => i !== index));
	};

	// Serialize the current request and reset the conversation
	const serializeRequest = () => {
		const timestamp = Date.now();
		const modelValue = get(model);
		const msgs = get(messages);
		const request: Payload = {
			custom_id: `request-${timestamp}`,
			method: 'POST',
			url: '/v1/chat/completions',
			body: {
				model: modelValue,
				messages: msgs,
				max_tokens: 1000
			}
		};

		db.requests
			.add(request)
			.then(() => console.log('Request added to IndexedDB'))
			.catch((error) => console.error('Error adding request:', error));

		// Reset the messages store
		messages.set([
			{
				role: 'system',
				content:
					'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture. Knowledge cutoff: 2023-10.'
			}
		]);
	};

	// Upload the batched requests to OpenAI
	const submitBatch = async () => {
		const requests = await db.requests.toArray();
		const fileContent = requests.map((request) => JSON.stringify(request)).join('\n');
		const fileId = await uploadFile(fileContent);
		const batch = await createBatchJob(fileId);
		await db.batches.add(batch);
		batches.update((bs) => [...bs, batch]);
	};

	// Upload file to OpenAI
	async function uploadFile(fileContent: string): Promise<string> {
		const apiKeyValue = get(apiKey);
		const formData = new FormData();
		formData.append('purpose', 'batch');
		formData.append('file', new Blob([fileContent], { type: 'text/plain' }), 'batch.jsonl');

		try {
			const response = await fetch('https://api.openai.com/v1/files', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKeyValue}`
				},
				body: formData
			});

			const data = await response.json();
			console.log('File uploaded:', data);
			return data.id;
		} catch (error) {
			console.error('Error uploading file:', error);
			throw error;
		}
	}

	// Create batch job
	async function createBatchJob(fileId: string): Promise<Batch> {
		const apiKeyValue = get(apiKey);
		const payload = {
			input_file_id: fileId,
			endpoint: '/v1/chat/completions',
			completion_window: '24h'
		};

		try {
			const response = await fetch('https://api.openai.com/v1/batches', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKeyValue}`
				},
				body: JSON.stringify(payload)
			});

			const data: Batch = await response.json();
			console.log('Batch job created:', data);
			return data;
		} catch (error) {
			console.error('Error creating batch job:', error);
			throw error;
		}
	}

	// Get batch status
	async function getBatchStatus(batchId: string): Promise<Batch> {
		const apiKeyValue = get(apiKey);

		try {
			const response = await fetch(`https://api.openai.com/v1/batches/${batchId}`, {
				headers: {
					Authorization: `Bearer ${apiKeyValue}`
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch batch status: ${response.status} ${response.statusText}`);
			}

			const data: Batch = await response.json();
			return data;
		} catch (error) {
			console.error('Error fetching batch status:', error);
			throw error;
		}
	}

	// Get batch results
	async function getBatchResults(batchId: string) {
		const batch = await getBatchStatus(batchId);

		if (batch.status === 'completed') {
			const resultsFileContent = await downloadResultsFile(batch.output_file_id!);
			const results = resultsFileContent.split('\n').map((line) => JSON.parse(line) as ApiResponse);
			console.log('Batch results downloaded:', results);

			// Update local storage with results
			results.forEach((result) => {
				localStorage.setItem(result.custom_id, JSON.stringify(result));
			});
		} else {
			console.log(`Batch ${batchId} is not yet completed. Status: ${batch.status}`);
		}
	}

	// Download batch results file
	async function downloadResultsFile(fileId: string): Promise<string> {
		const apiKeyValue = get(apiKey);

		try {
			const response = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
				headers: {
					Authorization: `Bearer ${apiKeyValue}`
				}
			});

			if (!response.ok) {
				throw new Error(
					`Failed to download results file: ${response.status} ${response.statusText}`
				);
			}

			const resultsFileContent = await response.text();
			return resultsFileContent;
		} catch (error) {
			console.error('Error downloading results file:', error);
			throw error;
		}
	}

	// Cancel batch job
	async function cancelBatchJob(batchId: string) {
		const apiKeyValue = get(apiKey);

		try {
			const response = await fetch(`https://api.openai.com/v1/batches/${batchId}/cancel`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKeyValue}`
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to cancel batch job: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			console.log('Batch job cancelled:', data);

			// Update batch status in IndexedDB
			await db.batches.update(batchId, { status: data.status });
			batches.update((bs) => bs.map((b) => (b.id === batchId ? data : b)));
		} catch (error) {
			console.error('Error cancelling batch job:', error);
			throw error;
		}
	}

	// List batches
	async function listBatches() {
		const apiKeyValue = get(apiKey);

		try {
			const response = await fetch('https://api.openai.com/v1/batches?limit=10', {
				headers: {
					Authorization: `Bearer ${apiKeyValue}`
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to list batches: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			batches.set(data.data);
		} catch (error) {
			console.error('Error listing batches:', error);
			throw error;
		}
	}

	// Load batches from IndexedDB
	async function loadBatches() {
		const storedBatches = await db.batches.toArray();
		batches.set(storedBatches);
	}

	// Update batch status every 15 minutes
	setInterval(
		async () => {
			const bs = get(batches);
			const updatedBatches = await Promise.all(
				bs.map(async (batch) => {
					const updatedBatch = await getBatchStatus(batch.id);
					if (updatedBatch.status === 'completed') {
						await getBatchResults(updatedBatch.id);
					}
					return updatedBatch;
				})
			);

			// Update batches in IndexedDB
			await Promise.all(updatedBatches.map((b) => db.batches.put(b)));
			batches.set(updatedBatches);
		},
		15 * 60 * 1000
	);
</script>

<main>
	<h1>OpenAI API Batch Interface</h1>

	<div>
		<label for="apiKey">API Key:</label>
		<input type="text" id="apiKey" bind:value={$apiKey} on:input={handleApiKeyChange} />
	</div>

	<h2>Conversation Thread</h2>
	<div>
		{#each $messages as message, index}
			<div>
				<span class="role">{message.role}:</span>
				<span class="content">{message.content}</span>
				<button on:click={() => deleteMessage(index)}>Delete</button>
			</div>
		{/each}
	</div>

	<h2>Add Message</h2>
	<div>
		<label for="role">Role:</label>
		<select id="role" bind:value={role}>
			<option value="user">user</option>
			<option value="system">system</option>
		</select>
		<label for="content">Content:</label>
		<textarea id="content" bind:value={$userMessage} />
		<button on:click={() => addMessage(role, $userMessage)}>Add Message</button>
	</div>

	<button on:click={serializeRequest}>Serialize and Reset</button>
	<button on:click={submitBatch}>Submit Batch</button>

	<h2>Batches</h2>
	<ul>
		{#each $batches as batch}
			<li>
				{batch.id} - {batch.status} - {new Date(batch.created_at * 1000).toLocaleString()}
				{#if batch.status === 'completed'}
					<button on:click={() => getBatchResults(batch.id)}>Get Results</button>
				{/if}
				<button on:click={() => cancelBatchJob(batch.id)}>Cancel</button>
			</li>
		{/each}
	</ul>

	<button on:click={listBatches}>List Batches</button>

	<h2>Response</h2>
	<pre>
      {#each Object.entries(localStorage) as [key, value]}
			{#if key.startsWith('request-')}
				{key}: {value}
			{/if}
		{/each}
    </pre>
</main>

<style>
	.role {
		font-weight: bold;
	}

	.content {
		margin-left: 10px;
	}
</style>
