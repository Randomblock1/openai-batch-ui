# OpenAI API Batch Interface (WIP)

This SvelteKit project provides a web-based interface for managing batch requests to the OpenAI API. It leverages IndexedDB for local storage, ensuring persistence of your conversation history and batch jobs. Everything happens client-side, so your data never leaves your browser.

[Click here to access the curent GitHub pages build.](https://randomblock1.com/openai-batch-ui/)

## Features

- **Conversation Builder:** Create and edit conversation threads with multiple messages, including user, system, and assistant roles.
- **Request Queue:** Save conversation threads to a queue for later submission as a batch.
- **Batch Submission:** Upload queued requests to OpenAI as a batch job, allowing for parallel processing of multiple conversations with a 50% discount.
- **Pending Batch Management:** Track the status of pending batches, cancel jobs if needed.
- **Completed Batch Results:** Access and download results of completed batch jobs.
- **Model Selection:** Choose from a variety of available OpenAI chat models for your requests.
- **Local Storage:** IndexedDB provides persistence for your conversation history, queued requests, and batch statuses.

## How to use

1. **Obtain an OpenAI API Key:** Sign up for an OpenAI account at [https://platform.openai.com/](https://platform.openai.com/) and obtain an API key.
2. **Run the application:** Install dependencies with `npm install` and run the development server with `npm run dev`.
3. **Enter your API Key:** Input your OpenAI API key in the "API Configuration" section. It is stored locally.
4. **Build your conversation:** Construct your desired conversation thread with the "Conversation Thread" section.
5. **Save requests to queue:** Use the "Message Request Queue" section to add your conversation to a batch for later submission.
6. **Submit batches:** When ready, click "Submit Batch" to send the queued requests to OpenAI for processing.
7. **Monitor batch status:** Check the "Pending Batches" section for status updates.
8. **Retrieve batch results:** Download results of completed batches using the "Completed Batches" section.

## Note

- Please review OpenAI's API documentation for usage limits and pricing details.

## Contribute

Feel free to open issues or submit pull requests to improve this project. Your contributions are highly appreciated!
