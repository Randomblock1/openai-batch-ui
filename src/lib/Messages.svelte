<script lang="ts">
	import { db, type Request, type Message } from './db';
	import { writable } from 'svelte/store';
	import { pendingRequests, selectedModel } from './stores';
	import ModelDropdown from './ModelDropdown.svelte';

	const message = writable('');
	const role = writable('user');
	const maxTokens = writable(1000);

	export const messages = writable<Message[]>([
		{
			role: 'system',
			content: 'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture. Knowledge cutoff: 2023-10.'
		}
	]);

	// Add a new message to the conversation
	function addMessage(role: string, content: string) {
		messages.update((msgs) => [...msgs, { role, content }]);
		message.set('');
	}

	// Delete a message from the conversation thread
	function deleteMessage(index: number) {
		messages.update((msgs) => msgs.filter((_, i) => i !== index));
	}

	// Serialize the current request and reset the conversation
	function saveMessagesToRequest() {
		const request: Request = {
			id: `request-${Date.now()}`,
			method: 'POST',
			url: '/v1/chat/completions',
			body: {
				model: $selectedModel,
				messages: $messages,
				max_tokens: $maxTokens
			}
		};

		db.pendingMessages
			.add(request)
			.then(() => {
				console.log('Request added to IndexedDB');
				// Update requests store after adding to IndexedDB
				pendingRequests.update((reqs) => [...reqs, request]);
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
</script>

<section>
	<h2 class="text-2xl font-semibold text-primary">
		Conversation Thread
		<span class="text-sm text-gray-500"> - Add messages here to create a request.</span>
	</h2>
	<div class="overflow-y-auto max-h-64 p-4">
		{#each $messages as message, index}
			<div class="chat {message.role === 'user' ? 'chat-end' : 'chat-start'}">
				<div class="chat-header">
					{message.role}
				</div>
				<div class="chat-bubble p-4 pr-10">
					{message.content}
					<button on:click={() => deleteMessage(index)} class="btn btn-sm btn-circle btn-error absolute top-0 right-0">
						<img src="delete.svg" alt="Delete" />
					</button>
				</div>
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
		<select id="role" bind:value={$role} class="select select-bordered w-32">
			<option value="user">user</option>
			<option value="system">system</option>
			<option value="assistant">assistant</option>
		</select>
	</div>

	<div class="form-control">
		<label for="content" class="label">
			<span class="label-text text-primary">Content:</span>
		</label>
		<textarea id="content" bind:value={$message} class="textarea textarea-bordered h-48 resize-none p-4" />
	</div>
	<button on:click={() => addMessage($role, $message)} class="btn bg-primary text-primary-content mt-4 px-6">Add Message</button>
</section>

<section>
	<h2 class="text-2xl font-semibold text-primary">Request Settings</h2>
	<ModelDropdown />
	<div class="form-control w-24">
		<label for="maxTokens" class="label">
			<span class="label-text text-primary">Max Tokens:</span>
		</label>
		<input type="number" id="maxTokens" bind:value={$maxTokens} class="input input-bordered" />
	</div>
	<button on:click={saveMessagesToRequest} class="btn bg-primary text-primary-content mt-4 px-6">Save Conversation to Queue</button>
</section>
