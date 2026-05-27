import { LightningElement, track } from 'lwc';

const API_ENDPOINT = 'https://YOUR-API-HOST/api/chat';

let msgIdCounter = 0;
const uid = () => `msg-${++msgIdCounter}`;

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeChatMessage(role, text) {
    return {
        role: { value: role },
        contents: [{ $type: 'TextContent', text }],
    };
}

function extractText(msg) {
    return (msg.contents || []).map(c => c.text || '').join('');
}

export default class EinsteinChat extends LightningElement {

    // ── State ────────────────────────────────────────────────────────────────
    @track uiMessages   = [];
    @track inputValue   = '';
    @track isLoading    = false;
    @track errorMessage = null;
    @track isMinimized  = true;   // starts as FAB, user clicks to open
    @track unreadCount  = 0;

    history = [];

    suggestions = [
        'Summarize this account record',        
        'Draft a follow-up email',
        'Show top opportunities for this account',
    ];

    // ── Computed ─────────────────────────────────────────────────────────────
    get showWelcome() {
        return this.uiMessages.length === 0;
    }

    get sendDisabled() {
        return this.isLoading || !this.inputValue.trim();
    }

    get containerClass() {
        return this.isMinimized ? 'chat-container minimized' : 'chat-container open';
    }

    // ── Open / Minimize ──────────────────────────────────────────────────────
    toggleChat() {
        this.isMinimized = !this.isMinimized;
        if (!this.isMinimized) {
            this.unreadCount = 0;
            this._scrollToBottom();
        }
    }

    // Stop the header click from also firing toggleChat when clicking buttons
    handleMinimize(e) {
        e.stopPropagation();
        this.isMinimized = true;
    }

    // ── Input handlers ───────────────────────────────────────────────────────
    handleInput(e) {
        this.inputValue = e.target.value;
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    handleSuggestion(e) {
        this.inputValue = e.currentTarget.dataset.label;
        this.sendMessage();
    }

    clearChat() {
        this.history      = [];
        this.uiMessages   = [];
        this.errorMessage = null;
        this.unreadCount  = 0;
    }

    // ── Send ─────────────────────────────────────────────────────────────────
    async sendMessage() {
        const text = this.inputValue.trim();
        if (!text || this.isLoading) return;

        this.inputValue   = '';
        this.errorMessage = null;

        this.uiMessages = [
            ...this.uiMessages,
            this._makeUiMsg('user', text),
            this._makeUiMsg('assistant', '', true),
        ];

        this.history   = [...this.history, makeChatMessage('user', text)];
        this.isLoading = true;

        this._scrollToBottom();

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.history),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            const updatedHistory = await response.json();
            this.history = updatedHistory;

            const replyText = extractText(updatedHistory[updatedHistory.length - 1]);

            this.uiMessages = [
                ...this.uiMessages.filter(m => !m.typing),
                this._makeUiMsg('assistant', replyText),
            ];

            // Increment badge if window is minimized
            if (this.isMinimized) {
                this.unreadCount += 1;
            }

        } catch (err) {
            this.uiMessages   = this.uiMessages.filter(m => !m.typing);
            this.errorMessage = err.message || 'Could not reach Einstein. Please try again.';
        } finally {
            this.isLoading = false;
            this._scrollToBottom();
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    _makeUiMsg(role, text, typing = false) {
        const isUser = role === 'user';
        return {
            id:         uid(),
            role,
            text,
            typing,
            initials:   isUser ? 'JD' : 'AI',
            name:       isUser ? 'John Doe' : 'Einstein',
            time:       typing ? null : formatTime(new Date()),
            wrapClass:  `msg-wrap ${isUser ? 'msg-user' : 'msg-assistant'}`,
            avatarClass:`msg-avatar ${isUser ? 'avatar-user' : 'avatar-ai'}`,
            bubbleClass:`msg-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`,
        };
    }

    _scrollToBottom() {
        setTimeout(() => {
            const list = this.refs.messageList;
            if (list) list.scrollTop = list.scrollHeight;
        }, 50);
    }
}