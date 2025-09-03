// Exact-style chat replication (structure & behavior) based on transcript chat
const API_ROOT = 'https://api.youtubetranscriptgen.com';
function resolveEndpoint(){ const p=new URLSearchParams(window.location.search); if(p.get('local')==='1') return 'http://127.0.0.1:8000/api/chat_personal_info'; return API_ROOT + '/api/chat_personal_info'; }

let conversationHistory = []; // in-memory only
let currentResponseId = null;
let isSending = false;
let autoScrollEnabled = true; // disabled when user scrolls up
let streamingActive = false;

function qs(sel){ return document.querySelector(sel); }
function atBottom(el, thresh=10){ if(!el) return true; return (el.scrollHeight - el.scrollTop - el.clientHeight) <= thresh; }

function addMessageToDOM(role, content){
  const container = qs('#chat-messages'); if(!container) return null;
  const wrapper = document.createElement('div');
  wrapper.className = role==='user' ? 'user-message' : 'ai-message';
  const avatar = document.createElement('div');
  avatar.className = role==='user' ? 'user-avatar' : 'ai-avatar';
  avatar.textContent = role==='user' ? '👤' : '🤖';
  const mc = document.createElement('div'); mc.className='message-content';
  const mt = document.createElement('div'); mt.className='message-text';
  if(role==='ai'){
    try { mt.innerHTML = window.marked ? marked.parse(content) : content; } catch { mt.textContent = content; }
  } else { mt.textContent = content; }
  mc.appendChild(mt);
  if(role==='user'){ wrapper.appendChild(mc); wrapper.appendChild(avatar); } else { wrapper.appendChild(avatar); wrapper.appendChild(mc); }
  container.appendChild(wrapper);
  if(role==='user'){ autoScrollEnabled = true; }
  if(autoScrollEnabled) container.scrollTop = container.scrollHeight;
  return mt; // bubble reference for streaming
}

function showTyping(){ if(qs('#ai-typing-indicator')) return; const container=qs('#chat-messages'); if(!container) return; const el=document.createElement('div'); el.className='ai-typing-message'; el.id='ai-typing-indicator'; el.innerHTML=`<div class="ai-avatar">🤖</div><div class="message-content"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>`; container.appendChild(el); if(autoScrollEnabled) container.scrollTop=container.scrollHeight; }
function hideTyping(){ const t=qs('#ai-typing-indicator'); if(t) t.remove(); }

// Textarea auto-resize & vertical centering identical logic to transcript variant
function resizeAndCenter(){ const ta=qs('#chat-input'); const send=qs('#send-button'); if(!ta) return; requestAnimationFrame(()=>{ const cs=getComputedStyle(ta); const FALLBACK=46; let baseMin=parseFloat(ta.dataset.baseMinH||''); if(!Number.isFinite(baseMin)){ const inlineH=ta.style.height && ta.style.height!=='auto' && ta.style.height!==''; baseMin = inlineH?FALLBACK:(parseFloat(cs.height)||FALLBACK); if(!Number.isFinite(baseMin)||baseMin>FALLBACK*1.5) baseMin=FALLBACK; ta.dataset.baseMinH=String(baseMin);} else { if(baseMin>FALLBACK*1.5||baseMin<30){ baseMin=FALLBACK; ta.dataset.baseMinH=String(baseMin);} } const minH=Math.max(40,Math.round(baseMin)); const maxH=160; if(!ta.dataset.basePt||!ta.dataset.basePb){ ta.dataset.basePt=String(parseFloat(cs.paddingTop)||12); ta.dataset.basePb=String(parseFloat(cs.paddingBottom)||12);} const basePT=parseFloat(ta.dataset.basePt)||12; const basePB=parseFloat(ta.dataset.basePb)||12; ta.style.paddingTop=basePT+'px'; ta.style.paddingBottom=basePB+'px'; ta.style.height='auto'; const sh=ta.scrollHeight; const contentH=Math.max(0, sh - basePT - basePB); if(contentH + basePT + basePB <= minH){ const extra=minH - (contentH + basePT + basePB); const add=Math.max(0, Math.floor(extra/2)); ta.style.height=minH+'px'; ta.style.paddingTop=(basePT+add)+'px'; ta.style.paddingBottom=(basePB+add)+'px'; ta.style.overflowY='hidden'; } else { const desired = contentH + basePT + basePB; const target = Math.min(maxH, desired); ta.style.height=target+'px'; ta.style.paddingTop=basePT+'px'; ta.style.paddingBottom=basePB+'px'; if(desired>maxH){ ta.style.overflowY='auto'; ta.scrollTop=ta.scrollHeight; } else { ta.style.overflowY='hidden'; } } if(send) send.disabled = ta.value.trim()===''; }); }

