export interface IEmailStatusWebhook {
	event: "delivered" | "failed" | "bounced" | "spam" | "opened" | "clicked";
	messageId: string;
	recipient: string;
	timestamp: Date;
	reason?: string;
	metadata?: Record<string, unknown>;
}

export interface INotificationWebhook {
	event:
		| "notification.sent"
		| "notification.delivered"
		| "notification.failed"
		| "notification.clicked";
	notificationId: string;
	userId: string;
	type: string;
	timestamp: Date;
	metadata?: Record<string, unknown>;
}

export interface IExternalWebhook {
	url: string;
	method: "POST" | "GET" | "PUT";
	headers?: Record<string, string>;
	events: string[];
	secret?: string;
	isActive: boolean;
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
