<script lang="ts">
	import { onMount } from 'svelte';
	import { db, type Batch, type ApiResponse, type Request } from './db';
	import { batches, apiKey, pendingRequests } from './stores';

	onMount(() => {
		if ($apiKey && $apiKey.length === 56) {
			listBatches();
		}
	});

	apiKey.subscribe((value) => {
		if (value && value.length === 56) {
			listBatches();
		}
	});

	// Get batch status
	async function getBatchStatus(batchId: string): Promise<Batch> {
		try {
			const response = await fetch(`https://api.openai.com/v1/batches/${batchId}`, {
				headers: {
					Authorization: `Bearer ${$apiKey}`
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
				localStorage.setItem(result.id, JSON.stringify(result));
			});
		} else {
			console.log(`Batch ${batchId} is not yet completed. Status: ${batch.status}`);
		}
	}

	// Function to get requests associated with a batch from IndexedDB
	async function getBatchRequests(batchId: string): Promise<Request[] | null> {
		try {
			const batch = await db.batches.get(batchId);
			if (batch && batch.requests) {
				return batch.requests; // Return requests from the batch
			} else {
				// Try fetching requests from db if not in batch object
				const fileContent = await downloadResultsFile(batch!.input_file_id);
				const reqs = fileContent.split('\n').map((line) => JSON.parse(line));
				return reqs;
			}
		} catch (error) {
			console.error('Error getting batch requests:', error);
			return null;
		}
	}

	// Download batch results file
	async function downloadResultsFile(fileId: string): Promise<string> {
		try {
			const response = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
				headers: {
					Authorization: `Bearer ${$apiKey}`
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

	// List batches
	async function listBatches() {
		if (!$apiKey || $apiKey.length !== 56) {
			alert('Please enter a valid API key to fetch available models.');
			return [];
		}

		try {
			const response = await fetch('https://api.openai.com/v1/batches?limit=10', {
				headers: {
					Authorization: `Bearer ${$apiKey}`
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

		const storedRequests = await db.pendingMessages.toArray();
		pendingRequests.set(storedRequests);

		const storedBatchRequests = await db.batchRequests.toArray();
		console.log('Loaded batch requests:', storedBatchRequests); // Debugging line
	}

	// Update batch status every 15 minutes
	setInterval(
		async () => {
			const bs = $batches;
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

<section>
	<h2 class="text-2xl font-semibold text-primary">
		Completed Batches
		<span class="text-sm text-gray-500"> - Download results to view.</span>
	</h2>
	<ul class="p-4">
		{#each $batches as batch}
			{#if batch.status === 'completed'}
				<!-- TODO Add a button to download results -->
				<!-- TODO display results inline -->
				<li class="mb-2">
					{batch.id} - {batch.status} - {new Date(batch.created_at * 1000).toLocaleString()}
					<button on:click={() => getBatchResults(batch.id)} class="btn btn-sm btn-outline btn-primary">Get Results</button>
				</li>
			{/if}
		{/each}
	</ul>
	<button on:click={listBatches} class="btn bg-primary text-primary-content mt-4 px-6">Refresh Batches</button>
</section>
