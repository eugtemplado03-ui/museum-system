(function(){
  const LANG_DATA = {
    auto: {
      placeholder: 'Ask in English, Tagalog, or Bisaya…',
      welcome: 'Hi! I am **Bata Guide**, your AI assistant for **Museo Sang Bata sa Negros**! Ask me anything in **English**, **Tagalog**, or **Bisaya** about our exhibits, Staff Office under stairs, Touch Pool, ticket prices, or ask me to **translate**!',
      suggestions: [
        'How much are tickets & hours?',
        'Where is the Staff Office?',
        'Tell me about the Touch Pool',
        'What exhibits are on Level 2?',
        'Can I take photos & bring food?',
        'Is there wheelchair access or a ramp?',
        'How do I get here from Bacolod?',
        'Translate museum info to Bisaya',
        'I-translate sa Tagalog'
      ]
    },
    tl: {
      placeholder: 'Magtanong o magpa-translate (Tagalog)…',
      welcome: 'Maligayang pagdating! Ako si **Bata Guide**, ang iyong AI assistant at tagapagsalin sa **Museo Sang Bata sa Negros**. Magtanong ukol sa mga exhibit, Staff Office sa ilalim ng hagdan, Touch Pool, entrance fee, o magpa-translate!',
      suggestions: [
        'Magkano ang ticket at anong oras bukas?',
        'Saan ang Staff Office?',
        'Ikwento mo ang tungkol sa Touch Pool',
        'Ano ang mga exhibit sa Level 2?',
        'Pwede bang kumuha ng litrato at pagkain?',
        'May wheelchair ramp ba ang museo?',
        'Paano pumunta galing Bacolod?',
        'I-translate ito sa Tagalog'
      ]
    },
    bis: {
      placeholder: 'Pangutana o magpa-translate (Bisaya)…',
      welcome: 'Maayong pag-abot! Ako si **Bata Guide**, ang imong AI assistant ug tighubad sa **Museo Sang Bata sa Negros**. Pangutana bahin sa mga exhibit, Staff Office sa ilalom sa hagdanan, Touch Pool, bayad sa ticket, o magpa-translate sa Bisaya!',
      suggestions: [
        'Tagpila ang bayad sa ticket ug unsa oras abli?',
        'Asa dapit ang Staff Office?',
        'Sultihi ko bahin sa Touch Pool',
        'Unsang mga exhibit ang naa sa Level 2?',
        'Pwede ba magkuha og litrato ug pagkaon?',
        'Naa bay access ramp para sa wheelchair?',
        'Unsaon pag-adto gikan sa Bacolod?',
        'I-translate kini sa Bisaya'
      ]
    }
  };

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

  const state = { history: [], sending: false, opened: false, lang: 'auto' };

  const root = document.createElement('div');
  root.innerHTML = `
    <button class="chat-toggle" id="chatToggleBtn" aria-label="Chat with the museum assistant" title="Chat with Bata Guide AI (English / Tagalog / Bisaya)">💬</button>
    <div class="chat-panel" id="chatPanel" role="dialog" aria-label="Museum Assistant Chat">
      <div class="chat-head">
        <div>
          <div class="title"><span class="chat-status-dot"></span> Bata Guide AI</div>
          <div class="subtitle">English • Tagalog • Bisaya</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="chat-head-btn" id="chatClearBtn" title="Reset chat" aria-label="Reset chat">🔄</button>
          <button class="chat-close" id="chatCloseBtn" aria-label="Close chat">✕</button>
        </div>
      </div>
      <div class="chat-lang-bar" id="chatLangBar">
        <button class="chat-lang-btn active" data-lang="auto" title="Automatic detection">🌐 Auto</button>
        <button class="chat-lang-btn" data-lang="tl" title="Mag-usap sa Tagalog">🇵🇭 Tagalog</button>
        <button class="chat-lang-btn" data-lang="bis" title="Mag-istorya sa Bisaya/Hiligaynon">🏝️ Bisaya</button>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-msg bot">${renderMarkdown(LANG_DATA.auto.welcome)}</div>
      </div>
      <div class="chat-suggestions" id="chatSuggestions">
        ${renderChips(LANG_DATA.auto.suggestions)}
      </div>
      <div class="chat-input-row">
        <input type="text" id="chatInput" placeholder="${LANG_DATA.auto.placeholder}" maxlength="600" aria-label="Ask a question">
        <button class="chat-send" id="chatSendBtn" aria-label="Send message">&#10148;</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  function renderChips(suggestions) {
    return suggestions.map(s => `<button class="chat-chip" data-suggestion="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('');
  }

  const toggleBtn = document.getElementById('chatToggleBtn');
  const closeBtn = document.getElementById('chatCloseBtn');
  const clearBtn = document.getElementById('chatClearBtn');
  const panel = document.getElementById('chatPanel');
  const messagesEl = document.getElementById('chatMessages');
  const suggestionsEl = document.getElementById('chatSuggestions');
  const langBarEl = document.getElementById('chatLangBar');
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

  function setLanguage(lang) {
    if (!LANG_DATA[lang]) return;
    state.lang = lang;
    langBarEl.querySelectorAll('.chat-lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
    const config = LANG_DATA[lang];
    input.placeholder = config.placeholder;
    suggestionsEl.innerHTML = renderChips(config.suggestions);
    suggestionsEl.scrollLeft = 0;
    bindChipEvents();

    if (state.history.length === 0) {
      messagesEl.innerHTML = `<div class="chat-msg bot">${renderMarkdown(config.welcome)}</div>`;
    }
  }

  function resetChat() {
    state.history = [];
    const config = LANG_DATA[state.lang] || LANG_DATA.auto;
    messagesEl.innerHTML = `<div class="chat-msg bot">${renderMarkdown(config.welcome)}</div>`;
    suggestionsEl.style.display = 'flex';
    suggestionsEl.innerHTML = renderChips(config.suggestions);
    suggestionsEl.scrollLeft = 0;
    bindChipEvents();
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
        body: JSON.stringify({
          message: clean,
          history: state.history.slice(0, -1),
          language: state.lang
        })
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

  function bindChipEvents() {
    suggestionsEl.querySelectorAll('[data-suggestion]').forEach(btn=>{
      btn.onclick = () => sendMessage(btn.dataset.suggestion);
    });
  }

  langBarEl.querySelectorAll('.chat-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

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
  bindChipEvents();
})();
