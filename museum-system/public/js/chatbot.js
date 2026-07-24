(function(){
  const SUGGESTIONS = [
    "What's there to see with a 6-year-old?",
    'How much are tickets?',
    "What time do you close today?",
    'Tell me about the Splash Zone'
  ];

  function escapeHtml(str){
    return String(str==null?'':str).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  const state = { history: [], sending: false, opened: false };

  const root = document.createElement('div');
  root.innerHTML = `
    <button class="chat-toggle" id="chatToggleBtn" aria-label="Chat with the museum assistant">💬</button>
    <div class="chat-panel" id="chatPanel">
      <div class="chat-head">
        <div>
          <div class="title">Ask about the museum</div>
          <div class="subtitle">Exhibits, hours &amp; visiting info</div>
        </div>
        <button class="chat-close" id="chatCloseBtn" aria-label="Close chat">✕</button>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-msg bot">Hi! I can answer questions about Museo Sang Bata sa Negros — exhibits, hours, fees, and planning your visit. What would you like to know?</div>
      </div>
      <div class="chat-suggestions" id="chatSuggestions">
        ${SUGGESTIONS.map(s => `<button class="chat-chip" data-suggestion="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
      </div>
      <div class="chat-input-row">
        <input type="text" id="chatInput" placeholder="Ask a question…" maxlength="600">
        <button class="chat-send" id="chatSendBtn" aria-label="Send">&#10148;</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const toggleBtn = document.getElementById('chatToggleBtn');
  const closeBtn = document.getElementById('chatCloseBtn');
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
    div.textContent = text;
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
        el.textContent = 'Thinking…';
        messagesEl.appendChild(el);
      }
    } else if(el){
      el.remove();
    }
    scrollToBottom();
  }

  async function sendMessage(text){
    if(!text.trim() || state.sending) return;
    suggestionsEl.style.display = 'none';
    addMessage('user', text);
    state.history.push({ role: 'user', content: text });
    input.value = '';
    state.sending = true;
    sendBtn.disabled = true;
    setTyping(true);
    try{
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: state.history.slice(0, -1) })
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
  sendBtn.addEventListener('click', ()=> sendMessage(input.value));
  input.addEventListener('keydown', e=>{ if(e.key === 'Enter') sendMessage(input.value); });
  suggestionsEl.querySelectorAll('[data-suggestion]').forEach(btn=>{
    btn.addEventListener('click', ()=> sendMessage(btn.dataset.suggestion));
  });
})();
