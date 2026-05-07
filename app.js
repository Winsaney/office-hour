// ── State ──────────────────────────────────────────────────────────────────
let mode = null;          // 'startup' | 'builder'
let history = [];         // [{role, content}]
let isLoading = false;
let streamingSaveTimer = null;
let streamingPartial = '';  // partial assistant text being streamed
let designDocText = null;
let sessionId = null;

// ── Debug ──────────────────────────────────────────────────────────────────
const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
function log(...args) { if (DEBUG) console.log(...args); }
function logWarn(...args) { if (DEBUG) console.warn(...args); }
function logError(...args) { console.error(...args); }

// API Configuration
let apiProvider = localStorage.getItem('api_provider') || 'claude'; // 'claude' | 'openai'
let apiKey = localStorage.getItem('api_key') || '';
let apiEndpoint = localStorage.getItem('api_endpoint') || '';
let apiModel = localStorage.getItem('api_model') || '';
let useProxy = localStorage.getItem('use_proxy') === 'true';
let lang = localStorage.getItem('app_lang') || 'en'; // 'en' | 'zh'

// ── Supabase ────────────────────────────────────────────────────────────────
const SB_URL = 'https://ncnocticlmavlfwqjyun.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbm9jdGljbG1hdmxmd3FqeXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzE1NDEsImV4cCI6MjA5MzY0NzU0MX0.YR65MjD4141qjKGIeQmAZ13qcLTYfAMNn8oQm5_YvcI';
const sb = window.supabase.createClient(SB_URL, SB_KEY);
let currentUser = null;
let authReady = false; // becomes true after first onAuthStateChange fires

sb.auth.onAuthStateChange(async (event, session) => {
  currentUser = session?.user || null;
  authReady = true;
  log('[Auth]', event, currentUser?.email || 'no user');
  updateAuthUI();
  if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && currentUser)) {
    await mergeLocalToCloud();
    await loadPrefsFromCloud();
    // If history panel is already open, refresh it now that we're authenticated
    if (document.getElementById('historyOverlay')?.classList.contains('open')) {
      renderHistory();
    }
  }
});

// ── i18n ──────────────────────────────────────────────────────────────────
const I18N = {
  en: {
    welcomeTitle: 'What are you<br><span>building?</span>',
    welcomeSub: 'A YC-style partner to pressure-test your idea — not a cheerleader. You\'ll get hard questions, forced alternatives, and a real design doc.',
    apiConfig: '📎 API Configuration',
    providerLabel: 'Provider',
    apiKeyLabel: 'API Key (required)',
    storedLocally: 'Stored locally in your browser.',
    startupTitle: 'Startup Mode',
    startupDesc: 'Six forcing questions. Demand reality. Narrowest wedge. Are you actually solving a problem?',
    builderTitle: 'Builder Mode',
    builderDesc: 'Side project, hackathon, or open source. Find the most exciting version of your idea.',
    ideaLabel: 'Tell me about your <span id="modeLabel">{mode}</span>.',
    ideaPlaceholder: 'Describe what you\'re building — even a rough sentence is fine. Don\'t polish it.',
    startBtn: 'Start Office Hours →',
    sessionProgress: 'Session Progress',
    corePrinciples: 'Core Principles',
    chatPlaceholder: 'Your answer…',
    ready: 'Ready',
    thinking: 'Thinking…',
    done: 'Done ✓',
    inProgress: 'In Progress',
    building: 'Building',
    error: 'Error',
    startupIdea: 'startup idea',
    project: 'project',
    copyDoc: 'Copy Design Doc',
    copied: 'Copied ✓',
    apiKeySaved: 'API Key saved!',
    apiKeyCleared: 'API Key cleared.',
    enterApiKey: 'Enter your {provider} API Key:',
    pleaseEnterKey: 'Please enter your {provider} API Key first',
    langToggle: '中文',
    settingsTitle: '⚙ Settings',
    settingsBtn: '⚙ Settings',
    historyBtn: '🕓 History',
    historyTitle: '🕓 History',
    emptyHistory: 'No past sessions found.',
  },
  zh: {
    welcomeTitle: '你在做<br><span>什么？</span>',
    welcomeSub: '一个 YC 风格的合伙人来考验你的想法——不是啦啦队。你会收到尖锐的问题、被迫思考替代方案，最终得到一份真正的设计文档。',
    apiConfig: '📎 API 配置',
    providerLabel: '服务商',
    apiKeyLabel: 'API Key（必填）',
    storedLocally: '密钥存储在浏览器本地。',
    startupTitle: '创业模式',
    startupDesc: '六个核心问题：需求验证、现状分析、目标用户、最小切入点。你真的在解决问题吗？',
    builderTitle: '创作者模式',
    builderDesc: '个人项目、黑客松或开源项目。找到你想法中最令人兴奋的版本。',
    ideaLabel: '告诉我你的<span id="modeLabel">{mode}</span>。',
    ideaPlaceholder: '描述你在做什么——哪怕只是一句粗略的描述也行。不需要打磨。',
    startBtn: '开始 Office Hours →',
    sessionProgress: '会话进度',
    corePrinciples: '核心原则',
    chatPlaceholder: '你的回答……',
    ready: '就绪',
    thinking: '思考中…',
    done: '完成 ✓',
    inProgress: '进行中',
    building: '构建中',
    error: '出错',
    startupIdea: '创业想法',
    project: '项目',
    copyDoc: '复制设计文档',
    copied: '已复制 ✓',
    apiKeySaved: 'API Key 已保存！',
    apiKeyCleared: 'API Key 已清除。',
    enterApiKey: '请输入你的 {provider} API Key：',
    pleaseEnterKey: '请先输入你的 {provider} API Key',
    langToggle: 'EN',
    settingsTitle: '⚙ 设置',
    settingsBtn: '⚙ 设置',
    historyBtn: '🕓 历史',
    historyTitle: '🕓 历史记录',
    emptyHistory: '暂无历史记录',
  },
};

