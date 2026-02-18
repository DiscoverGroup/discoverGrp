import DOMPurify from 'dompurify';

interface SanitizeConfig {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  ALLOW_DATA_ATTR?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param dirty - The potentially unsafe HTML string
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string safe for rendering
 */
export const sanitizeHtml = (
  dirty: string,
  options?: SanitizeConfig
): string => {
  const result = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre',
      'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false,
    ...options,
  });
  
  return typeof result === 'string' ? result : '';
};

/**
 * Sanitizes user input by removing all HTML tags
 * Use for text-only inputs where no HTML should be allowed
 * @param input - The user input string
 * @returns Plain text with all HTML removed
 */
export const sanitizeText = (input: string): string => {
  const result = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false,
  });
  
  return typeof result === 'string' ? result : '';
};

/**
 * Sanitizes URLs to prevent javascript: and data: URI attacks
 * @param url - The URL to sanitize
 * @returns Safe URL or empty string if invalid
 */
export const sanitizeUrl = (url: string): string => {
  const sanitized = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false,
  });
  
  const cleanUrl = typeof sanitized === 'string' ? sanitized : '';
  
  // Only allow http, https, and relative URLs
  if (
    cleanUrl.startsWith('http://') ||
    cleanUrl.startsWith('https://') ||
    cleanUrl.startsWith('/')
  ) {
    return cleanUrl;
  }
  
  return '';
};

/**
 * Sanitizes search query input
 * @param query - The search query string
 * @returns Sanitized query string
 */
export const sanitizeSearchQuery = (query: string): string => {
  // Remove HTML, trim whitespace, and limit length
  const cleaned = sanitizeText(query).trim();
  return cleaned.substring(0, 200); // Limit to 200 chars
};

/**
 * React Hook for sanitizing HTML content
 * @param html - The HTML content to sanitize
 * @returns Object with __html property for dangerouslySetInnerHTML
 */
export const useSanitizedHtml = (html: string): { __html: string } => {
  return {
    __html: sanitizeHtml(html),
  };
};

/**
 * Sanitizes form data object
 * @param data - Form data object
 * @returns Sanitized form data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sanitizeFormData = <T extends Record<string, any>>(data: T): T => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeFormData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};
