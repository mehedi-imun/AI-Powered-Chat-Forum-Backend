export interface IEmailStatusWebhook {
	event: "delivered" | "failed" | "bounced" | "spam" | "opened" | "clicked";
	messageId: string;
	recipient: string;
	timestamp: Date;
	reason?: string;
	metadata?: Record<string, unknown>;
}

export interface IWebhookLog {
	event: string;
	payload: Record<string, unknown>;
	source: string;
	status: "success" | "failed";
	error?: string;
	timestamp: Date;
}

export interface IWebhookResponse {
	received: boolean;
	messageId: string;
	processedAt: Date;
}