function t(key) {
  return I18N[lang]?.[key] || I18N['en'][key] || key;
}

function switchLang() {
  lang = lang === 'en' ? 'zh' : 'en';
  localStorage.setItem('app_lang', lang);
  applyLang();
}

function applyLang() {
  // Update toggle button
  document.getElementById('langBtn').textContent = t('langToggle');

  // Update all elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (key === 'ideaLabel') {
      const modeText = mode === 'startup' ? t('startupIdea') : t('project');
      el.innerHTML = val.replace('{mode}', modeText);
    } else {
      el.innerHTML = val;
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  // Update chat input placeholder
  const chatInput = document.getElementById('chatInput');
  if (chatInput) chatInput.placeholder = t('chatPlaceholder');

  // Update badge text if not in a session
  const badge = document.getElementById('phaseBadge');
  if (badge && !mode) badge.textContent = t('ready');

  // Update powered by label
  updateApiProviderUI();
  updateApiKeyButton();
}

// ── API Configuration Management ────────────────────────────────────────────
function saveApiConfig() {
  const provider = document.getElementById('apiProvider')?.value || 'claude';
  const key = document.getElementById('apiKeyInput')?.value?.trim() || '';
  const endpoint = document.getElementById('apiEndpoint')?.value?.trim() || '';
  const model = document.getElementById('apiModel')?.value?.trim() || '';
  const proxy = document.getElementById('useProxy')?.checked || false;

  apiProvider = provider;
  apiKey = key;
  apiEndpoint = endpoint;
  useProxy = proxy;
  apiModel = model;

  localStorage.setItem('api_provider', apiProvider);
  localStorage.setItem('api_key', apiKey);
  localStorage.setItem('api_endpoint', apiEndpoint);
  localStorage.setItem('api_model', apiModel);
  localStorage.setItem('use_proxy', useProxy);

  updateApiProviderUI();
  updateApiKeyButton();

  // Cloud sync (API Key stays local only)
  if (currentUser) {
    sb.from('user_preferences').upsert({
      user_id: currentUser.id,
      api_provider: apiProvider,
      api_endpoint: apiEndpoint,
      api_model: apiModel,
      use_proxy: useProxy,
      preferred_lang: lang,
      updated_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) logWarn('Prefs sync failed:', error.message);
    });
  }
}

function updateApiKeyButton() {
  const btn = document.getElementById('apiKeyBtn');
  if (!btn) return;
  if (apiKey) {
    btn.innerHTML = `✓ ${apiProvider === 'openai' ? 'OpenAI' : 'Claude'}`;
    btn.style.background = 'rgba(74, 154, 106, 0.1)';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
  } else {
    btn.innerHTML = t('settingsBtn');
    btn.style.background = 'rgba(201,147,58,0.08)';
    btn.style.color = 'var(--gold)';
    btn.style.borderColor = 'var(--gold-dim)';
  }
}

function toggleSettings() {
  const overlay = document.getElementById('settingsOverlay');
  overlay.classList.toggle('open');
}

function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('open');
}

// ── Auth Logic ───────────────────────────────────────────────────────────────
function toggleAuthModal() {
  document.getElementById('authOverlay').classList.toggle('open');
  renderAuthContent();
}

function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
}

