<script lang="ts">
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/stores';
	import Messages from '$lib/Messages.svelte';
	import Requests from '$lib/Requests.svelte';
	import PendingBatches from '$lib/PendingBatches.svelte';
	import SubmittedBatches from '$lib/SubmittedBatches.svelte';

	// Load API Key from localStorage on mount
	onMount(() => {
		const storedApiKey = localStorage.getItem('openai_api_key');
		if (storedApiKey) {
			apiKey.set(storedApiKey);
		}
	});
</script>

<main class="container mx-auto p-4 space-y-8">
	<h1 class="text-4xl font-bold text-center text-primary">OpenAI API Batch Interface</h1>

	<section>
		<h2 class="text-2xl font-semibold text-primary">API Configuration</h2>
		<div class="form-control w-full max-w-xs">
			<label for="apiKey" class="label">
				<span class="label-text text-primary">API Key:</span>
			</label>
			<input type="password" id="apiKey" bind:value={$apiKey} class="input input-bordered w-full" />
		</div>
	</section>

	<Messages />
	<Requests />
	<PendingBatches />
	<SubmittedBatches />
</main>
