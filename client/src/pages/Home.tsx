import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Command,
  Cpu,
  Database,
  Github,
  Globe2,
  Headphones,
  Inbox,
  KeyRound,
  Layers3,
  Linkedin,
  LockKeyhole,
  Mail,
  Mic,
  MoreHorizontal,
  Network,
  Play,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Unplug,
  Video,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type LogKind = "user" | "system" | "info" | "success" | "wait" | "error";
type View = "Command center" | "Connections" | "Approvals" | "Activity";
type ConnectionStatus = "Connected" | "Ready";

type LogEntry = {
  id: number;
  time: string;
  kind: LogKind;
  message: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type ApprovalItem = {
  id: string;
  action: string;
  detail: string;
  tag: string;
  risk: "Review" | "Sensitive";
  icon: LucideIcon;
};

type Connection = {
  id: string;
  label: string;
  description: string;
  meta: string;
  status: ConnectionStatus;
  icon: LucideIcon;
  tone: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const initialLogs: LogEntry[] = [
  { id: 1, time: "12:27:01", kind: "system", message: "Initializing lead scraper..." },
  { id: 2, time: "12:27:04", kind: "info", message: "5 new potential clients found on LinkedIn." },
  { id: 3, time: "12:27:09", kind: "success", message: "Cold email sent to Riyadh gift shop." },
  { id: 4, time: "12:27:16", kind: "wait", message: "Awaiting user approval for automated video upload." },
  { id: 5, time: "12:28:02", kind: "system", message: "J.A.R.V.I.S core synchronized. Ready for instruction." },
];

const initialConnections: Connection[] = [
  { id: "gmail", label: "Gmail", description: "Inbox, drafts & outbound mail", meta: "OAuth adapter ready", status: "Ready", icon: Mail, tone: "coral" },
  { id: "github", label: "GitHub", description: "Repos, branches & pull requests", meta: "OAuth adapter ready", status: "Connected", icon: Github, tone: "violet" },
  { id: "vercel", label: "Vercel", description: "Projects, builds & deployments", meta: "OAuth adapter ready", status: "Ready", icon: Globe2, tone: "slate" },
  { id: "linkedin", label: "LinkedIn", description: "Lead discovery & prospect lists", meta: "Connector pending", status: "Ready", icon: Linkedin, tone: "blue" },
  { id: "openai", label: "OpenAI", description: "Reasoning, copy & structured output", meta: "API adapter ready", status: "Connected", icon: Sparkles, tone: "mint" },
  { id: "video", label: "Video stack", description: "Generate, review & publish content", meta: "API adapter ready", status: "Ready", icon: Video, tone: "amber" },
];

const actionData = [
  { id: "outreach", label: "Start Outreach", description: "Scrape leads & send emails", icon: Inbox, stat: "12 leads staged", tint: "cyan" },
  { id: "video", label: "Generate Video", description: "Auto-create & post content", icon: Video, stat: "3 drafts queued", tint: "violet" },
  { id: "deploy", label: "Deploy Project", description: "Push to GitHub & Vercel", icon: Rocket, stat: "main · clean", tint: "amber" },
];

const formatTime = () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
const formatDate = () => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date()).toUpperCase();

function AppMark() {
  return (
    <div className="app-mark" aria-label="J.A.R.V.I.S logo">
      <span className="app-mark-core"><span /></span>
      <span className="app-wordmark">J.A.R.V.I.S</span>
    </div>
  );
}

function SectionLabel({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {right}
    </div>
  );
}

function StatusPill({ children, tone = "online" }: { children: React.ReactNode; tone?: "online" | "warning" | "muted" }) {
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children}</span>;
}

