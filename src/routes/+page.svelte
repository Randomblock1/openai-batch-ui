<script lang="ts">
	import { apiKey, defaultSystemPrompt } from '$lib/stores';
	import Messages from '$lib/Messages.svelte';
	import Requests from '$lib/Requests.svelte';
	import PendingBatches from '$lib/PendingBatches.svelte';
	import SubmittedBatches from '$lib/CompletedBatches.svelte';
</script>

<main class="container mx-auto p-4 space-y-8">
	<div class="indicator">
		<span class="indicator-item badge badge-warning">WIP</span> 
		<h1 class="text-4xl font-bold text-center text-primary">OpenAI API Batch Interface</h1>
	  </div>

	<section>
		<h2 class="text-2xl font-semibold text-primary">API Configuration</h2>
		<div class="form-control w-full max-w-xs">
			<label for="apiKey" class="label">
				<span class="label-text text-primary">API Key:</span>
			</label>
			<input type="password" id="apiKey" bind:value={$apiKey} class="input input-bordered w-full" />
		</div>
		<div class="form-control w-full">
			<label for="defaultSystemPrompt" class="label">
				<span class="label-text text-primary">Default System Prompt:</span>
			</label>
			<textarea
				id="defaultSystemPrompt"
				bind:value={$defaultSystemPrompt}
				class="textarea textarea-bordered w-full resize-y"
				rows="3"
			/>
		</div>
	</section>

	<Messages />
	<Requests />
	<PendingBatches />
	<SubmittedBatches />
</main>
