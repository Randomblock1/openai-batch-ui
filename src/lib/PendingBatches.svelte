<script lang="ts">
	import { db, type Request } from './db';
	import { batches, apiKey } from './stores';
	import { get } from 'svelte/store';

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

	// Fetch original batch requests or errors from OpenAI Files API
	async function fetchRawRequests(fileId: string): Promise<{ requests?: Request[]; errors?: any }> {
		try {
			const response = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
				headers: { Authorization: `Bearer ${get(apiKey)}` }
			});
			if (!response.ok) {
				throw new Error(`Failed to fetch file content: ${response.status} ${response.statusText}`);
			}
			const text = await response.text();
			const lines = text.split('\n').filter((l) => l.trim());
			const requests: Request[] = [];
			const errors: any[] = [];
			for (const line of lines) {
				const parsed = JSON.parse(line);
				if (parsed.errors) {
					errors.push(parsed.errors);
				} else {
					requests.push(parsed as Request);
				}
			}
			if (errors.length) return { errors };
			return { requests };
		} catch (err) {
			throw err;
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
										ID: {request.custom_id}, Model: {request.body.model}, Max Tokens: {request.body.max_tokens}
									</summary>
									<pre>{JSON.stringify(request.body.messages, null, 2)}</pre>
								</details>
							{/each}
						{:else}
							{#if batch.errors?.data?.length}
								<ul class="ml-4 text-error">
									{#each batch.errors.errors.data as err}
										<li>{err.message}</li>
									{/each}
								</ul>
							{:else}
								<p>Error: Batch requests not found.</p>
							{/if}
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
