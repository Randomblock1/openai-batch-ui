<script lang="ts">
    import { onMount } from 'svelte';
    import { writable, get } from 'svelte/store';

    type Message = {
        role: string;
        content: string;
    };

    type Payload = {
        model: string;
        messages: Message[];
    };

    type ApiResponse = {
        choices: { message: { content: string } }[];
    };

    const model = writable('gpt-4o');
    const apiKey = writable('');
    const userMessage = writable('');
    const response = writable('');

    onMount(() => {
        const storedApiKey = localStorage.getItem('openai_api_key');
        if (storedApiKey) {
            apiKey.set(storedApiKey);
        }
    });

    const handleApiKeyChange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const value = target.value;
        apiKey.set(value);
        localStorage.setItem('openai_api_key', value);
    };

    const handleSubmit = async () => {
        const modelValue = get(model);
        const apiKeyValue = get(apiKey);
        const userMessageValue = get(userMessage);

        const payload: Payload = {
            model: modelValue,
            messages: [
                {
                    role: "system",
                    content: "You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture. Knowledge cutoff: 2023-10."
                },
                {
                    role: "user",
                    content: userMessageValue
                }
            ]
        };

        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeyValue}`
                },
                body: JSON.stringify(payload)
            });

            const data: ApiResponse = await res.json();
            response.set(data.choices[0].message.content);
        } catch (error) {
            console.error('Error:', error);
            response.set('Error occurred while fetching data.');
        }
    };
</script>

<main>
    <h1>OpenAI API Chat Interface</h1>
    <form on:submit|preventDefault={handleSubmit}>
        <div>
            <label for="model">Model:</label>
            <input type="text" id="model" bind:value={$model} />
        </div>
        <div>
            <label for="apiKey">API Key:</label>
            <input type="text" id="apiKey" bind:value={$apiKey} on:input={handleApiKeyChange} />
        </div>
        <div>
            <label for="message">Message:</label>
            <textarea id="message" bind:value={$userMessage}></textarea>
        </div>
        <button type="submit">Send</button>
    </form>

    <h2>Response</h2>
    <pre>{$response}</pre>
</main>