function renderAuthContent() {
  const el = document.getElementById('authContent');
  if (currentUser) {
    const name = currentUser.user_metadata?.full_name || currentUser.email;
    const avatar = currentUser.user_metadata?.avatar_url;
    el.innerHTML = `
      <div style="text-align:center; padding: 20px 0;">
        ${avatar ? `<img src="${avatar}" style="width:48px;height:48px;border-radius:50%;margin-bottom:12px;">` : ''}
        <div style="color:var(--text); font-size:14px; margin-bottom:4px;">${escapeHtml(name)}</div>
        <div style="color:var(--text-dim); font-size:12px; margin-bottom:20px;">${escapeHtml(currentUser.email)}</div>
        <div style="color:var(--green); font-size:11px; margin-bottom:20px;">✓ Data synced to cloud</div>
        <button class="btn-reset" onclick="handleLogout()" style="width:100%;">Sign Out</button>
      </div>`;
  } else {
    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px; padding: 16px 0;">
        <div style="color:var(--text-dim); font-size:12px; text-align:center; margin-bottom:8px; line-height:1.6;">
          Sign in to sync your sessions across devices.<br>
          No account needed for local use.
        </div>
        <button class="start-btn" onclick="loginGoogle()" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px;">
          <span>Continue with Google</span>
        </button>
        <button class="start-btn" onclick="loginGithub()" style="width:100%; background:var(--surface2); color:var(--text); border:1px solid var(--border);">
          Continue with GitHub
        </button>
      </div>`;
  }
}

async function loginGoogle() {
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
}
async function loginGithub() {
  await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: location.origin + location.pathname } });
}
async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null;
  updateAuthUI();
  closeAuthModal();
}

function updateAuthUI() {
  const btn = document.getElementById('authBtn');
  if (!btn) return;
  if (currentUser) {
    const avatar = currentUser.user_metadata?.avatar_url;
    if (avatar) {
      btn.innerHTML = `<img src="${avatar}" style="width:20px;height:20px;border-radius:50%;">`;
    } else {
      btn.innerHTML = '✓';
      btn.style.color = 'var(--green)';
    }
  } else {
    btn.innerHTML = '👤';
    btn.style.color = '';
  }
}

function updateApiProviderUI() {
  // Show/hide endpoint and model fields based on provider
  const endpointGroup = document.getElementById('endpointGroup');
  const modelGroup = document.getElementById('modelGroup');
  const endpointLabel = document.getElementById('endpointLabel');
  const modelLabel = document.getElementById('modelLabel');
  const helpText = document.getElementById('apiHelpText');

  // Update "Powered by" label in header
  const poweredByLabel = document.getElementById('poweredByLabel');

  if (apiProvider === 'openai') {
    const proxyGroup = document.getElementById('proxyGroup');
    if (endpointGroup) endpointGroup.style.display = 'block';
    if (proxyGroup) proxyGroup.style.display = 'block';
    if (modelGroup) modelGroup.style.display = 'block';
    if (endpointLabel) endpointLabel.textContent = 'API Endpoint (optional)';
    if (modelLabel) modelLabel.textContent = 'Model (optional)';
    if (helpText) {
      helpText.innerHTML = 'Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--gold);">platform.openai.com</a>. Works with any OpenAI-compatible API.';
    }
    if (poweredByLabel) poweredByLabel.textContent = 'Powered by OpenAI';
  } else {
    const proxyGroupHide = document.getElementById('proxyGroup');
    if (endpointGroup) endpointGroup.style.display = 'none';
    if (modelGroup) modelGroup.style.display = 'none';
    if (proxyGroupHide) proxyGroupHide.style.display = 'none';
    if (helpText) {
      helpText.innerHTML = 'Get your key at <a href="https://console.anthropic.com/" target="_blank" style="color: var(--gold);">console.anthropic.com</a>.';
    }
    if (poweredByLabel) poweredByLabel.textContent = 'Powered by Claude';
  }
}

// Initialize API config on page load
document.addEventListener('DOMContentLoaded', () => {
  const providerSelect = document.getElementById('apiProvider');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const endpointInput = document.getElementById('apiEndpoint');
  const modelInput = document.getElementById('apiModel');

  if (providerSelect) providerSelect.value = apiProvider;
  if (apiKeyInput && apiKey) apiKeyInput.value = apiKey;
  if (endpointInput && apiEndpoint) endpointInput.value = apiEndpoint;
  if (modelInput && apiModel) modelInput.value = apiModel;

  const proxyCheckbox = document.getElementById('useProxy');
  if (proxyCheckbox) proxyCheckbox.checked = useProxy;

  applyLang();
  updateApiProviderUI();
  updateApiKeyButton();
  loadSessionState();
});

const STARTUP_PHASES = [
  { id: 'q1', label: 'Q1 — Demand Reality' },
  { id: 'q2', label: 'Q2 — Status Quo' },
  { id: 'q3', label: 'Q3 — Target Human' },
  { id: 'q4', label: 'Q4 — Narrowest Wedge' },
  { id: 'q5', label: 'Q5 — Observation' },
  { id: 'q6', label: 'Q6 — Future-Fit' },
  { id: 'doc', label: 'Design Doc' },
];

const BUILDER_PHASES = [
  { id: 'problem', label: 'Problem + Constraints' },
  { id: 'premises', label: 'Premise Challenge' },
  { id: 'alts',    label: 'Alternatives' },
  { id: 'design',  label: 'Design Doc' },
];

const STARTUP_PRINCIPLES = [
  { title: 'Specificity is currency', text: 'Vague answers get pushed. "Enterprises in healthcare" is not a customer.' },
  { title: 'Interest ≠ demand', text: 'Waitlists, signups, "that\'s interesting" — none of it counts. Behavior counts. Money counts.' },
  { title: 'Status quo is your rival', text: 'Not the other startup — the cobbled-together spreadsheet your user is already living with.' },
  { title: 'Narrow beats wide', text: 'The smallest version someone pays for this week beats the platform vision.' },
  { title: 'Watch, don\'t demo', text: 'Guided tours teach you nothing. Sitting behind someone while they struggle — that teaches everything.' },
];

const BUILDER_PRINCIPLES = [
  { title: 'Delight is currency', text: 'What makes someone say "whoa"? Chase that.' },
  { title: 'Ship something showable', text: 'The best version of anything is the one that exists.' },
  { title: 'Explore before optimizing', text: 'Try the weird idea first. Polish later.' },
  { title: 'Solve your own problem', text: 'If you\'re building it for yourself, trust that instinct.' },
];

// ── System Prompts ─────────────────────────────────────────────────────────
function getSystemPrompt(m, idea) {
  const today = new Date().toISOString().split('T')[0];
  const langInstruction = lang === 'zh'
    ? '\n\nIMPORTANT: Respond entirely in Chinese (简体中文). The user prefers Chinese.\n\n'
    : '\n\n';

  if (m === 'startup') {
    return `You are a YC partner running office hours. The founder's idea: "${idea}"

Today: ${today}. This is a live session — conduct it one question at a time.

YOUR JOB: Pressure-test this idea through six forcing questions. Be direct, not cruel. Push until answers are specific and evidence-based. Comfort means the founder hasn't gone deep enough.

SIX QUESTIONS (ask ONE at a time, wait for response):
Q1 — Demand Reality: Strongest evidence someone would be upset if this disappeared tomorrow? Push for: specific behavior, payments, panic when it breaks. Red flags: "people say it's interesting", waitlist signups.
Q2 — Status Quo: What are users doing RIGHT NOW to solve this, even badly? Push for: specific workflow, hours/dollars wasted. Red flag: "nothing exists, that's the opportunity."
Q3 — Target Human: Name the actual person who needs this most. Title, company, what gets them fired. Push for a name. Red flag: category answers like "SMBs" or "marketing teams."
Q4 — Narrowest Wedge: Smallest version someone pays for THIS WEEK — not after you build the platform. Push for one feature, one workflow. Red flag: "we need to build everything first."
Q5 — Observation: Watched someone use it without helping them? What surprised you? Red flag: "we did demo calls" or "nothing surprised me."
Q6 — Future-Fit: In 3 years, does your product become more essential or less? Push for a specific thesis, not "AI keeps getting better."

STYLE:
- Ask Q1 first, then wait. Don't batch questions.
- After each answer, react genuinely — push back if vague, praise real specificity.
- After Q6, write a DESIGN DOC in this format (use markdown, wrap in triple backticks after a line that says DESIGN_DOC_START):

DESIGN_DOC_START
\`\`\`
# Design: [Product Name]
Generated: ${today}
Mode: Startup

## Problem
[1-2 sentences from the session]

## Target Customer
[specific person identified in Q3]

## Demand Evidence
[from Q1 — what behavior/payment proves it]

## Status Quo
[from Q2 — what they do now]

## Narrowest Wedge
[from Q4 — smallest payable version]

## Future-Fit Thesis
[from Q6]

## What I Noticed About How You Think
[2-3 mentor-like observations — quote founder's words back to them]

## Assignment
[One concrete action — not a strategy, an action]
\`\`\`

Start immediately: ask Q1. Don't introduce yourself at length. Get to work.` + langInstruction;
  }

  return `You are a YC partner running builder office hours. The project: "${idea}"

Today: ${today}. Enthusiastic collaborator mode — help them find the most exciting version of their idea.

YOUR JOB: Four phases, one at a time.

PHASE 1 — Understand: Ask about the core problem they're solving and constraints. What's the "whoa" factor?

PHASE 2 — Premise Challenge: Identify 2-3 premises the project rests on. Challenge at least one — not to discourage, but to stress-test. "What if [assumption] is wrong? What breaks?"

PHASE 3 — Alternatives: Generate 2 distinct approaches. For each: name it, describe it in a sentence, say what it optimizes for and what it sacrifices.

PHASE 4 — Design Doc (after getting answers to the above):

DESIGN_DOC_START
\`\`\`
# Design: [Project Name]
Generated: ${today}
Mode: Builder

## Problem Statement
[what it solves and for whom]

## What Makes This Cool
[the core delight or novelty]

## Constraints
[from the conversation]

## Premises Challenged
[which premise was stress-tested and what we learned]

## Approaches Considered
### Approach A: [name]
[description + trade-offs]
### Approach B: [name]
[description + trade-offs]

## Recommended Approach
[chosen approach with rationale]

## Next Build Steps
[concrete: what to implement first, second, third]

## What I Noticed About How You Think
[2-3 observations — quote their words back]
\`\`\`

STYLE: Be enthusiastic and specific. Riff on ideas. Bring adjacent ideas they might not have considered. Ask one question at a time. Start by asking them to describe what they're building and what would make someone say "whoa" when they first see it.` + langInstruction;
}

