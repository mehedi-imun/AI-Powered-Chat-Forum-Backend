import env from "../config/env";
import { getRedisClient } from "../config/redis";
import logger from "../utils/logger";

// ─── Circuit breaker constants ────────────────────────────────────────────────

const CIRCUIT_KEYS = {
	state: "ai:circuit:state",
	failures: "ai:circuit:failures",
	openedAt: "ai:circuit:opened_at",
};

const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 120_000; // 2 minutes

// ─── Circuit breaker error ────────────────────────────────────────────────────

class CircuitOpenError extends Error {
	constructor() {
		super("AI circuit breaker is open — OpenRouter calls suspended");
		this.name = "CircuitOpenError";
	}
}

// ─── Circuit breaker helpers (internal) ──────────────────────────────────────

const getCircuitState = async (): Promise<"closed" | "open" | "half-open"> => {
	const redis = getRedisClient();
	if (!redis) return "closed"; // fail open if Redis unavailable
	try {
		const state = await redis.get(CIRCUIT_KEYS.state);
		return (state as "closed" | "open" | "half-open") || "closed";
	} catch {
		return "closed";
	}
};

const setCircuitState = async (
	state: "closed" | "open" | "half-open",
): Promise<void> => {
	const redis = getRedisClient();
	if (!redis) return;
	try {
		await redis.set(CIRCUIT_KEYS.state, state);
	} catch {
		// ignore — fail open
	}
};

const getFailures = async (): Promise<number> => {
	const redis = getRedisClient();
	if (!redis) return 0;
	try {
		const val = await redis.get(CIRCUIT_KEYS.failures);
		return val ? Number.parseInt(val, 10) : 0;
	} catch {
		return 0;
	}
};

const incrementFailures = async (): Promise<number> => {
	const redis = getRedisClient();
	if (!redis) return 0;
	try {
		return await redis.incr(CIRCUIT_KEYS.failures);
	} catch {
		return 0;
	}
};

const resetFailures = async (): Promise<void> => {
	const redis = getRedisClient();
	if (!redis) return;
	try {
		await redis.set(CIRCUIT_KEYS.failures, "0");
	} catch {
		// ignore — fail open
	}
};

// ─── OpenRouter wrapper with circuit breaker ─────────────────────────────────

const callOpenRouter = async (
	messages: Array<{ role: string; content: string }>,
	temperature = 0.5,
	maxTokens = 500,
): Promise<string> => {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error("OpenRouter API key not configured");
	}

	// Circuit breaker pre-flight check
	const state = await getCircuitState();

	if (state === "open") {
		const redis = getRedisClient();
		let openedAt = 0;
		try {
			const val = redis ? await redis.get(CIRCUIT_KEYS.openedAt) : null;
			openedAt = val ? Number.parseInt(val, 10) : 0;
		} catch {
			// ignore — treat openedAt as 0 (will transition to half-open)
		}

		if (Date.now() - openedAt < OPEN_DURATION_MS) {
			// Still within the open window — reject immediately, no HTTP request
			throw new CircuitOpenError();
		}

		// 2 min elapsed → transition to half-open and allow one probe through
		await setCircuitState("half-open");
		logger.info("AI circuit breaker: transitioning to half-open");
	}

	try {
		logger.info(`Calling OpenRouter API with model: ${env.OPENROUTER_MODEL}`);

		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
					"HTTP-Referer": env.SITE_URL ?? "",
					"X-Title": env.SITE_NAME ?? "",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: env.OPENROUTER_MODEL || "minimax/minimax-m2:free",
					messages: messages,
					temperature: temperature,
					max_tokens: maxTokens,
				}),
			},
		);

		logger.info(`OpenRouter response status: ${response.status}`);

		if (!response.ok) {
			const errorText = await response.text();
			logger.error("OpenRouter API error response");
			throw new Error(
				`OpenRouter API error: ${response.status} - ${errorText}`,
			);
		}

		const data = await response.json();
		logger.info(
			"OpenRouter data received, choices:",
			data.choices?.length || 0,
		);

		const content = data.choices[0]?.message?.content || "";
		if (!content) {
			logger.error("Empty response from OpenRouter");
		}

		// SUCCESS — reset circuit
		const currentState = await getCircuitState();
		if (currentState === "half-open") {
			await setCircuitState("closed");
			logger.info("AI circuit breaker: closed (recovered from half-open)");
		}
		await resetFailures();

		return content;
	} catch (error) {
		// Do not count a CircuitOpenError as a new failure
		if (error instanceof CircuitOpenError) throw error;

		// FAILURE — update circuit
		const failures = await incrementFailures();
		logger.warn(`AI circuit breaker: failure ${failures}/${FAILURE_THRESHOLD}`);

		if (failures >= FAILURE_THRESHOLD) {
			await setCircuitState("open");
			const redis = getRedisClient();
			try {
				if (redis)
					await redis.set(CIRCUIT_KEYS.openedAt, Date.now().toString());
			} catch {
				// ignore
			}
			logger.error(
				`AI circuit breaker: OPEN after ${failures} consecutive failures`,
			);
		}

		logger.error("OpenRouter API request failed");
		throw error;
	}
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IModerationResult {
	isSpam: boolean;
	isToxic: boolean;
	isInappropriate: boolean;
	spamScore: number; // 0-1
	toxicityScore: number; // 0-1
	inappropriateScore: number; // 0-1
	recommendation: "approve" | "review" | "reject";
	reasoning: string;
}

