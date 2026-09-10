(function(){
  const SUGGESTIONS = [
    'How much are tickets & hours?',
    'Where is the Staff Office?',
    'Tell me about the Touch Pool',
    'What exhibits are on Level 2?',
    'Can I take photos & bring food?',
    'Is there wheelchair access or a ramp?',
    'How do I get here from Bacolod?'
  ];

  function escapeHtml(str){
    return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  // Safe markdown to HTML formatter for bot messages
  function renderMarkdown(text) {
    if (!text) return '';
    let safe = escapeHtml(text);

    // Bold **text**
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Markdown Links [title](url) - only allow safe URLs
    safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, title, url) => {
      const cleanUrl = url.trim();
      if (cleanUrl.startsWith('/') || cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('mailto:') || cleanUrl.startsWith('tel:')) {
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${title}</a>`;
      }
      return title;
    });

    // Bullets starting with • or -
    safe = safe.replace(/(?:^|\n)[•\-]\s+(.+)/g, '\n<div class="chat-bullet">• $1</div>');

    // Replace linebreaks with <br>
    safe = safe.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');

    return safe;
  }

  const WELCOME_MESSAGE = 'Hi! I am **Bata Guide**, your AI assistant for **Museo Sang Bata sa Negros**! Ask me anything about our exhibits, floor layout, Staff Office, Touch Pool, ticket prices, visiting hours, or directions. How can I help you?';

  const state = { history: [], sending: false, opened: false };

  const root = document.createElement('div');
  root.innerHTML = `
    <button class="chat-toggle" id="chatToggleBtn" aria-label="Chat with the museum assistant" title="Chat with Bata Guide AI">💬</button>
    <div class="chat-panel" id="chatPanel" role="dialog" aria-label="Museum Assistant Chat">
      <div class="chat-head">
        <div>
          <div class="title">Bata Guide AI</div>
          <div class="subtitle">Exhibits, Layout &amp; Visiting Info</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="chat-head-btn" id="chatClearBtn" title="Reset chat" aria-label="Reset chat">🔄</button>
          <button class="chat-close" id="chatCloseBtn" aria-label="Close chat">✕</button>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-msg bot">${renderMarkdown(WELCOME_MESSAGE)}</div>
      </div>
      <div class="chat-suggestions" id="chatSuggestions">
        ${SUGGESTIONS.map(s => `<button class="chat-chip" data-suggestion="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
      </div>
      <div class="chat-input-row">
        <input type="text" id="chatInput" placeholder="Ask any question about the museum…" maxlength="600" aria-label="Ask a question">
        <button class="chat-send" id="chatSendBtn" aria-label="Send message">&#10148;</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const toggleBtn = document.getElementById('chatToggleBtn');
  const closeBtn = document.getElementById('chatCloseBtn');
  const clearBtn = document.getElementById('chatClearBtn');
  const panel = document.getElementById('chatPanel');
  const messagesEl = document.getElementById('chatMessages');
  const suggestionsEl = document.getElementById('chatSuggestions');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');

  function scrollToBottom(){
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text){
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    if (role === 'bot') {
      div.innerHTML = renderMarkdown(text);
    } else {
      div.textContent = text;
    }
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function setTyping(on){
    let el = document.getElementById('chatTyping');
    if(on){
      if(!el){
        el = document.createElement('div');
        el.id = 'chatTyping';
        el.className = 'chat-typing';
        el.innerHTML = '<span>Thinking…</span>';
        messagesEl.appendChild(el);
      }
    } else if(el){
      el.remove();
    }
    scrollToBottom();
  }

  function resetChat() {
    state.history = [];
    messagesEl.innerHTML = `<div class="chat-msg bot">${renderMarkdown(WELCOME_MESSAGE)}</div>`;
    suggestionsEl.style.display = 'flex';
    input.value = '';
    scrollToBottom();
  }

  async function sendMessage(text){
    if(!text || !text.trim() || state.sending) return;
    const clean = text.trim();
    suggestionsEl.style.display = 'none';
    addMessage('user', clean);
    state.history.push({ role: 'user', content: clean });
    input.value = '';
    state.sending = true;
    sendBtn.disabled = true;
    setTyping(true);
    try{
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, history: state.history.slice(0, -1) })
      });
      const data = await res.json();
      setTyping(false);
      if(!res.ok){
        addMessage('error', data.error || 'Something went wrong. Please try again.');
      } else {
        addMessage('bot', data.reply);
        state.history.push({ role: 'assistant', content: data.reply });
      }
    }catch(e){
      setTyping(false);
      addMessage('error', 'Could not reach the chat assistant. Check your connection and try again.');
    }
    state.sending = false;
    sendBtn.disabled = false;
    input.focus();
  }

  toggleBtn.addEventListener('click', ()=>{
    state.opened = !state.opened;
    panel.classList.toggle('open', state.opened);
    if(state.opened) input.focus();
  });
  closeBtn.addEventListener('click', ()=>{
    state.opened = false;
    panel.classList.remove('open');
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', resetChat);
  }
  sendBtn.addEventListener('click', ()=> sendMessage(input.value));
  input.addEventListener('keydown', e=>{ if(e.key === 'Enter') sendMessage(input.value); });
  suggestionsEl.querySelectorAll('[data-suggestion]').forEach(btn=>{
    btn.addEventListener('click', ()=> sendMessage(btn.dataset.suggestion));
  });
})();