// ── UI Helpers ─────────────────────────────────────────────────────────────
function goBack() {
  // If in chat, go back to idea screen; if in idea screen, go to welcome
  const ideaScreen = document.getElementById('ideaScreen');
  const messages = document.getElementById('messages');

  if (messages.style.display !== 'none') {
    // In chat → back to idea screen (keep mode selected)
    messages.style.display = 'none';
    document.getElementById('inputBar').style.display = 'none';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('drawerFab').classList.remove('visible');
    document.getElementById('backBtn').classList.remove('visible');
    document.body.classList.remove('in-session');
    closeDrawer();
    ideaScreen.style.display = 'flex';
    history = [];
    sessionId = null;
    designDocText = null;
    streamingPartial = '';
    if (streamingSaveTimer) { clearInterval(streamingSaveTimer); streamingSaveTimer = null; }
    localStorage.removeItem('office_hours_session');
    setBadge(t('ready'));
  } else if (ideaScreen.style.display !== 'none') {
    // In idea screen → back to welcome
    ideaScreen.style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('backBtn').classList.remove('visible');
    mode = null;
  }
}

function selectMode(m) {
  mode = m;
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('ideaScreen').style.display = 'flex';
  document.getElementById('backBtn').classList.add('visible');
  document.getElementById('modeLabel').textContent = m === 'startup' ? t('startupIdea') : t('project');
}

function setupSidebar() {
  const phases = mode === 'startup' ? STARTUP_PHASES : BUILDER_PHASES;
  const principles = mode === 'startup' ? STARTUP_PRINCIPLES : BUILDER_PRINCIPLES;

  const pl = document.getElementById('progressList');
  pl.innerHTML = phases.map((p, i) =>
    `<div class="progress-item ${i === 0 ? 'active' : ''}" id="phase_${p.id}">
      <div class="pip"></div>
      <span>${p.label}</span>
    </div>`
  ).join('');

  const prl = document.getElementById('principlesList');
  prl.innerHTML = `<div class="sidebar-label" data-i18n="corePrinciples">${t('corePrinciples')}</div>` +
    principles.map(p =>
      `<div class="principle">
        <div class="p-title">${p.title}</div>
        ${p.text}
      </div>`
    ).join('');

  // Show mobile drawer FAB
  document.getElementById('drawerFab').classList.add('visible');
  updateDrawerFab();
}

function updatePhase(phaseId) {
  const phases = mode === 'startup' ? STARTUP_PHASES : BUILDER_PHASES;
  phases.forEach(p => {
    const el = document.getElementById('phase_' + p.id);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (p.id === phaseId) el.classList.add('active');
    else if (phases.findIndex(x => x.id === p.id) < phases.findIndex(x => x.id === phaseId)) {
      el.classList.add('done');
    }
  });
  updateDrawerFab();
}

