/**
 * Unit tests for content-filter.ts
 * Spec: .claude/specs/06-ai-cost-filter.md
 */

import { checkContentLocally, hashContent } from "../content-filter";

describe("checkContentLocally", () => {
	describe("short content — auto-approve", () => {
		it("returns 'approve' for empty string", () => {
			expect(checkContentLocally("")).toBe("approve");
		});

		it("returns 'approve' for content with only whitespace (trimmed length 0)", () => {
			expect(checkContentLocally("   ")).toBe("approve");
		});

		it("returns 'approve' for content less than 20 chars", () => {
			expect(checkContentLocally("short")).toBe("approve");
		});

		it("returns 'approve' for content with exactly 19 chars after trim", () => {
			// 19 chars: "1234567890123456789"
			expect(checkContentLocally("1234567890123456789")).toBe("approve");
		});

		it("returns 'approve' when whitespace padding makes trimmed length < 20", () => {
			expect(checkContentLocally("  hello world  ")).toBe("approve");
		});

		it("returns 'api' for content with exactly 20 chars (boundary — not approved)", () => {
			// exactly 20 chars: "12345678901234567890"
			expect(checkContentLocally("12345678901234567890")).toBe("api");
		});
	});

	describe("toxic content — fast-reject", () => {
		it("returns 'reject' for 'kys' keyword", () => {
			expect(checkContentLocally("You should just kys already man")).toBe("reject");
		});

		it("returns 'reject' for 'kill yourself' phrase", () => {
			expect(checkContentLocally("seriously you should kill yourself today")).toBe("reject");
		});

		it("returns 'reject' for 'go die' phrase", () => {
			expect(checkContentLocally("You are terrible, go die in a hole")).toBe("reject");
		});

		it("returns 'reject' for 'you should die' phrase", () => {
			expect(checkContentLocally("Honestly I think you should die already")).toBe("reject");
		});

		it("returns 'reject' for toxic keyword (case-insensitive uppercase)", () => {
			expect(checkContentLocally("Just KYS you pathetic loser ok?")).toBe("reject");
		});

		it("returns 'reject' for toxic keyword (case-insensitive mixed case)", () => {
			expect(checkContentLocally("Just Kill Yourself already you loser")).toBe("reject");
		});

		it("returns 'reject' for racial slur n-word variant", () => {
			// Testing pattern coverage: n[i1]gg[ae3]r
			expect(checkContentLocally("This is a hateful n1gger slur message here")).toBe("reject");
		});
	});

	describe("spam content — fast-reject", () => {
		it("returns 'reject' for 'buy now' spam phrase", () => {
			expect(checkContentLocally("Amazing deal — buy now before offer ends!")).toBe("reject");
		});

		it("returns 'reject' for 'click here' spam phrase", () => {
			expect(checkContentLocally("Get your free prize, click here to claim it")).toBe("reject");
		});

		it("returns 'reject' for 'limited offer' spam phrase", () => {
			expect(checkContentLocally("This is a limited offer for our members today")).toBe("reject");
		});

		it("returns 'reject' for 'free money' spam phrase", () => {
			expect(checkContentLocally("You can get free money by joining this program")).toBe("reject");
		});

		it("returns 'reject' for 'earn $' spam phrase", () => {
			// The pattern uses \b after $, which requires a word character to follow the $
			expect(checkContentLocally("Sign up today and earn $100 every week easily")).toBe("reject");
		});

		it("returns 'reject' for 'make money fast' spam phrase", () => {
			expect(checkContentLocally("This is how to make money fast with zero effort")).toBe("reject");
		});

		it("returns 'reject' for 'work from home' spam phrase", () => {
			expect(checkContentLocally("Incredible opportunity to work from home every day")).toBe("reject");
		});

		it("returns 'reject' for 'crypto investment' spam phrase", () => {
			expect(checkContentLocally("Great crypto investment opportunity for you today")).toBe("reject");
		});

		it("returns 'reject' for 10+ repeated characters", () => {
			expect(checkContentLocally("Hellooooooooooo this is a test message for you")).toBe("reject");
		});

		it("returns 'reject' for exactly 10 repeated characters (boundary)", () => {
			// "aaaaaaaaaa" = 10 repeated 'a'
			expect(checkContentLocally("aaaaaaaaaa this is extra text to pass length check")).toBe("reject");
		});

		it("returns 'reject' for 3 or more URLs in a message", () => {
			// The pattern (https?:\/\/\S+\s*){3,} requires 3+ URLs with only optional whitespace between them
			const msg = "http://site1.com http://site2.com http://site3.com";
			expect(checkContentLocally(msg)).toBe("reject");
		});

		it("returns 'reject' for spam keyword (case-insensitive)", () => {
			expect(checkContentLocally("CLICK HERE to get your reward right now today")).toBe("reject");
		});
	});

	describe("normal content — send to API", () => {
		it("returns 'api' for normal discussion content over 20 chars", () => {
			expect(checkContentLocally("I think this feature is really useful for users")).toBe("api");
		});

		it("returns 'api' for technical content", () => {
			expect(checkContentLocally("The TypeScript compiler error in line 42 needs fixing")).toBe("api");
		});

		it("returns 'api' for content with exactly 20 chars", () => {
			expect(checkContentLocally("12345678901234567890")).toBe("api");
		});

		it("returns 'api' for a long benign paragraph", () => {
			const msg = "This is a really long message about programming that contains nothing harmful or spammy at all.";
			expect(checkContentLocally(msg)).toBe("api");
		});

		it("returns 'api' for content with a single URL (not spam)", () => {
			expect(checkContentLocally("Check out this interesting article: https://example.com it was helpful")).toBe("api");
		});

		it("returns 'api' for content with two URLs (below the 3-URL threshold)", () => {
			const msg = "See https://site1.com and https://site2.com for more information about this topic";
			expect(checkContentLocally(msg)).toBe("api");
		});

		it("returns 'api' for content with 9 repeated chars (below 10-char threshold)", () => {
			expect(checkContentLocally("aaaaaaaaa this is extra text to make it over 20 characters")).toBe("api");
		});
	});
});

describe("hashContent", () => {
	it("returns a 64-character hex string", () => {
		const hash = hashContent("hello world");
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("same content always produces the same hash", () => {
		const content = "This is my test content for hashing purposes";
		expect(hashContent(content)).toBe(hashContent(content));
	});

	it("different content produces different hashes", () => {
		const hash1 = hashContent("content one is different");
		const hash2 = hashContent("content two is different");
		expect(hash1).not.toBe(hash2);
	});

	it("trims whitespace before hashing (leading/trailing spaces ignored)", () => {
		const hash1 = hashContent("  hello world  ");
		const hash2 = hashContent("hello world");
		expect(hash1).toBe(hash2);
	});

	it("handles empty string", () => {
		const hash = hashContent("");
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is case-sensitive (uppercase and lowercase differ)", () => {
		const hash1 = hashContent("Hello World Content Here");
		const hash2 = hashContent("hello world content here");
		expect(hash1).not.toBe(hash2);
	});
});
