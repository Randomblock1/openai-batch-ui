<script lang="ts">
	import { db, type Request, type Message } from './db';
	import { writable } from 'svelte/store';
	import { pendingRequests } from './stores';

	const model = writable('gpt-4o');
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
	function saveRequest() {
		const request: Request = {
			id: `request-${Date.now()}`,
			method: 'POST',
			url: '/v1/chat/completions',
			body: {
				model: $model,
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

	// Function to delete request from IndexedDB and update the requests store
	async function deleteRequestFromQueue(requestId: string) {
		await db.batchRequests.delete(requestId);
		pendingRequests.update((rs) => rs.filter((r) => r.id !== requestId));
	}
</script>

<section>
	<h2 class="text-2xl font-semibold text-primary">
		Conversation Thread
		<span class="text-sm text-gray-500"> - Add messages here to create a request.</span>
	</h2>
	<div class="overflow-y-auto max-h-64 p-4">
		{#each $messages as message, index}
			<div class="chat chat-{message.role === 'user' ? 'end' : 'start'}">
				<div class="chat-header">
					{message.role}
				</div>
				<div class="chat-bubble p-4 pr-10">
					{message.content}
					<button on:click={() => deleteMessage(index)} class="btn btn-sm btn-circle btn-error absolute top-0 right-0">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="white"
							><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
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
	<button on:click={() => addMessage($role, $message)} class="btn btn-primary px-6">Add Message</button>
</section>

<div class="form-control w-24">
	<label for="maxTokens" class="label">
		<span class="label-text text-primary">Max Tokens:</span>
	</label>
	<input type="number" id="maxTokens" bind:value={$maxTokens} class="input input-bordered" />
</div>
<button on:click={saveRequest} class="btn bg-primary text-primary-content mt-4 px-6">Save Conversation to Queue</button>

<section>
	<h2 class="text-2xl font-semibold text-primary">
		Message Request Queue
		<span class="text-sm text-gray-500"> - These messages haven't been sent yet.</span>
	</h2>
	<div class="overflow-y-auto max-h-64 p-4">
		{#each $pendingRequests as request (request.id)}
			<details class="alert alert-warning shadow-lg mb-2 p-4 relative">
				<summary>
					ID: {request.id}, Model: {request.body.model}, Max Tokens: {request.body.max_tokens}
				</summary>
				<pre>{JSON.stringify(request.body.messages, null, 2)}</pre>
				<button on:click={() => deleteRequestFromQueue(request.id)} class="btn btn-sm btn-error absolute top-0 right-0">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"
						><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</details>
		{/each}
	</div>
</section>