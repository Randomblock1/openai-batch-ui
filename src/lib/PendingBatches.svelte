<script lang="ts">
	import { db, type BatchError } from './db'; // Assuming BatchError might be defined in db.ts or we define it here
	import { batches, apiKey } from './stores';
	import { get } from 'svelte/store';

	let errorFileContents: { [key: string]: any[] } = {}; // To store parsed error file content

	// Generic function to download file content
	async function downloadFileContent(fileId: string): Promise<string> {
		const currentApiKey = get(apiKey);
		if (!currentApiKey || currentApiKey.length !== 56) {
			throw new Error('API key is not valid or not set.');
		}
		try {
			const response = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
				headers: {
					Authorization: `Bearer ${currentApiKey}`
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
			}
			return await response.text();
		} catch (error) {
			console.error('Error downloading file content:', error);
			throw error;
		}
	}

	async function fetchAndDisplayErrorFile(batchId: string, fileId: string) {
		try {
			const content = await downloadFileContent(fileId);
			const parsedErrors = content
				.split('\n')
				.filter((line) => line.trim() !== '')
				.map((line) => JSON.parse(line));
			errorFileContents = { ...errorFileContents, [batchId]: parsedErrors };
		} catch (error) {
			console.error(`Error fetching or parsing error file for batch ${batchId}:`, error);
			errorFileContents = { ...errorFileContents, [batchId]: [{ error: 'Failed to load error log.' }] };
		}
	}

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
					<div>
						{#if batch.errors && batch.errors.data && Array.isArray(batch.errors.data) && batch.errors.data.length > 0}
							<div class="text-red-500 p-2">
								<p class="font-semibold">Batch Errors:</p>
								<ul class="list-disc list-inside">
									{#each batch.errors.data as error: (BatchError)}
										<li class="ml-2">
											<strong>Code:</strong> {error.code}<br />
											<strong class="ml-2">Message:</strong> {error.message}
											{#if error.param}<span class="ml-2">(Parameter: {error.param})</span>{/if}
											{#if error.line}<span class="ml-2">(Line: {error.line})</span>{/if}
										</li>
									{/each}
								</ul>
							</div>
						{:else if batch.error_file_id}
							<div class="p-2">
								{#if errorFileContents[batch.id]}
									<p class="font-semibold text-red-500">Errors from File ({batch.error_file_id}):</p>
									<ul class="list-disc list-inside text-red-500">
										{#each errorFileContents[batch.id] as errorLine}
											<li class="ml-2">
												{#if errorLine.error && errorLine.error.message}
													<strong>Code:</strong> {errorLine.error.code || 'N/A'}<br />
													<strong class="ml-2">Message:</strong> {errorLine.error.message}
													{#if errorLine.error.param}<span class="ml-2">(Parameter: {errorLine.error.param})</span>{/if}
													{#if errorLine.line}<span class="ml-2">(Line: {errorLine.line})</span>{/if}
												{:else if errorLine.error === 'Failed to load error log.'}
													<p>{errorLine.error}</p>
												{:else}
													<pre class="whitespace-pre-wrap">{JSON.stringify(errorLine, null, 2)}</pre>
												{/if}
											</li>
										{/each}
									</ul>
								{:else}
									<button class="btn btn-sm btn-outline btn-error" on:click={() => fetchAndDisplayErrorFile(batch.id, batch.error_file_id!)}>
										View Error Log ({batch.error_file_id})
									</button>
								{/if}
							</div>
						{:else if batch.requests}
							<ul>
								{#each batch.requests as request}
									<details class="alert alert-info shadow-lg mb-2 ml-4 p-4">
										<summary>
											Request ID: {request.custom_id || request.id}, Model: {request.body.model}, Max Tokens: {request.body.max_tokens}
										</summary>
										<pre>{JSON.stringify(request.body.messages, null, 2)}</pre>
									</details>
								{/each}
							</ul>
						{:else}
							<p class="p-2 text-orange-500">
								Batch request details are not directly available. The batch might still be processing, completed successfully without direct request listing here (check completed tab), or encountered an issue without specific error codes.
							</p>
						{/if}
					</div>
					{#if batch.status === 'validating' || batch.status === 'in_progress' || batch.status === 'queued'}
						<button on:click={() => cancelBatchJob(batch.id)} class="btn btn-sm btn-circle btn-error absolute top-0 right-0">
							<img src="delete.svg" alt="Delete" />
						</button>
					{/if}
				</details>
			{/if}
		{/each}
	</ul>
</section>
