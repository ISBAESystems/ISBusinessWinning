/**
 * messageFormatter — turns raw chatbot output into safe, display-ready HTML.
 *
 * Why this exists:
 *   The bot may return plain text, partial HTML, or text containing bare URLs.
 *   LWC will not let us bind arbitrary HTML without lwc:dom="manual", and even
 *   then we must NOT inject unsanitized markup (XSS). This module produces a
 *   sanitized HTML string built from an explicit allowlist.
 *
 * Pipeline:
 *   1. If the input contains no HTML tags, treat it as plain text:
 *        - escape it
 *        - auto-link bare URLs
 *        - convert newlines to <br>
 *   2. If it contains HTML, parse it, walk the tree, and rebuild using only
 *      allowlisted tags/attributes. Bare URLs inside text nodes are linked.
 *
 * The output is intended to be assigned via lwc:dom="manual" into a container
 * the component owns.
 */

// Tags we allow through. Everything else is unwrapped (children kept, tag dropped).
const ALLOWED_TAGS = new Set([
    'A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'SPAN', 'DIV',
    'UL', 'OL', 'LI', 'CODE', 'PRE', 'BLOCKQUOTE', 'H1', 'H2', 'H3',
    'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'HR',
]);

// Per-tag allowed attributes. Anything not listed is stripped.
const ALLOWED_ATTRS = {
    A: ['href', 'title'],
};

// URL schemes permitted on <a href>. Blocks javascript:, data:, etc.
const SAFE_URL_RE = /^(https?:\/\/|mailto:|tel:|\/)/i;

// Matches bare URLs in text nodes for auto-linking.
// Handles http(s):// and www. prefixes; stops at whitespace and trailing punctuation.
const BARE_URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"])/gi;

const escapeHtml = (str) =>
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');

const looksLikeHtml = (str) => /<[a-z][\s\S]*>/i.test(str);

const isSafeUrl = (url) => SAFE_URL_RE.test(url.trim());

/**
 * Normalizes literal escape sequences that show up when text has been
 * JSON-encoded an extra time (so the response carries the two characters
 * backslash + "n" instead of a real newline). Converts \n, \r\n, \r, and \t
 * into real control characters. A doubled backslash (\\) is preserved as a
 * single literal backslash so genuine "\n" text isn't mangled.
 */
function normalizeEscapes(str) {
    return str.replace(/\\(\\|[nrt])/g, (m, ch) => {
        switch (ch) {
            case 'n': return '\n';
            case 'r': return '\r';
            case 't': return '\t';
            case '\\': return '\\';   // collapse escaped backslash
            default: return m;
        }
    });
}

/**
 * Replaces bare URLs in a plain (already-escaped) text string with anchor tags.
 * Operates on escaped text, so we re-escape nothing here.
 */
function autoLinkEscapedText(escaped) {
    return escaped.replace(BARE_URL_RE, (match) => {
        const href = match.startsWith('www.') ? `https://${match}` : match;
        // match is already escaped (came from escaped text), href derived from it
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
    });
}

/**
 * Plain-text path: escape, auto-link, newlines → <br>.
 */
function formatPlainText(text) {
    const escaped = escapeHtml(text);
    const linked  = autoLinkEscapedText(escaped);
    return linked.replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * Recursively sanitizes a DOM node into an HTML string using the allowlist.
 */
function sanitizeNode(node, doc) {
    // Text node: escape + auto-link bare URLs + preserve newlines.
    if (node.nodeType === 3 /* TEXT_NODE */) {
        const linked = autoLinkEscapedText(escapeHtml(node.textContent));
        return linked.replace(/\r\n|\r|\n/g, '<br>');
    }

    // Only element nodes beyond this point.
    if (node.nodeType !== 1 /* ELEMENT_NODE */) {
        return '';
    }

    const tag = node.tagName.toUpperCase();
    const innerHtml = Array.from(node.childNodes)
        .map((child) => sanitizeNode(child, doc))
        .join('');

    // Disallowed tag → drop the tag but keep sanitized children.
    if (!ALLOWED_TAGS.has(tag)) {
        return innerHtml;
    }

    // Void element.
    if (tag === 'BR' || tag === 'HR') {
        return `<${tag.toLowerCase()}>`;
    }

    // Build allowed attributes.
    let attrs = '';
    const allowedForTag = ALLOWED_ATTRS[tag] || [];
    for (const attrName of allowedForTag) {
        const val = node.getAttribute(attrName);
        if (val == null) continue;

        if (attrName === 'href') {
            if (!isSafeUrl(val)) continue;          // drop unsafe schemes
            attrs += ` href="${escapeHtml(val)}"`;
        } else {
            attrs += ` ${attrName}="${escapeHtml(val)}"`;
        }
    }

    // Force safe link behavior on anchors that survived.
    if (tag === 'A') {
        // If an <a> had no safe href, render it as a span instead of a dead link.
        if (!/ href=/.test(attrs)) {
            return `<span>${innerHtml}</span>`;
        }
        attrs += ' target="_blank" rel="noopener noreferrer"';
    }

    return `<${tag.toLowerCase()}${attrs}>${innerHtml}</${tag.toLowerCase()}>`;
}

/**
 * Public entry point. Returns a sanitized, display-ready HTML string.
 *
 * @param {string} raw  Raw text/HTML from the chatbot.
 * @returns {string}    Safe HTML for lwc:dom="manual".
 */
export function formatMessage(raw) {
    if (raw == null) return '';
    // Normalize literal "\n" / "\t" escape sequences (from double-encoded JSON)
    // into real control characters before any other processing.
    const text = normalizeEscapes(String(raw));

    if (!looksLikeHtml(text)) {
        return formatPlainText(text);
    }

    // Parse as HTML and sanitize. DOMParser is available in the LWC runtime.
    try {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const body = doc.body;
        if (!body) return formatPlainText(text);
        return Array.from(body.childNodes)
            .map((child) => sanitizeNode(child, doc))
            .join('');
    } catch (e) {
        // If parsing fails for any reason, fall back to the safe plain-text path.
        return formatPlainText(text);
    }
}