function highlightPrinciple(text) {
  const principles = mode === 'startup' ? STARTUP_PRINCIPLES : BUILDER_PRINCIPLES;
  const items = document.querySelectorAll('.principle');
  items.forEach((el, i) => {
    el.classList.remove('highlight');
    if (text && principles[i] && text.toLowerCase().includes(principles[i].title.toLowerCase().split(' ')[0])) {
      el.classList.add('highlight');
    }
  });
}

function setBadge(text) {
  document.getElementById('phaseBadge').textContent = text;
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 6000);
}

// ── Message Rendering ──────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  if (text.includes('DESIGN_DOC_START')) {
    const parts = text.split('DESIGN_DOC_START');
    const beforeDoc = parts[0] || '';
    const docPart = parts[1] || '';
    const match = docPart.match(/```[\w]*\n?([\s\S]*?)(```|$)/);
    const docContent = match ? match[1].trim() : docPart.trim();
    
    if (docContent.length > 50) {
      designDocText = docContent;
      updatePhase('doc');
      setBadge(t('done'));
    }

    return `<div class="md-content">${marked.parse(beforeDoc.trim())}</div>
      <div class="design-doc">${escapeHtml(docContent)}</div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="copy-btn" onclick="copyDoc()">${t('copyDoc')}</button>
        <button class="copy-btn" onclick="downloadDoc()">Download .md</button>
      </div>`;
  }

  return marked.parse(text);
}

function parseInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function appendMessage(role, content) {
  const msgs = document.getElementById('messages');
  const isUser = role === 'user';

  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const initials = isUser ? 'You' : 'YC';
  div.innerHTML = `
    <div class="avatar ${isUser ? 'human' : 'yc'}">${initials}</div>
    <div class="bubble">${isUser ? parseInline(escapeHtml(content)) : renderMarkdown(content)}</div>
  `;

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;

  // Auto-detect phase from content
  if (!isUser) detectPhase(content);
}

function detectPhase(text) {
  const t = text.toLowerCase();
  if (mode === 'startup') {
    if (t.includes('strongest evidence') || t.includes('demand reality') || t.includes('upset if it disappeared')) updatePhase('q1');
    else if (t.includes('doing right now') || t.includes('status quo') || t.includes('workaround')) updatePhase('q2');
    else if (t.includes('actual human') || t.includes('title') || t.includes('who needs this most')) updatePhase('q3');
    else if (t.includes('smallest possible') || t.includes('narrowest') || t.includes('this week')) updatePhase('q4');
    else if (t.includes('watched someone') || t.includes('surprised you') || t.includes('observation')) updatePhase('q5');
    else if (t.includes('3 years') || t.includes('future') || t.includes('more essential')) updatePhase('q6');
  } else {
    if (t.includes('problem') || t.includes('constraint') || t.includes('whoa')) updatePhase('problem');
    else if (t.includes('premise') || t.includes('assumption') || t.includes('what if')) updatePhase('premises');
    else if (t.includes('approach') || t.includes('alternative')) updatePhase('alts');
  }
  highlightPrinciple(text);
}

// Typing indicator replaced by streaming text

function copyDoc() {
  if (designDocText) {
    navigator.clipboard.writeText(designDocText).then(() => {
      const btn = document.querySelector('.copy-btn');
      if (btn) { btn.textContent = t('copied'); setTimeout(() => btn.textContent = t('copyDoc'), 2000); }
    });
  }
}

