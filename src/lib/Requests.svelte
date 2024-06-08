<script lang="ts">
	import { db, type Batch } from '$lib/db';
	import { batches, apiKey, pendingRequests } from './stores';

	// Upload file to OpenAI
	async function uploadFile(fileContent: string): Promise<string> {
		const formData = new FormData();
		formData.append('purpose', 'batch');
		formData.append('file', new Blob([fileContent], { type: 'text/plain' }), 'batch.jsonl');

		try {
			const response = await fetch('https://api.openai.com/v1/files', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${$apiKey}`
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
					Authorization: `Bearer ${$apiKey}`
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

	// Upload the batched requests to OpenAI
	async function submitNewBatch() {
		const reqs = $pendingRequests;
		const fileContent = reqs.map((request) => JSON.stringify(request)).join('\n');
		const fileId = await uploadFile(fileContent);
		const batch = await createBatchJob(fileId);

		// Add requests to the batchRequests object store
		await db.batchRequests.bulkAdd(reqs);

		// Associate requests with the batch and save to IndexedDB
		batch.requests = reqs;
		await db.batches.add(batch);

		batches.update((bs) => [...bs, batch]);

		// Clear pending messages after submission
		pendingRequests.set([]);
	}

	// Delete request from queue
	async function deleteRequestFromQueue(requestId: string) {
		console.log('Deleting request:', requestId);
		await db.batchRequests.delete(requestId);
		pendingRequests.update((rs) => rs.filter((r) => r.id !== requestId));
	}
</script>

<section>
	<!-- TODO allow uploading of custom JSONL conversation -->
	<h2 class="text-2xl font-semibold text-primary">
		Message Request Queue
		<span class="text-sm text-gray-500"> - These messages haven't been sent yet.</span>
	</h2>
	<div class="overflow-y-auto max-h-64 p-4">
		{#each $pendingRequests as request}
			<details class="alert alert-warning shadow-lg mb-2 p-4 relative">
				<summary>
					ID: {request.id}, Model: {request.body.model}, Max Tokens: {request.body.max_tokens}
				</summary>
				<pre>{JSON.stringify(request.body.messages, null, 2)}</pre>
				<button on:click={() => deleteRequestFromQueue(request.id)} class="btn btn-sm btn-error absolute top-0 right-0">
					<img src="/delete.svg" alt="Delete" />
				</button>
			</details>
		{/each}
	</div>
	<button on:click={submitNewBatch} class="btn btn-primary px-6">Submit Batch</button>
</section>
