<script lang='ts'>
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
</script>

<button on:click={submitNewBatch} class="btn from-primary to-primary text-primary-content mt-4 px-6">Submit Batch</button>
  