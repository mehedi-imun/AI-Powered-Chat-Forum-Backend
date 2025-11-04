/**
 * HTML Sanitization Utility
 * 
 * Prevents XSS attacks by sanitizing user-generated HTML content.
 * Used for rich text editors in posts, threads, and user profiles.
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize HTML content to prevent XSS attacks
 * 
 * Allows safe HTML tags and attributes while removing dangerous ones.
 * 
 * @param dirty - Potentially unsafe HTML content
 * @returns Sanitized HTML safe for rendering
 */
export const sanitizeInput = (dirty: string): string => {
	return sanitizeHtml(dirty, {
		// Allow common formatting tags
		allowedTags: [
			'p',
			'br',
			'strong',
			'b',
			'em',
			'i',
			'u',
			'strike',
			'del',
			'a',
			'ul',
			'ol',
			'li',
			'blockquote',
			'code',
			'pre',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'img',
			'hr',
		],

		// Allow specific attributes
		allowedAttributes: {
			a: ['href', 'title', 'target', 'rel'],
			img: ['src', 'alt', 'title', 'width', 'height'],
			code: ['class'],
			pre: ['class'],
		},

		// Allow specific URL schemes
		allowedSchemes: ['http', 'https', 'mailto'],

		// Allow specific protocols for links
		allowedSchemesByTag: {
			a: ['http', 'https', 'mailto'],
			img: ['http', 'https', 'data'],
		},

		// Disallow relative URLs
		allowProtocolRelative: false,

		// Enforce target="_blank" for external links
		transformTags: {
			a: (tagName, attribs) => {
				return {
					tagName,
					attribs: {
						...attribs,
						target: '_blank',
						rel: 'noopener noreferrer',
					},
				};
			},
		},
	});
};

/**
 * Sanitize plain text by escaping HTML entities
 * Use for titles, usernames, and other plain text fields
 * 
 * @param text - Plain text that might contain HTML
 * @returns Escaped text safe for rendering
 */
export const escapeHtml = (text: string): string => {
	return sanitizeHtml(text, {
		allowedTags: [],
		allowedAttributes: {},
	});
};

/**
 * Sanitize user input for search queries
 * Removes special characters that could cause issues
 * 
 * @param query - User search query
 * @returns Sanitized search query
 */
export const sanitizeSearchQuery = (query: string): string => {
	// Remove special regex characters and trim
	return query
		.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		.trim()
		.slice(0, 200); // Limit length
};

/**
 * Validate and sanitize URL
 * Ensures URL is safe and well-formed
 * 
 * @param url - URL to validate
 * @returns Sanitized URL or null if invalid
 */
export const sanitizeUrl = (url: string): string | null => {
	try {
		const parsed = new URL(url);
		// Only allow http and https protocols
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return null;
		}
		return parsed.toString();
	} catch {
		return null;
	}
};