export interface ISummaryResult {
	summary: string;
	keyPoints: string[];
	wordCount: number;
	sentimentScore: number; // -1 to 1 (negative to positive)
}

// ─── moderateContent ──────────────────────────────────────────────────────────

export const moderateContent = async (
	content: string,
): Promise<IModerationResult> => {
	try {
		if (!env.OPENROUTER_API_KEY) {
			logger.warn("OpenRouter API key not configured, using mock moderation");
			return mockModeration(content);
		}

		const prompt = `Analyze the following content for moderation purposes. Rate it on three dimensions:
1. Spam (promotional content, repetitive, off-topic)
2. Toxicity (offensive language, hate speech, harassment)
3. Inappropriate (adult content, violence, illegal activities)

For each dimension, provide a score from 0 (clean) to 1 (severe violation).
Then provide a recommendation: "approve" (all scores < 0.3), "review" (any score 0.3-0.7), or "reject" (any score > 0.7).
Finally, explain your reasoning in 1-2 sentences.

Content to analyze:
"""
${content}
"""

Respond in JSON format:
{
  "spamScore": 0.0,
  "toxicityScore": 0.0,
  "inappropriateScore": 0.0,
  "recommendation": "approve",
  "reasoning": "explanation here"
}`;

		const responseText = await callOpenRouter(
			[
				{
					role: "system",
					content: "Content moderator. Return only valid JSON.",
				},
				{ role: "user", content: prompt },
			],
			0.3,
			200,
		);

		logger.info({
			msg: "OpenRouter response",
			response: responseText.substring(0, 200),
		});

		let jsonText = responseText.trim();
		if (jsonText.includes("```json")) {
			jsonText = jsonText.split("```json")[1].split("```")[0].trim();
		} else if (jsonText.includes("```")) {
			jsonText = jsonText.split("```")[1].split("```")[0].trim();
		}

		const result = JSON.parse(jsonText);

		return {
			isSpam: result.spamScore > 0.3,
			isToxic: result.toxicityScore > 0.3,
			isInappropriate: result.inappropriateScore > 0.3,
			spamScore: result.spamScore,
			toxicityScore: result.toxicityScore,
			inappropriateScore: result.inappropriateScore,
			recommendation: result.recommendation,
			reasoning: result.reasoning,
		};
	} catch (_error) {
		logger.error("AI moderation error");
		return mockModeration(content);
	}
};

// ─── generateThreadSummary ────────────────────────────────────────────────────