export default function Home() {
  const auth = useAuth();
  const assistantChat = trpc.assistant.chat.useMutation();
  const profileUpdate = trpc.profile.update.useMutation({
    onSuccess: async () => {
      await auth.refresh();
      setProfileOpen(false);
      flash("Profile updated", "Your J.A.R.V.I.S operator profile is saved.");
    },
    onError: (error: { message: string }) => flash("Profile update failed", error.message),
  });
  const [now, setNow] = useState(new Date());
  const [view, setView] = useState<View>("Command center");
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    { id: "email-1", action: "Send 12 personalized replies", detail: "Gmail · Riyadh gift shop campaign", tag: "OUTREACH", risk: "Review", icon: Mail },
    { id: "video-1", action: "Publish generated reel", detail: "Video stack · Instagram queue", tag: "CONTENT", risk: "Sensitive", icon: Video },
    { id: "deploy-1", action: "Promote build to production", detail: "Vercel · jarvisdash/main", tag: "DEPLOY", risk: "Sensitive", icon: Rocket },
  ]);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>(["Sync system health", "Review pending approvals", "Check Vercel deployment"]);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastAction, setLastAction] = useState("SYSTEM READY");
  const [notification, setNotification] = useState<{ title: string; detail: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const processingRef = useRef(false);
  const chatHistoryRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    setProfileName(auth.user?.name ?? "");
  }, [auth.user?.name]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  useEffect(() => {
    const browserWindow = window as Window & typeof globalThis & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    setVoiceSupported(Boolean(Recognition));
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      setListening(true);
      setLastAction("LISTENING FOR INSTRUCTION");
      addLog("info", "Microphone armed. J.A.R.V.I.S is listening...");
    };
    recognition.onresult = event => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      const normalizedTranscript = transcript.trim();
      setCommand(normalizedTranscript);
      if (event.results[event.results.length - 1]?.isFinal && normalizedTranscript) {
        submitText(normalizedTranscript);
      }
    };
    recognition.onerror = event => {
      setListening(false);
      setLastAction("SYSTEM READY");
      addLog("error", `Voice input error${event.error ? `: ${event.error}` : "."}`);
      flash("Voice input interrupted", "Check microphone permission and try Voice Mode again.");
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setLastAction(previous => previous === "LISTENING FOR INSTRUCTION" ? "SYSTEM READY" : previous);
    };
    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if ((event.key === "/" && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if ((event.key.toLowerCase() === "c") && !typing) {
        setView("Connections");
        document.getElementById("connections")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  const connectedCount = useMemo(() => connections.filter(connection => connection.status === "Connected").length, [connections]);
  const addLog = (kind: LogKind, message: string) => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), time: formatTime(), kind, message }]);
  };
  const flash = (title: string, detail: string) => {
    setNotification({ title, detail });
    window.setTimeout(() => setNotification(null), 3600);
  };

  const runAction = (id: string, label: string) => {
    setProcessing(true);
    setLastAction(`${label.toUpperCase()} IN PROGRESS`);
    addLog("system", `Executing command: ${label.toLowerCase()} workflow...`);
    setHistory(prev => [label, ...prev].slice(0, 5));
    flash("Command accepted", `${label} is running in simulation mode.`);
    window.setTimeout(() => {
      if (id === "outreach") {
        addLog("info", "12 prospect records staged. Gmail send queue paused for approval.");
      } else if (id === "video") {
        addLog("info", "Storyboard rendered. Upload queue paused for operator approval.");
      } else {
        addLog("info", "Build #184 passed. Production deploy paused for operator approval.");
      }
      setProcessing(false);
      setLastAction("ACTION PAUSED FOR APPROVAL");
      flash("Approval required", "The next step is waiting in the approval queue.");
    }, 900);
  };

  const speakAssistant = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ""));
    utterance.rate = 0.96;
    utterance.pitch = 0.84;
    utterance.volume = 1;
    const preferredVoice = window.speechSynthesis.getVoices().find(voice => /en[-_](GB|US)/i.test(voice.lang) && /Google|Microsoft|Samantha|Daniel/i.test(voice.name));
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  };

  const submitText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || processingRef.current) return;
    setCommand("");
    setHistory(prev => [trimmed, ...prev].slice(0, 5));
    addLog("user", trimmed);
    const nextMessages: ChatMessage[] = [...chatHistoryRef.current, { role: "user" as const, content: trimmed }].slice(-24);
    chatHistoryRef.current = nextMessages;
    setChatHistory(nextMessages);
    processingRef.current = true;
    setProcessing(true);
    setLastAction("J.A.R.V.I.S IS THINKING");
    addLog("info", "Processing command... Routing to n8n workflow...");
    addLog("info", "J.A.R.V.I.S reasoning core is analyzing the request...");
    flash("J.A.R.V.I.S is thinking", "Your command is being analyzed with the tactical reasoning core.");
    setLastAction("REASONING CORE ACTIVE");
    try {
      const response = await assistantChat.mutateAsync({ messages: nextMessages });
      const assistantMessage: ChatMessage = { role: "assistant", content: response.message };
      const updatedMessages = [...nextMessages, assistantMessage].slice(-24);
      chatHistoryRef.current = updatedMessages;
      setChatHistory(updatedMessages);
      addLog("success", response.message);
      speakAssistant(response.message);
      addLog("success", "Workflow plan ready. J.A.R.V.I.S has prepared the next action for review.");
      setProcessing(false);
      processingRef.current = false;
      setLastAction("SYSTEM READY");
      flash("J.A.R.V.I.S responded", "No external action was taken without approval.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The reasoning core is unavailable.";
      addLog("error", `Reasoning core error: ${message}`);
      setProcessing(false);
      processingRef.current = false;
      setLastAction("SYSTEM READY");
      flash("J.A.R.V.I.S needs attention", "The command was retained. Check the connection and try again.");
    }
  };

  const submitCommand = () => submitText(command);

  const toggleListening = () => {
    if (!voiceSupported) {
      addLog("error", "Voice Mode is unavailable in this browser.");
      flash("Voice Mode unavailable", "Use a browser with Speech Recognition support and allow microphone access.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    try {
      recognitionRef.current?.start();
      flash("Listening mode enabled", "Speak your instruction now.");
    } catch {
      flash("Voice Mode is already active", "Finish the current transcript before starting another one.");
    }
  };

  const toggleConnection = (id: string) => {
    const connection = connections.find(item => item.id === id);
    if (!connection) return;
    const nextStatus: ConnectionStatus = connection.status === "Connected" ? "Ready" : "Connected";
    setConnections(prev => prev.map(item => item.id === id ? { ...item, status: nextStatus } : item));
    addLog(nextStatus === "Connected" ? "success" : "wait", `${connection.label} ${nextStatus === "Connected" ? "connection authorized" : "connection paused"}.`);
    flash(nextStatus === "Connected" ? `${connection.label} connected` : `${connection.label} disconnected`, nextStatus === "Connected" ? "Adapter is ready for approved workflows." : "No new actions will be sent.");
  };

  const resolveApproval = (item: ApprovalItem, approved: boolean) => {
    setApprovals(prev => prev.filter(current => current.id !== item.id));
    addLog(approved ? "success" : "wait", `${approved ? "Approved" : "Rejected"}: ${item.action}.`);
    flash(approved ? "Approval recorded" : "Action rejected", approved ? `${item.action} is cleared for the connected adapter.` : "The workflow remains paused and no action was sent.");
  };

  if (auth.loading) {
    return <div className="auth-screen"><div className="auth-card loading-card"><div className="auth-orb"><span>J</span></div><span className="eyebrow accent-eyebrow">AUTHENTICATING OPERATOR</span><h1>Connecting to J.A.R.V.I.S</h1><p>Verifying your secure operator session...</p></div></div>;
  }

  if (!auth.isAuthenticated || !auth.user) {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-orb"><span>J</span></div><div className="eyebrow accent-eyebrow"><span className="eyebrow-line" />SECURE OPERATOR ACCESS</div><h1>J.A.R.V.I.S <em>awaits.</em></h1><p>Sign in with your Manus account to access your private command center, connections, approvals, and profile.</p><button className="auth-login-button" onClick={() => startLogin()}><ShieldCheck size={16} /> Sign in to continue <ArrowUpRight size={15} /></button><span className="auth-footnote"><LockKeyhole size={13} /> Your dashboard is scoped to your authenticated profile.</span></div></div>;
  }

  return (
    <div className="jarvis-app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <AppMark />
        <div className="topbar-divider" />
        <div className="topbar-context"><span>OPERATIONS CONSOLE</span><span className="context-separator">/</span><span>NODE 07 · DUBAI</span></div>
        <div className="topbar-spacer" />
        <div className="clock-block"><strong>{formatTime.call(null)}</strong><span>{formatDate.call(null)}</span></div>
        <StatusPill>System Status: Online</StatusPill>
        <button className="icon-button" aria-label="Notifications" onClick={() => { setView("Activity"); document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" }); }}><Bell size={17} /><span className="notification-badge">3</span></button>
        <button className="avatar-button" aria-label="Open operator profile" onClick={() => setProfileOpen(true)}>{(auth.user.name ?? "CEO").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</button>
      </header>

      <div className="workspace">
        <aside className="side-rail">
          <div className="rail-top"><span className="rail-caption">COMMAND DECK</span><button className="rail-collapse" aria-label="Collapse navigation"><ChevronRight size={16} /></button></div>
          <nav className="rail-nav" aria-label="Primary navigation">
            {([ ["Command center", Command, "01"], ["Connections", Network, "02"], ["Approvals", ShieldCheck, String(approvals.length).padStart(2, "0")], ["Activity", Activity, "04"] ] as const).map(([label, Icon, number]) => (
              <button key={label} className={`rail-link ${view === label ? "active" : ""}`} onClick={() => { setView(label); if (label === "Connections") document.getElementById("connections")?.scrollIntoView({ behavior: "smooth" }); if (label === "Approvals") document.getElementById("approvals")?.scrollIntoView({ behavior: "smooth" }); if (label === "Activity") document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" }); }}>
                <span className="rail-icon"><Icon size={16} /></span><span>{label}</span><small>{number}</small>
              </button>
            ))}
          </nav>
          <div className="rail-bottom">
            <div className="rail-status"><span className="pulse-dot" /><div><strong>ALL SYSTEMS NOMINAL</strong><span>Last check {formatTime.call(null)}</span></div></div>
            <button className="rail-link"><span className="rail-icon"><Settings2 size={16} /></span><span>Settings</span></button>
          </div>
        </aside>

        <main className="main-content">
          <div className="page-header">
            <div><div className="eyebrow accent-eyebrow"><span className="eyebrow-line" />LIVE COMMAND CENTER</div><h1>Good evening, <em>CEO.</em></h1><p>J.A.R.V.I.S is online and monitoring your active workflows.</p></div>
            <div className="header-actions"><span className="shortcut-hint"><kbd>/</kbd> Focus command</span><button className="ghost-button" onClick={() => { setLogs(initialLogs); flash("Terminal reset", "System telemetry returned to the initial snapshot."); }}><RefreshCw size={15} /> Reset sim</button></div>
          </div>

          <section className="metrics-grid" aria-label="System metrics">
            <div className="metric-card"><div className="metric-top"><span>LEADS DISCOVERED</span><Inbox size={15} /></div><strong>128</strong><span className="metric-change positive">+18.4% <span>vs last week</span></span><div className="sparkline cyan"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
            <div className="metric-card"><div className="metric-top"><span>MESSAGES SENT</span><Send size={15} /></div><strong>64</strong><span className="metric-change positive">+12.6% <span>this month</span></span><div className="sparkline blue"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
            <div className="metric-card"><div className="metric-top"><span>VIDEOS GENERATED</span><Video size={15} /></div><strong>24</strong><span className="metric-change neutral">3 <span>awaiting review</span></span><div className="sparkline violet"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
            <div className="metric-card"><div className="metric-top"><span>UPTIME</span><Activity size={15} /></div><strong>99.98<small>%</small></strong><span className="metric-change positive">+0.02% <span>last 30 days</span></span><div className="sparkline green"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
          </section>

          <div className="hero-grid">
            <section className={`orb-panel glass-panel ${listening ? "listening" : ""} ${processing ? "processing" : ""}`}>
              <div className="panel-topline"><span className="panel-index">01</span><span>CORE INTERFACE</span><span className="topline-right"><Radio size={13} /> {processing ? "EXECUTING" : listening ? "LISTENING" : "STANDBY"}</span></div>
              <div className="orb-stage">
                <div className="orb-gridlines" />
                <div className="orb-radar" />
                <div className="orb-ring ring-outer" /><div className="orb-ring ring-mid" /><div className="orb-ring ring-inner" />
                <div className="orb-aura" /><div className="orb-core"><div className="orb-core-glint" /><span>J</span></div>
                <div className="orb-scanline" />
                <div className="signal-bars">{Array.from({ length: 18 }).map((_, index) => <i key={index} style={{ height: `${10 + ((index * 19) % 26)}px` }} />)}</div>
                <div className="orb-label orb-label-top">NURAL CORE <span>v2.4.8</span></div><div className="orb-label orb-label-left">SYNC <span>99.8%</span></div><div className="orb-label orb-label-right">LATENCY <span>24ms</span></div><div className="orb-label orb-label-bottom">{lastAction}</div>
              </div>
              <div className="composer-wrap">
                <div className="composer-label"><span>COMMAND INPUT</span><span><kbd>ENTER</kbd> EXECUTE</span></div>
                <div className="command-composer"><input ref={inputRef} value={command} onChange={event => setCommand(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submitCommand(); }} placeholder="Type a command or speak..." /><button className={`voice-mode-button ${listening ? "active" : ""}`} onClick={toggleListening} aria-pressed={listening} title={voiceSupported ? "Start microphone input" : "Speech recognition is unavailable in this browser"}><Mic size={15} /><span>Voice Mode</span></button><button className="send-button" onClick={submitCommand} disabled={processing || !command.trim()}><Send size={16} /><span>Send</span></button></div>
                <div className="composer-foot"><span><span className="tiny-green-dot" /> Secure operator channel</span><span>Press <kbd>/</kbd> anywhere to focus</span></div>
              </div>
            </section>

            <section className="terminal-panel glass-panel">
              <div className="panel-topline"><span className="panel-index">02</span><span>SYSTEM TERMINAL</span><span className="topline-right terminal-online"><span className="status-dot" /> LIVE</span></div>
              <div className="terminal-toolbar"><span><Terminal size={14} /> jarvis@node-07:~</span><span className="toolbar-actions"><button aria-label="Search terminal"><Search size={14} /></button><button aria-label="More terminal actions"><MoreHorizontal size={16} /></button></span></div>
              <div ref={terminalRef} className="terminal-body">{logs.map(log => <div className="terminal-line" key={log.id}><span className="terminal-time">{log.time}</span><span className={`terminal-kind ${log.kind}`}>[{log.kind.toUpperCase()}]</span><span className="terminal-message">{log.message}</span></div>)}<div className="terminal-cursor"><span>_</span></div></div>
              <div className="terminal-footer"><span><Wifi size={13} /> Stream connected</span><span>Buffer {logs.length.toString().padStart(2, "0")} / 99</span></div>
            </section>
          </div>

          <section className="quick-actions-section">
            <SectionLabel eyebrow="03 / FAST COMMANDS" title="Quick actions" right={<span className="section-note"><Zap size={13} /> One-click workflows</span>} />
            <div className="quick-actions-grid">{actionData.map(action => { const Icon = action.icon; return <button className={`quick-action-card ${action.tint}`} key={action.id} onClick={() => runAction(action.id, action.label)} disabled={processing}><div className="action-icon"><Icon size={20} /></div><div className="action-copy"><span className="action-label">{action.label}<ArrowUpRight size={14} /></span><span className="action-description">{action.description}</span><span className="action-stat"><span className="live-mini-dot" />{action.stat}</span></div><div className="action-arrow"><ChevronRight size={18} /></div></button>; })}</div>
          </section>

          <div className="lower-grid">
            <section id="connections" className="connections-section glass-panel"><SectionLabel eyebrow="04 / ACCESS LAYER" title="Connections center" right={<span className="connection-count"><span className="status-dot" />{connectedCount} of {connections.length} connected</span>} /><p className="section-description">Authorize the services J.A.R.V.I.S can operate. Each adapter stays dormant until you approve its next action.</p><div className="connection-grid">{connections.map(connection => { const Icon = connection.icon; const connected = connection.status === "Connected"; return <div className="connection-card" key={connection.id}><div className={`provider-icon ${connection.tone}`}><Icon size={19} /></div><div className="connection-copy"><strong>{connection.label}</strong><span>{connection.description}</span><small>{connection.meta}</small></div><button className={`connect-button ${connected ? "connected" : ""}`} onClick={() => toggleConnection(connection.id)}>{connected ? <><Check size={13} /> Connected</> : <>Connect <ArrowUpRight size={13} /></>}</button></div>; })}</div><div className="adapter-note"><LockKeyhole size={14} /><span>OAuth and API credentials stay in protected server-side storage. The browser only receives connection status.</span><button className="text-button">View adapter docs <ChevronRight size={13} /></button></div></section>

            <section id="approvals" className="approvals-section glass-panel"><SectionLabel eyebrow="05 / HUMAN IN THE LOOP" title="Approval queue" right={<span className="queue-count">{approvals.length} pending</span>} /><div className="approval-list">{approvals.length ? approvals.map(item => { const Icon = item.icon; return <div className="approval-item" key={item.id}><div className="approval-icon"><Icon size={16} /></div><div className="approval-copy"><div className="approval-meta"><span>{item.tag}</span><span className={item.risk === "Sensitive" ? "sensitive" : "review"}>{item.risk}</span></div><strong>{item.action}</strong><small>{item.detail}</small><div className="approval-buttons"><button className="approve-button" onClick={() => resolveApproval(item, true)}><Check size={13} /> Approve</button><button className="reject-button" onClick={() => resolveApproval(item, false)}><X size={13} /> Reject</button></div></div></div>; }) : <div className="empty-queue"><CheckCircle2 size={24} /><strong>Queue clear</strong><span>No external actions are waiting for approval.</span></div>}</div><div className="approval-footer"><ShieldCheck size={14} /><span>Nothing is sent, published, or deployed without operator approval.</span></div></section>
          </div>

          <div className="bottom-grid">
            <section id="activity" className="activity-section glass-panel"><SectionLabel eyebrow="06 / OPERATIONS FEED" title="Recent activity" right={<button className="text-button">Open audit log <ChevronRight size={13} /></button>} /><div className="activity-list"><div className="activity-row"><div className="activity-marker success"><Check size={12} /></div><div><strong>Outreach draft prepared</strong><span>12 personalized replies are ready for review.</span></div><time>2m ago</time></div><div className="activity-row"><div className="activity-marker info"><Link2Icon /></div><div><strong>GitHub adapter connected</strong><span>Repository access is scoped to jarvisdash.</span></div><time>18m ago</time></div><div className="activity-row"><div className="activity-marker wait"><Clock3 size={12} /></div><div><strong>Video upload paused</strong><span>Awaiting your approval before publish.</span></div><time>42m ago</time></div></div></section>
            <section className="health-section glass-panel"><SectionLabel eyebrow="07 / TELEMETRY" title="System health" right={<span className="health-live"><span className="pulse-dot" />Monitoring</span>} /><div className="health-list"><div><span><Cpu size={14} /> AI inference</span><strong>24 ms <i>optimal</i></strong></div><div><span><Server size={14} /> API gateway</span><strong>Operational <i>100%</i></strong></div><div><span><Database size={14} /> Data sync</span><strong>Synced <i>just now</i></strong></div><div><span><ShieldCheck size={14} /> Security layer</span><strong>Armed <i>zero alerts</i></strong></div></div></section>
          </div>

          <footer className="app-footer"><span><span className="footer-core" /> J.A.R.V.I.S // JUST A RATHER VERY INTELLIGENT SYSTEM</span><span>BUILD 2.4.8 <span className="footer-divider" /> ALL SYSTEMS NOMINAL <span className="footer-divider" /> <span className="shortcut-footer"><kbd>/</kbd> COMMAND <kbd>C</kbd> CONNECTIONS</span></span></footer>
        </main>
      </div>
      {notification && <div className="toast-notification"><div className="toast-icon"><Check size={15} /></div><div><strong>{notification.title}</strong><span>{notification.detail}</span></div><button aria-label="Dismiss notification" onClick={() => setNotification(null)}><X size={15} /></button></div>}
      {profileOpen && <div className="profile-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="profile-dialog-top"><div><div className="eyebrow accent-eyebrow">OPERATOR PROFILE</div><h2 id="profile-title">Your J.A.R.V.I.S identity</h2></div><button className="profile-close" aria-label="Close profile" onClick={() => setProfileOpen(false)}><X size={17} /></button></div><div className="profile-identity"><div className="profile-avatar">{(auth.user.name ?? "CEO").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><strong>{auth.user.email ?? "Authenticated operator"}</strong><span>{auth.user.role === "admin" ? "Administrator" : "Operator"} · {auth.user.loginMethod ?? "Manus account"}</span></div></div><label className="profile-field"><span>Display name</span><input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="CEO" maxLength={80} /></label><div className="profile-readonly"><div><span>Account email</span><strong>{auth.user.email ?? "Not provided"}</strong></div><div><span>Access role</span><strong>{auth.user.role === "admin" ? "Administrator" : "Operator"}</strong></div><div><span>Account ID</span><strong>{auth.user.openId.slice(0, 12)}…</strong></div></div><div className="profile-dialog-footer"><button className="logout-button" onClick={() => auth.logout()}><Unplug size={14} /> Sign out</button><button className="save-profile-button" disabled={profileUpdate.isPending || !profileName.trim()} onClick={() => profileUpdate.mutate({ name: profileName.trim() })}><Save size={14} /> {profileUpdate.isPending ? "Saving..." : "Save profile"}</button></div></section></div>}
    </div>
  );
}

function Link2Icon() {
  return <ArrowUpRight size={12} />;
}