async function sendMessage(){
  if(isSending) return;
  const ta=qs('#chat-input'); const send=qs('#send-button'); const container=qs('#chat-messages');
  if(!ta||!send||!container) return; const text=ta.value.trim(); if(!text) return;
  isSending=true; send.disabled=true; ta.disabled=true;
  addMessageToDOM('user', text); conversationHistory.push({role:'user', content:text});
  ta.value=''; resizeAndCenter(); showTyping(); streamingActive=true;
  try {
    const endpoint=resolveEndpoint();
    const resp=await fetch(endpoint,{ method:'POST', headers:{'Content-Type':'application/json','Accept':'text/event-stream'}, body:JSON.stringify({ message:text, conversation_history:conversationHistory, previous_response_id: currentResponseId, model_lvl:'ultra' }) });
    if(!resp.ok){ hideTyping(); streamingActive=false; addMessageToDOM('ai', resp.status===405? '405 Method Not Allowed (production endpoint not yet deployed).':'Error: '+resp.status); return; }
    const reader=resp.body.getReader(); const decoder=new TextDecoder(); let aiBubble=null; let buffer=''; let started=false; let lastScrollAdjust=0;
    while(true){
      const {done,value}=await reader.read(); if(done) break;
      const chunk=decoder.decode(value);
      if(chunk.startsWith('__RESPONSE_ID__:')){ currentResponseId = chunk.split(':')[1].trim(); continue; }
      if(!started && chunk.trim()){ hideTyping(); aiBubble = addMessageToDOM('ai',''); started=true; }
      if(aiBubble){ buffer += chunk; try { aiBubble.innerHTML = window.marked ? marked.parse(buffer) : buffer; } catch { aiBubble.textContent = buffer; }
        // Throttle scroll adjustments for performance
        const now=performance.now();
        if(autoScrollEnabled && now - lastScrollAdjust > 30){ container.scrollTop = container.scrollHeight; lastScrollAdjust=now; }
      }
    }
    hideTyping(); streamingActive=false;
    if(!started){ addMessageToDOM('ai','(no response)'); }
    else if(autoScrollEnabled){ container.scrollTop = container.scrollHeight; }
    conversationHistory.push({role:'assistant', content:buffer});
  } catch(err){ hideTyping(); streamingActive=false; addMessageToDOM('ai','Request failed. Please retry.'); }
  finally { isSending=false; ta.disabled=false; resizeAndCenter(); ta.focus(); }
}

function initChat(){ const ta=qs('#chat-input'); const send=qs('#send-button'); const msgs=qs('#chat-messages'); if(!ta||!send||!msgs) return; const starter = "Hi! I'm Luca's AI assistant. I can answer questions about his background, projects, skills, and interests. Ask anything."; addMessageToDOM('ai', starter); conversationHistory.push({role:'assistant', content:starter}); msgs.addEventListener('scroll', ()=>{ const wasAuto=autoScrollEnabled; autoScrollEnabled = atBottom(msgs); if(streamingActive && autoScrollEnabled && !wasAuto){ msgs.scrollTop = msgs.scrollHeight; } }); ['input','paste','cut','keyup','change'].forEach(ev=> ta.addEventListener(ev, resizeAndCenter)); ta.addEventListener('keydown', e=>{ if(e.key==='Enter'){ if(e.shiftKey){ return; } e.preventDefault(); sendMessage(); }}); send.addEventListener('click', sendMessage); const clear=document.querySelector('.clear-chat-btn'); if(clear) clear.addEventListener('click', ()=>{ if(isSending) return; const intro=conversationHistory.find(m=>m.role==='assistant'); conversationHistory = intro? [intro]:[]; currentResponseId=null; msgs.innerHTML=''; if(intro) addMessageToDOM('ai', intro.content); }); resizeAndCenter(); }

document.addEventListener('DOMContentLoaded', initChat);
