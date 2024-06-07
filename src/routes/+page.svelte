<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store';
	import Dexie, { type Table } from 'dexie';

	// Define Dexie database schema
	class OpenAIBatchDatabase extends Dexie {
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
	const db = new OpenAIBatchDatabase();

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
		input_file_id: string;
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
			content: 'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture. Knowledge cutoff: 2023-10.'
		}
	]);
	const requests = writable<Payload[]>([]);
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
	function handleApiKeyChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value;
		apiKey.set(value);
		localStorage.setItem('openai_api_key', value);
	}

	// Add a new message to the conversation
	function addMessage(role: string, content: string) {
		messages.update((msgs) => [...msgs, { role, content }]);
		userMessage.set('');
	}

	// Delete a message from the conversation thread
	function deleteMessage(index: number) {
		messages.update((msgs) => msgs.filter((_, i) => i !== index));
	}

	// Serialize the current request and reset the conversation
	function serializeRequest() {
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
			.then(() => {
				console.log('Request added to IndexedDB');
				// Update requests store after adding to IndexedDB
				requests.update((reqs) => [...reqs, request]);
			})
			.catch((error) => console.error('Error adding request:', error));

		// Reset the messages store
		messages.set([
			{
				role: 'system',
				content: 'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture. Knowledge cutoff: 2023-10.'
			}
		]);
	}

	// Upload the batched requests to OpenAI
	async function submitBatch() {
		const requests = await db.requests.toArray();
		const fileContent = requests.map((request) => JSON.stringify(request)).join('\n');
		const fileId = await uploadFile(fileContent);
		const batch = await createBatchJob(fileId);
		await db.batches.add(batch);
		batches.update((bs) => [...bs, batch]);
	}

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

	// Function to get requests associated with a batch from IndexedDB
	async function getBatchRequests(batchId: string): Promise<Payload[] | null> {
		try {
			// Get the batch from IndexedDB
			const batch = await db.batches.get(batchId);

			// If the batch exists
			if (batch) {
				// Extract the custom_ids from the batch's input file content
				const customIds = batch.input_file_id.split('\n').map((line: string) => JSON.parse(line).custom_id);

				// Fetch the corresponding requests from IndexedDB
				return await db.requests.where('custom_id').anyOf(customIds).toArray();
			} else {
				// Batch not found in IndexedDB
				return null;
			}
		} catch (error) {
			console.error('Error getting batch requests:', error);
			return null;
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
				throw new Error(`Failed to download results file: ${response.status} ${response.statusText}`);
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
			// Force UI update by setting the store again
			batches.set(data.data);
		} catch (error) {
			console.error('Error listing batches:', error);
			throw error;
		}
	}

	// Load batches & requests from IndexedDB
	async function loadBatches() {
		const storedBatches = await db.batches.toArray();
		batches.set(storedBatches);

		const storedRequests = await db.requests.toArray();
		requests.set(storedRequests);
	}

	// Function to delete request from IndexedDB and update the requests store
	async function deleteRequestFromQueue(custom_id: string) {
		await db.requests.delete(custom_id);
		requests.update((rs) => rs.filter((r) => r.custom_id !== custom_id));
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

<main class="container mx-auto p-4 space-y-8">
	<h1 class="text-4xl font-bold text-center text-primary">OpenAI API Batch Interface</h1>

	<section>
		<h2 class="text-2xl font-semibold text-primary">API Configuration</h2>
		<div class="form-control w-full max-w-xs">
			<label for="apiKey" class="label">
				<span class="label-text text-primary">API Key:</span>
			</label>
			<input type="text" id="apiKey" bind:value={$apiKey} on:input={handleApiKeyChange} class="input input-bordered w-full" />
		</div>
	</section>

	<section>
		<h2 class="text-2xl font-semibold text-primary">Conversation Thread</h2>
		<div class="overflow-y-auto max-h-64 chat chat-start">
			{#each $messages as message, index}
				<div
					class="chat-bubble chat-bubble-{message.role === 'user' ? 'end' : 'start'} bg-{message.role} text-{message.role === 'user'
						? 'base-content'
						: 'primary-content'}">
					<span class="role font-bold">{message.role}:</span>
					<span class="content">{message.content}</span>
					<button on:click={() => deleteMessage(index)} class="btn btn-sm btn-circle btn-error absolute top-0 right-0">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"
							><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="text-2xl font-semibold text-primary">Add Message</h2>
		<div class="form-control max-w-xs">
			<label for="role" class="label">
				<span class="label-text text-primary">Role:</span>
			</label>
			<select id="role" bind:value={role} class="select select-bordered select-sm">
				<option value="user">user</option>
				<option value="system">system</option>
				<option value="assistant">assistant</option>
			</select>
		</div>

		<div class="form-control">
			<label for="content" class="label">
				<span class="label-text text-primary">Content:</span>
			</label>
			<textarea id="content" bind:value={$userMessage} class="textarea textarea-bordered h-48 resize-none" />
		</div>
		<button on:click={() => addMessage(role, $userMessage)} class="btn btn-primary">Add Message</button>
	</section>

	<button on:click={serializeRequest} class="btn bg-primary text-primary-content mt-4">Save to Unsubmitted Batch</button>

	<section>
		<h2 class="text-2xl font-semibold text-primary">
			Message Request Queue
			<span class="text-sm text-gray-500"> - These messages haven't been sent yet.</span>
		</h2>
		<div class="overflow-y-auto max-h-64">
			{#each $requests as request (request.custom_id)}
				<details class="alert alert-warning shadow-lg mb-2 relative">
					<summary>{request.custom_id}</summary>
					<pre>{JSON.stringify(request, null, 2)}</pre>
					<button on:click={() => deleteRequestFromQueue(request.custom_id)} class="btn btn-sm btn-error absolute top-0 right-0">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"
							><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				</details>
			{/each}
		</div>
	</section>

	<button on:click={submitBatch} class="btn from-primary to-primary text-primary-content mt-4">Submit Batch</button>

	<section>
		<h2 class="text-2xl font-semibold text-primary">Pending Batches</h2>
		<ul>
			{#each $batches as batch}
				{#if batch.status !== 'completed'}
					<details class="alert alert-warning shadow-lg mb-2 relative">
						<summary>{batch.id} - {batch.status} - {new Date(batch.created_at * 1000).toLocaleString()}</summary>
						<ul>
							{#await getBatchRequests(batch.id) then batchRequests}
								{#if batchRequests}
									{#each batchRequests as request}
										<details class="alert alert-warning shadow-lg mb-2 ml-4">
											<summary>{request.custom_id}</summary>
											<pre>{JSON.stringify(request, null, 2)}</pre>
										</details>
									{/each}
								{:else}
									<p>Error: Batch requests not found.</p>
								{/if}
							{/await}
						</ul>
						<button on:click={() => cancelBatchJob(batch.id)} class="btn btn-sm btn-error absolute top-0 right-0">Cancel</button>
					</details>
				{/if}
			{/each}
		</ul>
	</section>

	<section>
		<h2 class="text-2xl font-semibold text-primary">Completed Batches</h2>
		<ul>
			{#each $batches as batch}
				{#if batch.status === 'completed'}
					<li class="mb-2">
						{batch.id} - {batch.status} - {new Date(batch.created_at * 1000).toLocaleString()}
						<button on:click={() => getBatchResults(batch.id)} class="btn btn-sm btn-outline btn-primary">Get Results</button>
					</li>
				{/if}
			{/each}
		</ul>
	</section>

	<button on:click={listBatches} class="btn bg-primary text-primary-content mt-4">Refresh Batches</button>
</main>
