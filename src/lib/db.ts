import Dexie, { type Table } from 'dexie';

// Define types for messages, payload, API responses and batches
export type Message = {
	role: string;
	content: string;
};

export type Request = {
	id: string;
	method: string;
	url: string;
	body: {
		model: string;
		messages: Message[];
		max_tokens: number;
	};
};

export type ApiResponse = {
	id: string;
	response: {
		status_code: number;
		body: {
			id: string;
			object: string;
			created: number;
			model: string;
			choices: {
				index: number;
				message: {
					role: string;
					content: string;
				};
				logprobs: null;
				finish_reason: string;
			}[];
			usage: {
				prompt_tokens: number;
				completion_tokens: number;
				total_tokens: number;
			};
			system_fingerprint: string;
		};
		request_id: string;
	};
	error: string;
};

export type Batch = {
	id: string;
	status: string;
	created_at: number;
	input_file_id: string;
	output_file_id: string | null;
	requests: Request[]; // Store requests associated with batch
};

class OpenAIBatchDatabase extends Dexie {
	pendingMessages!: Table<Request, string>;
	batches!: Table<Batch, string>;
	batchRequests!: Table<Request, string>;

	constructor() {
		super('openai-batches');
		this.version(1).stores({
			pendingMessages: 'id',
			batches: 'id',
			batchRequests: 'id'
		});
	}
}

// Create database instance
export const db = new OpenAIBatchDatabase();
