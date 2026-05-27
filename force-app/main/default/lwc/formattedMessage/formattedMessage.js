import { LightningElement, api } from 'lwc';
import { formatMessage } from 'c/messageFormatter';

/**
 * Renders chatbot message text as sanitized, display-ready HTML.
 *
 * Uses lwc:dom="manual" because the formatted output is an HTML string built
 * by our allowlist sanitizer (see messageFormatter). LWC's template engine
 * escapes bound text, so manual DOM is the supported way to inject vetted HTML.
 */
export default class FormattedMessage extends LightningElement {
    _raw = '';
    _rendered = false;

    @api
    get value() {
        return this._raw;
    }
    set value(v) {
        this._raw = v == null ? '' : String(v);
        this._inject();
    }

    renderedCallback() {
        this._rendered = true;
        this._inject();
    }

    _inject() {
        if (!this._rendered) return;
        const container = this.refs?.content;
        if (!container) return;
        // formatMessage returns sanitized HTML (allowlist + auto-link + <br>).
        container.innerHTML = formatMessage(this._raw);
    }
}