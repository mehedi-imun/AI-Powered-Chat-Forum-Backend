import OpenAI from "openai";
import env from "../config/env";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || "dummy-key-for-testing",
});

// AI Service Interface
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

/**
 * Moderate content using AI
 * Analyzes text for spam, toxicity, and inappropriate content
 */
export const moderateContent = async (
  content: string
): Promise<IModerationResult> => {
  try {
    // Skip if no API key (for testing)
    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === "dummy-key-for-testing") {
      console.warn("⚠️  OpenAI API key not configured, using mock moderation");
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

    const completion = await openai.chat.completions.create({
      model: env.AI_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a content moderation AI. Analyze text and provide moderation scores in JSON format.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(responseText);

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
  } catch (error: any) {
    console.error("❌ AI moderation error:", error.message);
    // Fallback to mock on error
    return mockModeration(content);
  }
};

/**
 * Generate thread summary using AI
 * Creates a concise summary of multiple posts
 */
export const generateThreadSummary = async (
  posts: Array<{ content: string; author: string; createdAt: Date }>
): Promise<ISummaryResult> => {
  try {
    // Skip if no API key (for testing)
    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === "dummy-key-for-testing") {
      console.warn("⚠️  OpenAI API key not configured, using mock summary");
      return mockSummary(posts);
    }

    // Format posts for AI
    const formattedPosts = posts
      .map(
        (post, idx) =>
          `Post ${idx + 1} (by ${post.author} at ${post.createdAt.toISOString()}):\n${post.content}`
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

    const completion = await openai.chat.completions.create({
      model: env.AI_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes discussion threads. Provide clear, concise summaries in JSON format.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(responseText);

    return {
      summary: result.summary,
      keyPoints: result.keyPoints || [],
      wordCount: result.summary.split(" ").length,
      sentimentScore: result.sentimentScore,
    };
  } catch (error: any) {
    console.error("❌ AI summary error:", error.message);
    // Fallback to mock on error
    return mockSummary(posts);
  }
};

/**
 * Mock moderation for testing/fallback
 */
const mockModeration = (content: string): IModerationResult => {
  const lowerContent = content.toLowerCase();

  // Simple keyword-based detection
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
    lowerContent.includes(kw)
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

/**
 * Mock summary for testing/fallback
 */
const mockSummary = (
  posts: Array<{ content: string; author: string }>
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

export const AIService = {
  moderateContent,
  generateThreadSummary,
};