export const generateThreadSummary = async (
	posts: Array<{ content: string; author: string; createdAt: Date }>,
): Promise<ISummaryResult> => {
	try {
		if (!env.OPENROUTER_API_KEY) {
			logger.warn("OpenRouter API key not configured, using mock summary");
			return mockSummary(posts);
		}

		const formattedPosts = posts
			.map(
				(post, idx) =>
					`Post ${idx + 1} (by ${
						post.author
					} at ${post.createdAt.toISOString()}):\n${post.content}`,
			)
			.join("\n\n---\n\n");

		const prompt = `Summarize the following discussion thread. Provide:
1. A concise summary (2-3 sentences)
2. Key points discussed (3-5 bullet points)
3. Overall sentiment score from -1 (very negative) to 1 (very positive)

Discussion thread:
"""
${formattedPosts}
"""

Respond in JSON format:
{
  "summary": "summary here",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "sentimentScore": 0.0
}`;

		const responseText = await callOpenRouter(
			[
				{
					role: "system",
					content:
						"You are a helpful assistant that summarizes discussion threads. Provide clear, concise summaries in JSON format.",
				},
				{ role: "user", content: prompt },
			],
			0.5,
			500,
		);

		logger.info({
			msg: "OpenRouter summary response",
			response: responseText.substring(0, 200),
		});

		let jsonText = responseText.trim();
		if (jsonText.includes("```json")) {
			jsonText = jsonText.split("```json")[1].split("```")[0].trim();
		} else if (jsonText.includes("```")) {
			jsonText = jsonText.split("```")[1].split("```")[0].trim();
		}

		const result = JSON.parse(jsonText);

		return {
			summary: result.summary,
			keyPoints: result.keyPoints || [],
			wordCount: result.summary.split(" ").length,
			sentimentScore: result.sentimentScore,
		};
	} catch (_error) {
		logger.error("AI summary error");
		return mockSummary(posts);
	}
};

// ─── Mock fallbacks ───────────────────────────────────────────────────────────

const mockModeration = (content: string): IModerationResult => {
	if (!content) {
		logger.error("Mock moderation received undefined content");
		return {
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0,
			toxicityScore: 0,
			inappropriateScore: 0,
			recommendation: "approve",
			reasoning: "Error: Content is undefined",
		};
	}

	const lowerContent = content.toLowerCase();

	const spamKeywords = ["buy now", "click here", "limited offer", "free money"];
	const toxicKeywords = ["hate", "stupid", "idiot", "kill"];
	const inappropriateKeywords = ["adult", "explicit"];

	const spamScore = spamKeywords.some((kw) => lowerContent.includes(kw))
		? 0.8
		: 0.1;
	const toxicityScore = toxicKeywords.some((kw) => lowerContent.includes(kw))
		? 0.8
		: 0.1;
	const inappropriateScore = inappropriateKeywords.some((kw) =>
		lowerContent.includes(kw),
	)
		? 0.8
		: 0.1;

	const maxScore = Math.max(spamScore, toxicityScore, inappropriateScore);
	const recommendation =
		maxScore > 0.7 ? "reject" : maxScore > 0.3 ? "review" : "approve";

	return {
		isSpam: spamScore > 0.3,
		isToxic: toxicityScore > 0.3,
		isInappropriate: inappropriateScore > 0.3,
		spamScore,
		toxicityScore,
		inappropriateScore,
		recommendation,
		reasoning: "Mock moderation based on keyword detection",
	};
};

const mockSummary = (
	posts: Array<{ content: string; author: string }>,
): ISummaryResult => {
	const allContent = posts.map((p) => p.content).join(" ");
	const wordCount = allContent.split(" ").length;

	return {
		summary: `This thread contains ${posts.length} posts discussing various topics. Mock summary generated due to missing AI configuration.`,
		keyPoints: [
			`Total posts: ${posts.length}`,
			`Total words: ${wordCount}`,
			"AI moderation not configured",
		],
		wordCount: 20,
		sentimentScore: 0,
	};
};

// ─── Exported circuit breaker object ─────────────────────────────────────────

export const circuitBreaker = {
	getState: async (): Promise<"closed" | "open" | "half-open"> =>
		getCircuitState(),
	getFailures: async (): Promise<number> => getFailures(),
	reset: async (): Promise<void> => {
		await setCircuitState("closed");
		await resetFailures();
		const redis = getRedisClient();
		if (redis) {
			try {
				await redis.del(CIRCUIT_KEYS.openedAt);
			} catch {
				// ignore
			}
		}
	},
};

// ─── AIService export ─────────────────────────────────────────────────────────

export const AIService = {
	moderateContent,
	generateThreadSummary,
	circuitBreaker,
};
