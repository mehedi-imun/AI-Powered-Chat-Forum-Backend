/**
 * Unit Tests for HTML Sanitization Utility
 * 
 * Tests XSS prevention and HTML sanitization functions
 */

import {
	sanitizeInput,
	escapeHtml,
	sanitizeSearchQuery,
	sanitizeUrl,
} from '../sanitize';

describe('Sanitization Utility', () => {
	describe('sanitizeInput', () => {
		it('should allow safe HTML tags', () => {
			const input = '<p>Hello <strong>World</strong></p>';
			const result = sanitizeInput(input);
			expect(result).toBe('<p>Hello <strong>World</strong></p>');
		});

		it('should remove dangerous script tags', () => {
			const input = '<p>Hello</p><script>alert("XSS")</script>';
			const result = sanitizeInput(input);
			expect(result).not.toContain('<script>');
			expect(result).toContain('<p>Hello</p>');
		});

		it('should remove event handlers', () => {
			const input = '<p onclick="alert(\'XSS\')">Click me</p>';
			const result = sanitizeInput(input);
			expect(result).not.toContain('onclick');
			expect(result).toContain('<p>Click me</p>');
		});

		it('should sanitize malicious links', () => {
			const input = '<a href="javascript:alert(\'XSS\')">Click</a>';
			const result = sanitizeInput(input);
			expect(result).not.toContain('javascript:');
		});

		it('should enforce target="_blank" for links', () => {
			const input = '<a href="https://example.com">Link</a>';
			const result = sanitizeInput(input);
			expect(result).toContain('target="_blank"');
			expect(result).toContain('rel="noopener noreferrer"');
		});

		it('should allow safe image tags', () => {
			const input = '<img src="https://example.com/image.jpg" alt="Test" />';
			const result = sanitizeInput(input);
			expect(result).toContain('<img');
			expect(result).toContain('src="https://example.com/image.jpg"');
		});

		it('should remove dangerous iframes', () => {
			const input = '<p>Content</p><iframe src="evil.com"></iframe>';
			const result = sanitizeInput(input);
			expect(result).not.toContain('<iframe>');
			expect(result).toContain('<p>Content</p>');
		});

		it('should preserve code blocks', () => {
			const input = '<pre><code>const x = 5;</code></pre>';
			const result = sanitizeInput(input);
			expect(result).toContain('<pre>');
			expect(result).toContain('<code>');
		});
	});

	describe('escapeHtml', () => {
		it('should escape all HTML tags', () => {
			const input = '<script>alert("XSS")</script>';
			const result = escapeHtml(input);
			expect(result).not.toContain('<script>');
			expect(result).not.toContain('</script>');
		});

		it('should escape HTML entities', () => {
			const input = 'Hello & goodbye < > "quotes"';
			const result = escapeHtml(input);
			expect(result).toBe('Hello &amp; goodbye &lt; &gt; "quotes"');
		});

		it('should handle empty strings', () => {
			const result = escapeHtml('');
			expect(result).toBe('');
		});

		it('should handle plain text', () => {
			const input = 'Just plain text';
			const result = escapeHtml(input);
			expect(result).toBe('Just plain text');
		});
	});

	describe('sanitizeSearchQuery', () => {
		it('should escape regex special characters', () => {
			const input = 'search.*query[test]';
			const result = sanitizeSearchQuery(input);
			expect(result).toBe('search\\.\\*query\\[test\\]');
		});

		it('should trim whitespace', () => {
			const input = '  search query  ';
			const result = sanitizeSearchQuery(input);
			expect(result).toBe('search query');
		});

		it('should limit length to 200 characters', () => {
			const input = 'a'.repeat(300);
			const result = sanitizeSearchQuery(input);
			expect(result.length).toBe(200);
		});

		it('should handle special regex patterns', () => {
			const input = '(test|query)+';
			const result = sanitizeSearchQuery(input);
			expect(result).toBe('\\(test\\|query\\)\\+');
		});
	});

	describe('sanitizeUrl', () => {
		it('should allow valid HTTP URLs', () => {
			const input = 'http://example.com/path';
			const result = sanitizeUrl(input);
			expect(result).toBe('http://example.com/path');
		});

		it('should allow valid HTTPS URLs', () => {
			const input = 'https://example.com/path';
			const result = sanitizeUrl(input);
			expect(result).toBe('https://example.com/path');
		});

		it('should reject javascript protocol', () => {
			const input = 'javascript:alert("XSS")';
			const result = sanitizeUrl(input);
			expect(result).toBeNull();
		});

		it('should reject data protocol', () => {
			const input = 'data:text/html,<script>alert("XSS")</script>';
			const result = sanitizeUrl(input);
			expect(result).toBeNull();
		});

		it('should reject file protocol', () => {
			const input = 'file:///etc/passwd';
			const result = sanitizeUrl(input);
			expect(result).toBeNull();
		});

		it('should reject invalid URLs', () => {
			const input = 'not a url';
			const result = sanitizeUrl(input);
			expect(result).toBeNull();
		});

		it('should handle URLs with query parameters', () => {
			const input = 'https://example.com?param=value&test=123';
			const result = sanitizeUrl(input);
			expect(result).toBe('https://example.com/?param=value&test=123');
		});
	});
});
