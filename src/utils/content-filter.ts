import crypto from "node:crypto";

export type LocalFilterResult = "approve" | "reject" | "api";

const SPAM_PATTERNS = [
	/\b(buy now|click here|limited offer|free money|earn \$|make money fast|work from home|crypto investment)\b/i,
	/(.)\1{9,}/, // 10+ repeated chars — "aaaaaaaaaa"
	/(https?:\/\/\S+\s*){3,}/, // 3+ URLs in one message
];

const TOXIC_PATTERNS = [
	/\b(kys|kill yourself|go die|you should die)\b/i,
	/\b(n[i1]gg[ae3]r|f[a@]gg[o0]t)\b/i,
];

export const checkContentLocally = (content: string): LocalFilterResult => {
	const trimmed = content.trim();

	// Very short content — no meaningful violation possible
	if (trimmed.length < 20) return "approve";

	// Obvious toxic → fast-reject
	if (TOXIC_PATTERNS.some((re) => re.test(trimmed))) return "reject";

	// Obvious spam → fast-reject
	if (SPAM_PATTERNS.some((re) => re.test(trimmed))) return "reject";

	return "api";
};

export const hashContent = (content: string): string =>
	crypto.createHash("sha256").update(content.trim()).digest("hex");
