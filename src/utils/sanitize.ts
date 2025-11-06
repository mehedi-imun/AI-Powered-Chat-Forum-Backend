
import sanitizeHtml from 'sanitize-html';

export const sanitizeInput = (dirty: string): string => {
	return sanitizeHtml(dirty, {
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

		allowedAttributes: {
			a: ['href', 'title', 'target', 'rel'],
			img: ['src', 'alt', 'title', 'width', 'height'],
			code: ['class'],
			pre: ['class'],
		},

		allowedSchemes: ['http', 'https', 'mailto'],

		allowedSchemesByTag: {
			a: ['http', 'https', 'mailto'],
			img: ['http', 'https', 'data'],
		},

		allowProtocolRelative: false,

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

export const escapeHtml = (text: string): string => {
	return sanitizeHtml(text, {
		allowedTags: [],
		allowedAttributes: {},
	});
};

export const sanitizeSearchQuery = (query: string): string => {
	return query
		.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		.trim()
		.slice(0, 200); // Limit length
};

export const sanitizeUrl = (url: string): string | null => {
	try {
		const parsed = new URL(url);
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return null;
		}
		return parsed.toString();
	} catch {
		return null;
	}
};
