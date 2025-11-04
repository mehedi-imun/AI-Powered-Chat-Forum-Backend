import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { webhookService } from "./webhook.service";
import type { IEmailStatusWebhook } from "./webhook.interface";
import AppError from "../../errors/AppError";

const handleEmailStatus = catchAsync(async (req: Request, res: Response) => {
	const signature = req.headers["x-webhook-signature"] as string;
	const timestamp = req.headers["x-webhook-timestamp"] as string;

	if (!signature || !timestamp) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Missing webhook signature or timestamp",
		);
	}

	const payload = JSON.stringify(req.body);
	const isValid = await webhookService.verifySignature(
		payload,
		signature,
		timestamp,
	);

	if (!isValid) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid webhook signature");
	}

	const data: IEmailStatusWebhook = req.body;
	const result = await webhookService.processEmailStatus(data);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Webhook received and processed successfully",
		data: {
			received: true,
			messageId: result.messageId,
			processedAt: new Date(),
		},
	});
});

const getWebhookLogs = catchAsync(async (req: Request, res: Response) => {
	const { event, source, status, limit } = req.query;

	const logs = await webhookService.getWebhookLogs({
		event: event as string,
		source: source as string,
		status: status as string,
		limit: limit ? Number.parseInt(limit as string, 10) : 100,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Webhook logs retrieved successfully",
		data: logs,
	});
});

const handleNotificationWebhook = catchAsync(
	async (req: Request, res: Response) => {
		const signature = req.headers["x-webhook-signature"] as string;
		const timestamp = req.headers["x-webhook-timestamp"] as string;

		if (!signature || !timestamp) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"Missing webhook signature or timestamp",
			);
		}

		const payload = JSON.stringify(req.body);
		const isValid = await webhookService.verifySignature(
			payload,
			signature,
			timestamp,
		);

		if (!isValid) {
			throw new AppError(httpStatus.UNAUTHORIZED, "Invalid webhook signature");
		}

		const data = req.body;
		const result = await webhookService.processNotificationWebhook(data);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Notification webhook processed successfully",
			data: {
				received: true,
				notificationId: result.notificationId,
				processedAt: new Date(),
			},
		});
	},
);

const createExternalWebhook = catchAsync(
	async (req: Request, res: Response) => {
		const webhook = await webhookService.createExternalWebhook(req.body);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "External webhook created successfully",
			data: webhook,
		});
	},
);

const getExternalWebhooks = catchAsync(async (req: Request, res: Response) => {
	const { isActive } = req.query;
	const filters = isActive ? { isActive: isActive === "true" } : undefined;

	const webhooks = await webhookService.getExternalWebhooks(filters);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "External webhooks retrieved successfully",
		data: webhooks,
	});
});

const updateExternalWebhook = catchAsync(
	async (req: Request, res: Response) => {
		const { id } = req.params;
		const webhook = await webhookService.updateExternalWebhook(id, req.body);

		if (!webhook) {
			throw new AppError(httpStatus.NOT_FOUND, "Webhook not found");
		}

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "External webhook updated successfully",
			data: webhook,
		});
	},
);

const deleteExternalWebhook = catchAsync(
	async (req: Request, res: Response) => {
		const { id } = req.params;
		await webhookService.deleteExternalWebhook(id);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "External webhook deleted successfully",
			data: null,
		});
	},
);

export const WebhookController = {
	handleEmailStatus,
	handleNotificationWebhook,
	getWebhookLogs,
	createExternalWebhook,
	getExternalWebhooks,
	updateExternalWebhook,
	deleteExternalWebhook,
};
