<script lang="ts">
	import { writable } from 'svelte/store';
	import { apiKey, selectedModel } from './stores';

	// Define Writable store for available models
	const models = writable<string[]>([]);

	apiKey.subscribe(async (value) => {
		if (value) {
			await updateModels();
		}
	});

	async function updateModels() {
		const availableModels = await getAvailableModels();
		models.set(availableModels);
		// Set the initially selected model (if any models are available)
		if (availableModels.length > 0) {
			if (availableModels.includes('gpt-4o')) {
				selectedModel.set('gpt-4o');
			} else {
				selectedModel.set(availableModels[0]);
			}
		}
	}

	async function getAvailableModels(): Promise<string[]> {
		const apiKeyValue = $apiKey;

		if (!apiKeyValue) {
			return [];
		}

		try {
			const response = await fetch('https://api.openai.com/v1/models', {
				headers: {
					Authorization: `Bearer ${apiKeyValue}`
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			const modelIds = data.data.map((model: { id: string }) => model.id);
			// exclude whisper and tts models
			const filteredModelIds = modelIds.filter(
				(modelId: string) =>
					!(
						modelId.includes('whisper') ||
						modelId.includes('tts') ||
						modelId.includes('dall-e') ||
						modelId.includes('text-embedding') ||
						modelId.includes('text-moderation')
					)
			);
			return filteredModelIds;
		} catch (error) {
			console.error('Error fetching available models:', error);
			return [];
		}
	}
</script>

<div class="form-control w-full max-w-xs">
	<label for="model" class="label">
		<span class="label-text text-primary">Model:</span>
	</label>
	<select id="model" bind:value={$selectedModel} class="select select-bordered">
		{#each $models as modelId}
			<option value={modelId}>{modelId}</option>
		{/each}
	</select>
</div>
