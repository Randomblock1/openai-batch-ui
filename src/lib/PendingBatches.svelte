<script lang="ts">
	import { db } from './db';
	import { batches, apiKey } from './stores';

	// Cancel batch job
	async function cancelBatchJob(batchId: string) {
		try {
			const response = await fetch(`https://api.openai.com/v1/batches/${batchId}/cancel`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${$apiKey}`
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
</script>

<section>
	<h2 class="text-2xl font-semibold text-primary">
		Pending Batches
		<span class="text-sm text-gray-500"> - Check back in 24 hours or less for results.</span>
	</h2>
	<ul class="p-4">
		{#each $batches as batch}
			{#if batch.status !== 'completed'}
				<details class="alert alert-warning shadow-lg mb-2 p-4 relative">
					<summary>{batch.id} - {batch.status} - {new Date(batch.created_at * 1000).toLocaleString()}</summary>
					<ul>
						{#if batch.requests}
							{#each batch.requests as request}
								<details class="alert alert-warning shadow-lg mb-2 ml-4 p-4">
									<summary>
										ID: {request.id}, Model: {request.body.model}, Max Tokens: {request.body.max_tokens}
									</summary>
									<pre>{JSON.stringify(request.body.messages, null, 2)}</pre>
								</details>
							{/each}
						{:else}
							<p>Error: Batch requests not found.</p>
							<!-- TODO Use Files API to try and get messages -->
						{/if}
					</ul>
					{#if batch.status === 'validating' || batch.status === 'in_progress'}
						<button on:click={() => cancelBatchJob(batch.id)} class="btn btn-sm btn-circle btn-error absolute top-0 right-0">
							<img src="delete.svg" alt="Delete" />
						</button>
					{/if}
				</details>
			{/if}
		{/each}
	</ul>
</section>