function downloadDoc() {
  if (!designDocText) return;
  const blob = new Blob([designDocText], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `design-doc-${new Date().toISOString().slice(0,10)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Session Management ─────────────────────────────────────────────────────
async function startSession() {
  const idea = document.getElementById('ideaInput').value.trim();
  if (!idea) return;
  if (!apiKey) {
    showError(t('pleaseEnterKey').replace('{provider}', apiProvider === 'openai' ? 'OpenAI' : 'Claude'));
    toggleSettings();
    return;
  }

  document.getElementById('ideaScreen').style.display = 'none';
  document.getElementById('messages').style.display = 'flex';
  document.getElementById('inputBar').style.display = 'flex';
  document.getElementById('sidebar').style.display = 'flex';
  document.body.classList.add('in-session');

  setupSidebar();
  setBadge(mode === 'startup' ? 'Q1 / 6' : (lang === 'zh' ? '阶段 1' : 'Phase 1'));

  const systemPrompt = getSystemPrompt(mode, idea);

  history = [];
  history.push({ role: 'user', content: `My idea: ${idea}` });
  await saveSessionState();

  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `msg assistant`;
  div.innerHTML = `<div class="avatar yc">YC</div><div class="bubble streaming"></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;

  const onChunk = (text) => {
    streamingPartial = text;
    div.querySelector('.bubble').innerHTML = renderMarkdown(text);
    msgs.scrollTop = msgs.scrollHeight;
  };

  streamingPartial = '';
  streamingSaveTimer = setInterval(() => {
    if (streamingPartial) saveStreamingState();
  }, 3000);

  try {
    const reply = await callAPI(systemPrompt, history, onChunk);
    clearInterval(streamingSaveTimer);
    streamingSaveTimer = null;
    streamingPartial = '';
    div.querySelector('.bubble').innerHTML = renderMarkdown(reply);
    div.querySelector('.bubble').classList.remove('streaming');
    history.push({ role: 'assistant', content: reply });
    detectPhase(reply);
    await saveSessionState();
    setBadge(mode === 'startup' ? 'Q1 / 6' : (lang === 'zh' ? '阶段 1' : 'Phase 1'));
    document.getElementById('chatInput').focus();
  } catch (e) {
    clearInterval(streamingSaveTimer);
    streamingSaveTimer = null;
    if (streamingPartial) {
      history.push({ role: 'assistant', content: streamingPartial });
      streamingPartial = '';
      div.querySelector('.bubble').innerHTML = renderMarkdown(history[history.length - 1].content);
      div.querySelector('.bubble').classList.remove('streaming');
      await saveSessionState();
      showError('Stream interrupted. Partial reply saved.');
    } else {
      div.remove();
      showError('API error: ' + e.message);
    }
    setBadge(t('error'));
  }
}

async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  history.push({ role: 'user', content: text });
  await saveSessionState();
  appendMessage('user', text);

  const systemPrompt = getSystemPrompt(mode, '');
  isLoading = true;
  document.getElementById('sendBtn').disabled = true;

  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `msg assistant`;
  div.innerHTML = `<div class="avatar yc">YC</div><div class="bubble streaming">...</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;

  const onChunk = (tChunk) => {
    streamingPartial = tChunk;
    div.querySelector('.bubble').innerHTML = renderMarkdown(tChunk);
    msgs.scrollTop = msgs.scrollHeight;
  };

  streamingPartial = '';
  streamingSaveTimer = setInterval(() => {
    if (streamingPartial) saveStreamingState();
  }, 3000);

  try {
    const reply = await callAPI(systemPrompt, history, onChunk);
    clearInterval(streamingSaveTimer);
    streamingSaveTimer = null;
    streamingPartial = '';
    div.querySelector('.bubble').innerHTML = renderMarkdown(reply);
    div.querySelector('.bubble').classList.remove('streaming');
    history.push({ role: 'assistant', content: reply });
    detectPhase(reply);
    await saveSessionState();
    setBadge(designDocText ? t('done') : (mode === 'startup' ? t('inProgress') : t('building')));
  } catch (e) {
    clearInterval(streamingSaveTimer);
    streamingSaveTimer = null;
    if (streamingPartial) {
      history.push({ role: 'assistant', content: streamingPartial });
      streamingPartial = '';
      div.querySelector('.bubble').innerHTML = renderMarkdown(history[history.length - 1].content);
      div.querySelector('.bubble').classList.remove('streaming');
      await saveSessionState();
      showError('Stream interrupted. Partial reply saved.');
    } else {
      div.remove();
      showError('API error: ' + e.message);
    }
    setBadge(t('error'));
  } finally {
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('chatInput').focus();
  }
}

async function callAPI(system, messages, onChunk) {
  if (!apiKey) {
    throw new Error('Please set your API Key first');
  }

  if (apiProvider === 'openai') {
    const endpoint = apiEndpoint || 'https://api.openai.com/v1/chat/completions';
    const model = apiModel || 'gpt-4o';
    const openaiMessages = [
      { role: 'system', content: system },
      ...messages
    ];

    const payload = {
      model,
      messages: openaiMessages,
      max_tokens: 4000,
      temperature: 0.7,
      stream: true,
    };

    let response;
    try {
      if (useProxy) {
        response = await fetch('http://localhost:3456/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint,
            headers: { 'Authorization': `Bearer ${apiKey}` },
            payload,
          }),
        });
      } else {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });
      }
    } catch (networkError) {
      if (useProxy) throw new Error('Cannot connect to local proxy (localhost:3456). Make sure to run: node proxy.js (无法连接本地代理，请先运行 node proxy.js)');
      throw new Error('Network error — browser may be blocked by CORS. Enable "Use Local CORS Proxy" and run node proxy.js. (网络错误：请启用本地代理并运行 node proxy.js)');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || '';
      if (response.status === 401) throw new Error('API Key invalid or expired. Please check your key. (API Key 无效或已过期，请检查)');
      if (response.status === 429) throw new Error('Rate limited — please wait a moment and try again. (请求过于频繁，请稍后重试)');
      if (response.status === 404) throw new Error(`Model "${model}" not found or endpoint incorrect. (模型不存在或 endpoint 地址有误)`);
      throw new Error(msg || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial line in buffer

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              fullText += data.choices[0].delta.content;
              if (onChunk) onChunk(fullText);
            }
          } catch(e) {}
        }
      }
    }
    return fullText;
  } else {
    // Claude API
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          temperature: 0.7,
          system,
          messages,
          stream: true,
        }),
      });
    } catch (networkError) {
      throw new Error('Network error — browser may be blocked by CORS. (网络错误：浏览器可能受 CORS 限制)');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || '';
      if (response.status === 401) throw new Error('API Key invalid or expired. Please check your Claude key. (API Key 无效或已过期)');
      if (response.status === 429) throw new Error('Rate limited — please wait and try again. (请求过于频繁，请稍后重试)');
      throw new Error(msg || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop();

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('data: ')) {
          try {
             // For Anthropic API streaming format, text arrives in content_block_delta
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              fullText += data.delta.text;
              if (onChunk) onChunk(fullText);
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  }
}

// ── History Management ────────────────────────────────────────────────────
function openHistory() {
  document.getElementById('historyOverlay').classList.add('open');
  if (!authReady) {
    // Auth state not yet resolved — show loading, then re-render when ready
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="empty-history" style="opacity:0.5">Loading…</div>';
    // Poll until authReady (max ~3s)
    let attempts = 0;
    const waitForAuth = setInterval(() => {
      attempts++;
      if (authReady || attempts > 15) {
        clearInterval(waitForAuth);
        renderHistory();
      }
    }, 200);
  } else {
    renderHistory();
  }
}

function closeHistory() {
  document.getElementById('historyOverlay').classList.remove('open');
}

async function renderHistory() {
  const list = document.getElementById('historyList');
  const histArr = await getHistoryList();

  if (histArr.length === 0) {
    list.innerHTML = `<div class="empty-history">${t('emptyHistory')}</div>`;
    return;
  }

  list.innerHTML = histArr.map(s => {
    const dateStr = new Date(s.timestamp || Date.now()).toLocaleDateString() + ' ' + new Date(s.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const ideaText = s.history[0]?.content.replace('My idea: ', '') || 'Workspace...';
    let modeText = '';
    if (lang === 'zh') modeText = s.mode === 'startup' ? '创业' : '创作者';
    else modeText = s.mode === 'startup' ? 'Startup' : 'Builder';

    return `
      <div class="history-item" onclick="loadHistorySession('${s.id}')">
        <div class="history-item-header">
          <span class="history-item-mode">${modeText}</span>
          <span class="history-item-date">${dateStr}</span>
        </div>
        <div class="history-item-idea">${escapeHtml(ideaText)}</div>
        <button class="btn-delete-hist" onclick="event.stopPropagation(); deleteHistorySession('${s.id}')">×</button>
      </div>
    `;
  }).join('');
}

async function deleteHistorySession(id) {
  if (currentUser) {
    await sb.from('sessions').delete().eq('id', id).eq('user_id', currentUser.id);
  }
  let histArr = [];
  try { histArr = JSON.parse(localStorage.getItem('office_hours_history') || '[]'); } catch {}
  histArr = histArr.filter(s => s.id !== id);
  localStorage.setItem('office_hours_history', JSON.stringify(histArr));
  if (sessionId === id) resetSession();
  renderHistory();
}

async function loadHistorySession(id) {
  let saved = null;
  if (currentUser) {
    const { data, error } = await sb.from('sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) {
      logError('[Cloud] Failed to load session:', error.message);
    } else if (data) {
      log('[Cloud] Loaded session from cloud:', id);
      saved = { id: data.id, mode: data.mode, history: data.history, designDocText: data.design_doc, timestamp: new Date(data.updated_at).getTime() };
    } else {
      logWarn('[Cloud] Session not found in cloud:', id);
    }
  }
  if (!saved) {
    let histArr = [];
    try { histArr = JSON.parse(localStorage.getItem('office_hours_history') || '[]'); } catch {}
    saved = histArr.find(s => s.id === id);
  }
  if (saved) {
    localStorage.setItem('office_hours_session', JSON.stringify(saved));
    closeHistory();
    loadSessionState();
  } else {
    logError('[Load] Session not found anywhere:', id);
  }
}

// ── Session Persistence ───────────────────────────────────────────────────
function updateLocalHistory(state) {
  let histArr = [];
  try { histArr = JSON.parse(localStorage.getItem('office_hours_history') || '[]'); } catch {}
  const idx = histArr.findIndex(s => s.id === state.id);
  if (idx >= 0) histArr[idx] = state;
  else histArr.unshift(state);
  histArr = histArr.slice(0, 50);
  localStorage.setItem('office_hours_history', JSON.stringify(histArr));
}

function saveStreamingState() {
  if (!sessionId || !streamingPartial) return;
  const hist = [...history, { role: 'assistant', content: streamingPartial }];
  const state = { id: sessionId, mode, history: hist, designDocText, timestamp: Date.now(), streaming: true };
  localStorage.setItem('office_hours_session', JSON.stringify(state));
  updateLocalHistory(state);
}

async function saveSessionState() {
  if (!sessionId) sessionId = Date.now().toString();
  const state = { id: sessionId, mode, history, designDocText, timestamp: Date.now() };

  localStorage.setItem('office_hours_session', JSON.stringify(state));
  updateLocalHistory(state);

  if (currentUser) {
    await sb.from('sessions').upsert({
      id: sessionId,
      user_id: currentUser.id,
      mode,
      history,
      design_doc: designDocText,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id,user_id' }).then(({ error }) => {
      if (error) logWarn('Cloud save failed:', error.message);
    });
  }
}

async function getHistoryList() {
  if (currentUser) {
    const { data, error } = await sb.from('sessions')
      .select('id, mode, history, design_doc, created_at, updated_at')
      .eq('user_id', currentUser.id)  // ✅ filter by current user
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) {
      logError('[Cloud] Failed to load history:', error.message);
    } else if (data) {
      log('[Cloud] Loaded', data.length, 'sessions from cloud');
      return data.map(s => ({
        id: s.id,
        mode: s.mode,
        history: s.history,
        designDocText: s.design_doc,
        timestamp: new Date(s.updated_at).getTime(),
      }));
    }
  }
  try { return JSON.parse(localStorage.getItem('office_hours_history') || '[]'); } catch { return []; }
}

function loadSessionState() {
  const saved = localStorage.getItem('office_hours_session');
  if (saved) {
    try {
      const state = JSON.parse(saved);
      if (state.mode && state.history && state.history.length > 0) {
        sessionId = state.id || Date.now().toString();
        mode = state.mode;
        history = state.history;
        designDocText = state.designDocText || null;

        // Detect interrupted stream: last message is from user with no assistant reply
        const wasStreaming = state.streaming === true;
        const lastMsg = history[history.length - 1];
        if (wasStreaming && lastMsg && lastMsg.role === 'user') {
          history.pop(); // remove the dangling user message re-sent during streaming
        }

        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('ideaScreen').style.display = 'none';
        document.getElementById('messages').style.display = 'flex';
        document.getElementById('inputBar').style.display = 'flex';
        document.getElementById('sidebar').style.display = 'flex';
        document.getElementById('backBtn').classList.add('visible');
        document.body.classList.add('in-session');

        setupSidebar();

        document.getElementById('messages').innerHTML = '';
        history.forEach(m => {
          if (m.role === 'user' || m.role === 'assistant') {
            appendMessage(m.role, m.content);
          }
        });

        // Show recovery notice if last reply was incomplete
        if (wasStreaming) {
          const notice = document.createElement('div');
          notice.className = 'error-msg';
          notice.style.background = 'rgba(201,147,58,0.08)';
          notice.style.borderColor = 'rgba(201,147,58,0.2)';
          notice.style.color = 'var(--gold)';
          notice.innerHTML = '⚠ Last reply was interrupted. Partial content has been saved above. You can continue the conversation.';
          document.getElementById('messages').prepend(notice);
          // Clear the streaming flag
          localStorage.setItem('office_hours_session', JSON.stringify({ ...state, streaming: false }));
        }

        setBadge(designDocText ? t('done') : (mode === 'startup' ? t('inProgress') : t('building')));
        return true;
      }
    } catch(e) {}
  }
  return false;
}

function resetSession() {
  mode = null;
  history = [];
  designDocText = null;
  sessionId = null;
  isLoading = false;
  streamingPartial = '';
  if (streamingSaveTimer) { clearInterval(streamingSaveTimer); streamingSaveTimer = null; }
  localStorage.removeItem('office_hours_session');
  document.body.classList.remove('in-session');

  document.getElementById('welcomeScreen').style.display = 'flex';
  document.getElementById('ideaScreen').style.display = 'none';
  document.getElementById('messages').style.display = 'none';
  document.getElementById('inputBar').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('errorMsg').style.display = 'none';
  document.getElementById('messages').innerHTML = '';
  document.getElementById('ideaInput').value = '';
  document.getElementById('chatInput').value = '';

  // Restore API config inputs
  const apiKeyInput = document.getElementById('apiKeyInput');
  const endpointInput = document.getElementById('apiEndpoint');
  const modelInput = document.getElementById('apiModel');
  if (apiKeyInput) apiKeyInput.value = apiKey;
  if (endpointInput) endpointInput.value = apiEndpoint;
  if (modelInput) modelInput.value = apiModel;

  setBadge(t('ready'));
}

// ── First-Login Merge + Preferences Sync ────────────────────────────────────
async function mergeLocalToCloud() {
  let localSessions = [];
  try { localSessions = JSON.parse(localStorage.getItem('office_hours_history') || '[]'); } catch {}
  if (localSessions.length === 0) { log('[Merge] No local sessions to merge'); return; }

  log('[Merge] Found', localSessions.length, 'local sessions, checking cloud...');
  const { data: cloudSessions, error: fetchErr } = await sb.from('sessions').select('id');
  if (fetchErr) { logError('[Merge] Failed to fetch cloud sessions:', fetchErr.message); return; }

  const cloudIds = new Set((cloudSessions || []).map(s => s.id));
  const toUpload = localSessions.filter(s => !cloudIds.has(s.id));
  if (toUpload.length === 0) { log('[Merge] All local sessions already in cloud'); return; }

  const rows = toUpload.map(s => ({
    id: s.id,
    user_id: currentUser.id,
    mode: s.mode,
    history: s.history,
    design_doc: s.designDocText || null,
    created_at: new Date(s.timestamp).toISOString(),
    updated_at: new Date(s.timestamp).toISOString(),
  }));

  log('[Merge] Uploading', rows.length, 'sessions to cloud...');
  const { error: insertErr } = await sb.from('sessions').insert(rows);
  if (insertErr) logError('[Merge] Upload failed:', insertErr.message);
  else log('[Merge] Upload successful!');
}

async function loadPrefsFromCloud() {
  if (!currentUser) return;
  const { data } = await sb.from('user_preferences').select('*').single();
  if (!data) return;

  apiProvider = data.api_provider || apiProvider;
  apiEndpoint = data.api_endpoint || apiEndpoint;
  apiModel = data.api_model || apiModel;
  useProxy = data.use_proxy ?? useProxy;
  lang = data.preferred_lang || lang;

  localStorage.setItem('api_provider', apiProvider);
  localStorage.setItem('api_endpoint', apiEndpoint);
  localStorage.setItem('api_model', apiModel);
  localStorage.setItem('use_proxy', useProxy);
  localStorage.setItem('app_lang', lang);

  const providerSelect = document.getElementById('apiProvider');
  const endpointInput = document.getElementById('apiEndpoint');
  const modelInput = document.getElementById('apiModel');
  const proxyCheckbox = document.getElementById('useProxy');
  if (providerSelect) providerSelect.value = apiProvider;
  if (endpointInput) endpointInput.value = apiEndpoint;
  if (modelInput) modelInput.value = apiModel;
  if (proxyCheckbox) proxyCheckbox.checked = useProxy;
  applyLang();
}

// ── Mobile Drawer ──────────────────────────────────────────────────────────
function toggleDrawer() {
  const overlay = document.getElementById('drawerOverlay');
  const sheet = document.getElementById('drawerSheet');
  const isOpen = sheet.classList.contains('open');
  if (isOpen) {
    closeDrawer();
  } else {
    // Populate drawer with sidebar content
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('drawerContent');
    if (sidebar && content) content.innerHTML = sidebar.innerHTML;
    overlay.classList.add('open');
    sheet.classList.add('open');
  }
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('drawerSheet').classList.remove('open');
}

function updateDrawerFab() {
  const fab = document.getElementById('drawerFab');
  if (!fab) return;
  const phases = mode === 'startup' ? STARTUP_PHASES : BUILDER_PHASES;
  const active = document.querySelector('.progress-item.active .pip');
  if (active) {
    const activeItem = active.closest('.progress-item');
    const label = activeItem ? activeItem.querySelector('span').textContent : '';
    // Extract short label like "Q1" or phase number
    fab.textContent = label.split('—')[0].trim().split(' ')[0] || '?';
  }
}

function handleKey(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}
