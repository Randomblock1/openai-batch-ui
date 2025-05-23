import Dexie, { type Table } from 'dexie';

// Define types for messages, payload, API responses and batches
export type Message = {
	role: string;
	content: string;
};

export type Request = {
	/** Developer-provided per-request id */
	custom_id: string;
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
	errors: any;
};

class OpenAIBatchDatabase extends Dexie {
	pendingMessages!: Table<Request, string>;
	batches!: Table<Batch, string>;
	batchRequests!: Table<Request, string>;

	constructor() {
		super('openai-batches');
		// Version 1: use 'id' as primary key for backward compatibility
		this.version(1).stores({
			pendingMessages: 'id',
			batches: 'id',
			batchRequests: 'id'
		});

		// Version 2: switch to 'custom_id' primary key and migrate existing records
		this.version(2)
			.stores({
				pendingMessages: 'custom_id',
				batches: 'id',
				batchRequests: 'custom_id'
			})
			.upgrade(tx =>
				Promise.all([
					tx.table('pendingMessages').toCollection().modify(item => {
						// backfill custom_id from id
						(item as any).custom_id = (item as any).id;
					}),
					tx.table('batchRequests').toCollection().modify(item => {
						(item as any).custom_id = (item as any).id;
					})
				])
			);
	}
}

// Create database instance
export const db = new OpenAIBatchDatabase();
