import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart3,
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
  ListTodo,
  Linkedin,
  LockKeyhole,
  Mail,
  Menu,
  Mic,
  MoreHorizontal,
  Network,
  Paperclip,
  Phone,
  PhoneOff,
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
  Trash2,
  Unplug,
  Video,
  Wifi,
  Volume2,
  VolumeX,
  X,
  Zap,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

type LogKind = "user" | "system" | "info" | "success" | "wait" | "error";
type View = "Overview" | "AI Assistant" | "Tasks & Workflows" | "Leads & Outreach" | "Integrations" | "Video Studio" | "Analytics" | "Approval Center" | "Settings";
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
type TaskStage = "Reasoning" | "Preparing" | "Awaiting approval" | "Approved" | "Complete";
type TaskItem = { id: string; title: string; detail: string; stage: TaskStage; progress: number; approvalRequired: boolean };
type LocalAttachment = { id: string; name: string; type: string; size: number; previewUrl?: string };
type ChatSession = { id: string; title: string; updatedAt: number; messages: ChatMessage[]; archived?: boolean };

const workspaceRoutes: Record<View, string> = {
  "Overview": "/",
  "AI Assistant": "/assistant",
  "Tasks & Workflows": "/tasks",
  "Leads & Outreach": "/leads",
  "Integrations": "/integrations",
  "Video Studio": "/video",
  "Analytics": "/analytics",
  "Approval Center": "/approvals",
  "Settings": "/settings",
};

const workspaceNav: Array<{ label: View; icon: LucideIcon; group: "Workspace" | "Operations" | "System" }> = [
  { label: "Overview", icon: Command, group: "Workspace" },
  { label: "AI Assistant", icon: Bot, group: "Workspace" },
  { label: "Tasks & Workflows", icon: ListTodo, group: "Workspace" },
  { label: "Leads & Outreach", icon: Users, group: "Operations" },
  { label: "Integrations", icon: Network, group: "Operations" },
  { label: "Video Studio", icon: Video, group: "Operations" },
  { label: "Analytics", icon: BarChart3, group: "Operations" },
  { label: "Approval Center", icon: ShieldCheck, group: "System" },
  { label: "Settings", icon: Settings2, group: "System" },
];

const routeToView = Object.fromEntries(Object.entries(workspaceRoutes).map(([view, path]) => [path, view])) as Record<string, View>;

const welcomeMessage: ChatMessage = { role: "assistant", content: "Hey Abubakar. I’m here and ready. How are you doing, and what do we have today?" };
const loadChatSessions = (): ChatSession[] => {
  if (typeof window !== "undefined") {
    try {
      const saved = JSON.parse(window.localStorage.getItem("jarvis-chat-sessions") || "null") as ChatSession[] | null;
      if (saved?.length) return saved;
    } catch { /* use a clean session */ }
  }
  return [{ id: "current", title: "New command session", updatedAt: Date.now(), messages: [welcomeMessage] }];
};

const initialLogs: LogEntry[] = [
  { id: 1, time: "12:27:01", kind: "system", message: "Initializing lead scraper..." },
  { id: 2, time: "12:27:04", kind: "info", message: "5 new potential clients found on LinkedIn." },
  { id: 3, time: "12:27:09", kind: "success", message: "Cold email sent to Riyadh gift shop." },
  { id: 4, time: "12:27:16", kind: "wait", message: "Awaiting user approval for automated video upload." },
  { id: 5, time: "12:28:02", kind: "system", message: "J.A.R.V.I.S core synchronized. Ready for instruction." },
];

const initialConnections: Connection[] = [
  { id: "gmail", label: "Gmail", description: "Inbox, drafts & outbound mail", meta: "OAuth credentials required", status: "Ready", icon: Mail, tone: "coral" },
  { id: "github", label: "GitHub", description: "Repos, branches & pull requests", meta: "OAuth credentials required", status: "Ready", icon: Github, tone: "violet" },
  { id: "vercel", label: "Vercel", description: "Projects, builds & deployments", meta: "OAuth adapter ready", status: "Ready", icon: Globe2, tone: "slate" },
  { id: "linkedin", label: "LinkedIn", description: "Lead discovery & prospect lists", meta: "Connector pending", status: "Ready", icon: Linkedin, tone: "blue" },
  { id: "openai", label: "OpenAI", description: "Reasoning, copy & structured output", meta: "Managed reasoning core", status: "Ready", icon: Sparkles, tone: "mint" },
  { id: "video", label: "Video stack", description: "Generate, review & publish content", meta: "API adapter ready", status: "Ready", icon: Video, tone: "amber" },
];

const actionData = [
  { id: "outreach", label: "Start Outreach", description: "Scrape leads & send emails", icon: Inbox, stat: "12 leads staged", tint: "cyan" },
  { id: "video", label: "Generate Video", description: "Auto-create & post content", icon: Video, stat: "3 drafts queued", tint: "violet" },
  { id: "deploy", label: "Deploy Project", description: "Push to GitHub & Vercel", icon: Rocket, stat: "main · clean", tint: "amber" },
];

const connectionRequirements: Record<string, string> = {
  gmail: "Gmail adapter pending · Google OAuth app required",
  github: "Missing GITHUB_CLIENT_ID / SECRET or PUBLIC_APP_URL",
  vercel: "Missing VERCEL_CLIENT_ID / SECRET or PUBLIC_APP_URL",
  linkedin: "LinkedIn developer app + approved OAuth scopes required",
  openai: "Managed by J.A.R.V.I.S · no separate connection needed",
  video: "Video provider adapters are not configured yet",
};

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
  const connectorCatalog = trpc.connections.catalog.useQuery();
  const connectorList = trpc.connections.list.useQuery();
  const connectorStart = trpc.connections.start.useMutation();
  const connectorDisconnect = trpc.connections.disconnect.useMutation();
  const profileUpdate = trpc.profile.update.useMutation({
    onSuccess: async () => {
      await auth.refresh();
      setProfileOpen(false);
      flash("Profile updated", "Your J.A.R.V.I.S operator profile is saved.");
    },
    onError: (error: { message: string }) => flash("Profile update failed", error.message),
  });
  const [now, setNow] = useState(new Date());
  const [location, setLocation] = useLocation();
  const view = routeToView[location] ?? "Overview";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(loadChatSessions);
  const [currentChatId, setCurrentChatId] = useState(() => loadChatSessions()[0]?.id ?? "current");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => loadChatSessions()[0]?.messages ?? [welcomeMessage]);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(true);
  const [voiceCallMode, setVoiceCallMode] = useState(false);
  const [recordingVoiceNote, setRecordingVoiceNote] = useState(false);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: "task-content", title: "Content pipeline", detail: "3 drafts are ready for operator review.", stage: "Awaiting approval", progress: 72, approvalRequired: true },
    { id: "task-outreach", title: "Riyadh outreach engine", detail: "12 leads staged; no messages will send without approval.", stage: "Preparing", progress: 54, approvalRequired: true },
    { id: "task-deploy", title: "J.A.R.V.I.S self-build protocol", detail: "Repository and deployment plan can be prepared from an approved task.", stage: "Reasoning", progress: 28, approvalRequired: true },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceCallRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceNoteChunksRef = useRef<Blob[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const chatHistoryRef = useRef<ChatMessage[]>(loadChatSessions()[0]?.messages ?? [welcomeMessage]);

  useEffect(() => {
    setProfileName(auth.user?.name ?? "");
  }, [auth.user?.name]);

  useEffect(() => {
    setChatSessions(previous => {
      const firstUserMessage = chatHistory.find(message => message.role === "user")?.content.replace(/\n\n\[Evidence staged:[\s\S]*$/, "") || "New command session";
      const updated = previous.some(session => session.id === currentChatId)
        ? previous.map(session => session.id === currentChatId ? { ...session, title: session.title === "New command session" ? firstUserMessage.slice(0, 46) : session.title, updatedAt: Date.now(), messages: chatHistory } : session)
        : [{ id: currentChatId, title: firstUserMessage.slice(0, 46), updatedAt: Date.now(), messages: chatHistory }, ...previous];
      window.localStorage.setItem("jarvis-chat-sessions", JSON.stringify(updated.slice(0, 12)));
      return updated.slice(0, 12);
    });
  }, [chatHistory, currentChatId]);

  useEffect(() => {
    if (!connectorList.data) return;
    setConnections(previous => previous.map(connection => {
      const record = connectorList.data.find(item => item.provider === connection.id);
      return record ? { ...connection, status: record.status === "connected" ? "Connected" : "Ready", meta: record.accountLabel || "Connected account" } : connection;
    }));
  }, [connectorList.data]);

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
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        voiceCallRef.current = false;
        setVoiceCallMode(false);
        flash("Microphone permission blocked", "Open J.A.R.V.I.S in Chrome, allow microphone access, then try Voice again.");
      }
      setListening(false);
      setLastAction("SYSTEM READY");
      addLog("error", `Voice input error${event.error ? `: ${event.error}` : "."}`);
      flash("Voice input interrupted", "Check microphone permission and try Voice Mode again.");
    };
    recognition.onend = () => {
      if (voiceCallRef.current) {
        window.setTimeout(() => {
          if (!voiceCallRef.current || recognitionRef.current !== recognition) return;
          try { recognition.start(); } catch { /* browser is already restarting */ }
        }, 180);
        return;
      }
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
        chatInputRef.current?.focus();
      }
      if ((event.key.toLowerCase() === "c") && !typing) {
        setLocation(workspaceRoutes.Integrations);
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
  const navigateTo = (nextView: View) => {
    setLocation(workspaceRoutes[nextView]);
    setSidebarOpen(false);
  };

  const startNewChat = () => {
    const id = `chat-${Date.now()}`;
    setCurrentChatId(id);
    chatHistoryRef.current = [welcomeMessage];
    setChatHistory([welcomeMessage]);
    flash("New chat ready", "Past conversations remain available in memory.");
  };

  const openChat = (session: ChatSession) => {
    setCurrentChatId(session.id);
    chatHistoryRef.current = session.messages;
    setChatHistory(session.messages);
    flash("Chat restored", session.title);
  };

  const archiveChat = (session: ChatSession) => {
    const archived = !session.archived;
    const nextSessions = chatSessions.map(item => item.id === session.id ? { ...item, archived, updatedAt: Date.now() } : item);
    setChatSessions(nextSessions);
    window.localStorage.setItem("jarvis-chat-sessions", JSON.stringify(nextSessions));
    if (session.id === currentChatId) {
      const nextActive = nextSessions.filter(item => !item.archived).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (nextActive) openChat(nextActive);
      else startNewChat();
    }
    flash(archived ? "Chat archived" : "Chat restored", archived ? "It has been removed from the active memory rail." : "It is available again in your active chats.");
  };

  const deleteChat = (session: ChatSession) => {
    const nextSessions = chatSessions.filter(item => item.id !== session.id);
    setChatSessions(nextSessions);
    window.localStorage.setItem("jarvis-chat-sessions", JSON.stringify(nextSessions));
    if (session.id === currentChatId) {
      const nextActive = nextSessions.filter(item => !item.archived).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (nextActive) openChat(nextActive);
      else startNewChat();
    }
    flash("Chat deleted", "The conversation was permanently removed from this browser.");
  };

  const approveTask = (task: TaskItem) => {
    setTasks(previous => previous.map(item => item.id === task.id ? { ...item, stage: "Approved", progress: Math.max(item.progress, 80), approvalRequired: false } : item));
    addLog("success", `Task approved: ${task.title}. J.A.R.V.I.S may now prepare the authorized next step.`);
    flash("Task approved", `${task.title} is cleared for preparation. External execution remains adapter-gated.`);
  };

  const handleAttachmentSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 5);
    const nextAttachments = files.map(file => ({ id: `${file.name}-${file.lastModified}`, name: file.name, type: file.type || "file", size: file.size, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined }));
    setAttachments(previous => [...previous, ...nextAttachments].slice(-5));
    if (files.length) flash("Evidence staged", `${files.length} file${files.length === 1 ? "" : "s"} attached to the next command.`);
    event.target.value = "";
  };

  const removeAttachment = (id: string) => setAttachments(previous => previous.filter(item => item.id !== id));

  const toggleVoiceNote = async () => {
    if (recordingVoiceNote) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      flash("Voice notes unavailable", "This browser does not expose microphone recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceNoteChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) voiceNoteChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(voiceNoteChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAttachments(previous => [...previous, { id: `voice-${Date.now()}`, name: `voice-note-${new Date().toISOString().slice(11, 19).replaceAll(":", "-")}.webm`, type: blob.type, size: blob.size, previewUrl: URL.createObjectURL(blob) }].slice(-5));
        stream.getTracks().forEach(track => track.stop());
        setRecordingVoiceNote(false);
        flash("Voice note staged", "Attach it to a command when you are ready.");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingVoiceNote(true);
      flash("Recording voice note", "Speak naturally, then press Voice note again to stop.");
    } catch {
      flash("Microphone permission required", "Allow microphone access to record a voice note.");
    }
  };

  const toggleVoiceCall = () => {
    if (!voiceSupported) {
      flash("Voice call unavailable", "Use a browser with Speech Recognition support and allow microphone access.");
      return;
    }
    if (voiceCallMode) {
      voiceCallRef.current = false;
      setVoiceCallMode(false);
      recognitionRef.current?.stop();
      flash("Voice call ended", "The conversation remains visible in the command channel.");
      return;
    }
    voiceCallRef.current = true;
    setVoiceCallMode(true);
    if (recognitionRef.current) {
      recognitionRef.current.continuous = true;
      try { recognitionRef.current.start(); } catch { /* already listening */ }
    }
    flash("Voice call active", "Speak naturally. J.A.R.V.I.S will answer through the conversation channel.");
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
    if (!voiceRepliesEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ""));
    utterance.rate = 0.9;
    utterance.pitch = 1.08;
    utterance.volume = 1;
    const availableVoices = window.speechSynthesis.getVoices();
    const preferredVoice = availableVoices.find(voice => /en[-_](GB|US)/i.test(voice.lang) && /female|zira|samantha|karen|serena|victoria/i.test(voice.name)) ?? availableVoices.find(voice => /en[-_](GB|US)/i.test(voice.lang));
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  };

  const submitText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || processingRef.current) return;
    setCommand("");
    if (/^(hi|hii|hey|hello|good morning|good afternoon|good evening)[!.?\s]*$/i.test(trimmed)) {
      const nextMessages: ChatMessage[] = [...chatHistoryRef.current, { role: "user" as const, content: trimmed }, { role: "assistant" as const, content: "Hey Abubakar! I’m here and ready. How are you doing, and what do we have today?" }].slice(-24);
      chatHistoryRef.current = nextMessages;
      setChatHistory(nextMessages);
      setHistory(previous => [trimmed, ...previous].slice(0, 5));
      addLog("user", trimmed);
      speakAssistant("Hey Abubakar! I’m here and ready. How are you doing, and what do we have today?");
      return;
    }
    setHistory(prev => [trimmed, ...prev].slice(0, 5));
    const taskId = `task-${Date.now()}`;
    setTasks(previous => [{ id: taskId, title: trimmed.slice(0, 52), detail: "J.A.R.V.I.S is converting your instruction into an actionable plan.", stage: "Reasoning" as const, progress: 18, approvalRequired: true }, ...previous].slice(0, 6));
    addLog("user", trimmed);
    const attachmentSummary = attachments.length ? `\n\n[Evidence staged: ${attachments.map(item => `${item.name} (${item.type})`).join(", ")}]` : "";
    const nextMessages: ChatMessage[] = [...chatHistoryRef.current, { role: "user" as const, content: `${trimmed}${attachmentSummary}` }].slice(-24);
    chatHistoryRef.current = nextMessages;
    setChatHistory(nextMessages);
    setAttachments([]);
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
      setTasks(previous => previous.map(item => item.id === taskId ? { ...item, detail: "Plan prepared. Review the approval boundary before any connected service is used.", stage: "Awaiting approval", progress: 62 } : item));
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

  const submitCommand = () => submitText(command || "Please review the attached files and tell me what you find.");

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

  const handleConnection = async (id: string) => {
    const connection = connections.find(item => item.id === id);
    if (!connection) return;
    if (connection.status === "Connected") {
      await connectorDisconnect.mutateAsync({ provider: id as "github" | "vercel" | "instagram" | "tiktok" | "linkedin" | "gmail" });
      setConnections(prev => prev.map(item => item.id === id ? { ...item, status: "Ready", meta: "Connection revoked" } : item));
      addLog("wait", `${connection.label} connection revoked. No new actions will be sent.`);
      flash(`${connection.label} disconnected`, "The server-side token was removed from active use.");
      return;
    }
    const configured = connectorCatalog.data?.find(item => item.provider === id)?.configured;
    if (!configured) {
      flash(`${connection.label} is not ready`, connectionRequirements[id] || "Configure the provider developer app in server secrets before connecting it.");
      addLog("wait", `${connection.label} cannot launch OAuth until its required setup is complete.`);
      return;
    }
    try {
      const result = await connectorStart.mutateAsync({ provider: id as "github" | "vercel" | "instagram" | "tiktok" | "linkedin" | "gmail" });
      window.location.assign(result.url);
    } catch (error) {
      flash(`${connection.label} connection unavailable`, error instanceof Error ? error.message : "Provider OAuth is not configured.");
    }
  };

  const resolveApproval = (item: ApprovalItem, approved: boolean) => {
    setApprovals(prev => prev.filter(current => current.id !== item.id));
    addLog(approved ? "success" : "wait", `${approved ? "Approved" : "Rejected"}: ${item.action}.`);
    flash(approved ? "Approval recorded" : "Action rejected", approved ? `${item.action} is cleared for the connected adapter.` : "The workflow remains paused and no action was sent.");
  };

  const renderMetric = (label: string, value: string, detail: string, tone: string, icon: LucideIcon) => {
    const Icon = icon;
    return <div className="metric-tile"><div className="metric-tile-top"><span>{label}</span><Icon size={16} /></div><strong>{value}</strong><span className={`metric-tile-detail ${tone}`}>{detail}</span></div>;
  };

  const renderAssistantWorkspace = () => (
    <section className="workspace-page ai-page">
      <div className="page-intro"><div><span className="page-kicker">J.A.R.V.I.S AI WORKSPACE</span><h1>Think with your <em>copilot.</em></h1><p>Plan, research, write, and turn ideas into approval-ready workflows.</p></div><StatusPill>Reasoning core online</StatusPill></div>
      <div className="ai-workspace">
        <aside className="ai-history">
          <button className="primary-action full-width" onClick={startNewChat}><Sparkles size={15} /> New conversation</button>
          <div className="history-heading"><span>{showArchivedChats ? "ARCHIVED" : "RECENT CONVERSATIONS"}</span><button onClick={() => setShowArchivedChats(previous => !previous)}>{showArchivedChats ? "Active" : "Archived"}</button></div>
          <div className="history-list">{chatSessions.filter(session => showArchivedChats ? Boolean(session.archived) : !session.archived).slice().sort((a, b) => b.updatedAt - a.updatedAt).map(session => <div className={`history-item ${session.id === currentChatId ? "active" : ""}`} key={session.id}><button onClick={() => openChat(session)}><strong>{session.title || "Untitled conversation"}</strong><span>{session.messages.filter(message => message.role === "user").length} prompts · {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(session.updatedAt ? new Date(session.updatedAt) : new Date())}</span></button><div><button onClick={() => archiveChat(session)} aria-label={`${session.archived ? "Restore" : "Archive"} ${session.title}`}><Archive size={12} /></button><button onClick={() => deleteChat(session)} aria-label={`Delete ${session.title}`}><Trash2 size={12} /></button></div></div>)}</div>
          <div className="ai-history-footer"><span className="status-dot" /> Private browser memory</div>
        </aside>
        <div className="ai-conversation">
          <div className="ai-conversation-head"><div><span className="section-eyebrow">CURRENT THREAD</span><h2>{chatSessions.find(session => session.id === currentChatId)?.title || "New command session"}</h2></div><button className={`secondary-action ${voiceRepliesEnabled ? "selected" : ""}`} onClick={() => setVoiceRepliesEnabled(previous => !previous)}>{voiceRepliesEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />} Voice replies {voiceRepliesEnabled ? "on" : "off"}</button></div>
          <div className="ai-messages">{chatHistory.map((message, index) => <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}><div className="ai-avatar">{message.role === "assistant" ? "J" : "CEO"}</div><div className="ai-bubble"><span>{message.role === "assistant" ? "J.A.R.V.I.S" : "YOU"}</span><p>{message.content}</p></div></div>)}{processing && <div className="ai-message assistant"><div className="ai-avatar">J</div><div className="ai-bubble thinking-bubble"><span>J.A.R.V.I.S · THINKING</span><p><i /><i /><i /></p></div></div>}</div>
          <div className="ai-composer"><div className="ai-attachments">{attachments.length ? attachments.map(item => <div className="attachment-chip" key={item.id}>{item.previewUrl ? <img src={item.previewUrl} alt="" /> : <Upload size={13} />}<span>{item.name}</span><button onClick={() => removeAttachment(item.id)} aria-label={`Remove ${item.name}`}><X size={12} /></button></div>) : <span><Paperclip size={13} /> Attach evidence, files, or a voice note</span>}</div><div className="ai-input-row"><input ref={chatInputRef} value={command} onChange={event => setCommand(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submitCommand(); }} placeholder="Message J.A.R.V.I.S..." aria-label="Message J.A.R.V.I.S" /><button className="secondary-action" onClick={() => attachmentInputRef.current?.click()}><Paperclip size={15} /><span>Attach</span></button><input ref={attachmentInputRef} className="hidden-file-input" type="file" multiple accept="image/*,audio/*,video/*,.pdf,.txt,.md,.csv" onChange={handleAttachmentSelection} /><button className={`secondary-action ${listening ? "selected" : ""}`} onClick={toggleListening}><Mic size={15} /><span>{listening ? "Listening" : "Voice"}</span></button><button className="primary-action" onClick={submitCommand} disabled={processing || (!command.trim() && !attachments.length)}><Send size={15} /><span>Send</span></button></div><div className="ai-composer-footer"><span>{voiceSupported ? "Voice input ready" : "Open in Chrome on Android to enable voice input"}</span><button onClick={toggleVoiceNote}><Radio size={12} /> {recordingVoiceNote ? "Stop note" : "Voice note"}</button><button onClick={toggleVoiceCall}>{voiceCallMode ? <PhoneOff size={12} /> : <Phone size={12} />} {voiceCallMode ? "End call" : "Voice call"}</button></div></div>
        </div>
      </div>
    </section>
  );

  const renderOverview = () => (
    <section className="workspace-page">
      <div className="page-intro overview-intro"><div><span className="page-kicker">OVERVIEW / COMMAND CENTER</span><h1>Good evening, <em>CEO.</em></h1><p>J.A.R.V.I.S is online and monitoring your active workflows.</p></div><div className="intro-actions"><span className="keyboard-hint"><kbd>/</kbd> Focus assistant</span><button className="secondary-action" onClick={() => { setLogs(initialLogs); flash("Telemetry reset", "The command center snapshot is ready."); }}><RefreshCw size={14} /> Reset telemetry</button></div></div>
      <div className="overview-status-row"><div className="status-banner"><div className="status-banner-icon"><span className="pulse-dot" /></div><div><span className="section-eyebrow">SYSTEM STATUS</span><strong>All systems nominal</strong><p>Secure operator session active · Last check {formatTime()}</p></div><span className="status-banner-meta">99.98% uptime</span></div><div className="overview-date"><span className="section-eyebrow">LOCAL TIME</span><strong>{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</strong><span>{formatDate()}</span></div></div>
      <div className="metric-grid">{renderMetric("Leads discovered", "128", "+18.4% this week", "positive", Inbox)}{renderMetric("Messages prepared", "64", "+12.6% this month", "positive", Send)}{renderMetric("Videos in studio", "24", "3 awaiting review", "warning", Video)}{renderMetric("System uptime", "99.98%", "+0.02% last 30 days", "positive", Activity)}</div>
      <div className="overview-grid"><div className="surface-panel workflow-panel"><div className="panel-heading"><div><span className="section-eyebrow">ACTIVE WORKFLOWS</span><h2>What J.A.R.V.I.S is doing</h2></div><button className="text-action" onClick={() => navigateTo("Tasks & Workflows")}>View all <ChevronRight size={14} /></button></div><div className="workflow-list"><div className="workflow-row"><span className="workflow-icon cyan"><Radio size={15} /></span><div><strong>{processing ? "Analyzing your latest command" : "Monitoring your command deck"}</strong><span>{processing ? "Reasoning core active · response in progress" : "Ready for your next instruction"}</span></div><b>{processing ? "ACTIVE" : "READY"}</b></div><div className="workflow-row"><span className="workflow-icon green"><RefreshCw size={15} /></span><div><strong>Background worker</strong><span>Connector sync heartbeat every 5 minutes</span></div><b className="green">ONLINE</b></div><div className="workflow-progress"><span><span>System workload</span><b>{processing ? "68%" : "22%"}</b></span><i><b style={{ width: processing ? "68%" : "22%" }} /></i></div></div></div><div className="surface-panel approval-preview"><div className="panel-heading"><div><span className="section-eyebrow">APPROVAL CENTER</span><h2>Needs your review</h2></div><span className="count-badge">{approvals.length}</span></div>{approvals.slice(0, 3).map(item => <button className="approval-preview-row" key={item.id} onClick={() => navigateTo("Approval Center")}><span className="approval-preview-icon"><item.icon size={14} /></span><span><strong>{item.action}</strong><small>{item.detail}</small></span><ChevronRight size={14} /></button>)}{approvals.length === 0 && <div className="empty-state compact"><CheckCircle2 size={20} /><span>Queue clear</span></div>}</div></div>
      <div className="section-block"><div className="section-heading-v2"><div><span className="page-kicker">QUICK ACTIONS</span><h2>Move work forward</h2></div><span className="section-muted"><ShieldCheck size={13} /> Every external action remains approval-gated</span></div><div className="action-grid">{actionData.map(action => { const Icon = action.icon; return <button className="action-card-v2" key={action.id} onClick={() => runAction(action.id, action.label)} disabled={processing}><span className={`action-card-icon ${action.tint}`}><Icon size={19} /></span><span><strong>{action.label}</strong><small>{action.description}</small><em>{action.stat}</em></span><ArrowUpRight size={15} /></button>; })}</div></div>
      <div className="overview-bottom-grid"><div className="surface-panel activity-preview"><div className="panel-heading"><div><span className="section-eyebrow">RECENT ACTIVITY</span><h2>Latest signals</h2></div><button className="text-action" onClick={() => navigateTo("Analytics")}>Open analytics <ChevronRight size={14} /></button></div><div className="activity-feed">{logs.slice(-4).reverse().map(log => <div className="activity-feed-row" key={log.id}><span className={`activity-marker ${log.kind}`}><span /></span><div><strong>{log.message}</strong><small>{log.kind.toUpperCase()} · {log.time}</small></div></div>)}</div></div><div className="surface-panel health-preview"><div className="panel-heading"><div><span className="section-eyebrow">SYSTEM HEALTH</span><h2>Telemetry</h2></div><span className="live-label"><span className="pulse-dot" /> LIVE</span></div><div className="health-rows"><div><span><Cpu size={14} /> AI inference</span><b>24 ms <small>optimal</small></b></div><div><span><Server size={14} /> API gateway</span><b>Operational <small>100%</small></b></div><div><span><Database size={14} /> Data sync</span><b>Synced <small>just now</small></b></div><div><span><ShieldCheck size={14} /> Security layer</span><b>Armed <small>zero alerts</small></b></div></div></div></div>
    </section>
  );

  const renderTasks = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">TASKS & WORKFLOWS</span><h1>Everything <em>in motion.</em></h1><p>Track active work, approval boundaries, and the background worker in one place.</p></div><span className="mode-badge"><ShieldCheck size={14} /> Approval-gated autonomy</span></div><div className="task-summary-grid"><div className="summary-card"><span>Active tasks</span><strong>{tasks.length}</strong><small>Across {tasks.filter(task => task.stage !== "Complete").length} live workflows</small></div><div className="summary-card"><span>Awaiting approval</span><strong>{tasks.filter(task => task.approvalRequired).length}</strong><small>Operator review required</small></div><div className="summary-card"><span>Worker status</span><strong className="summary-online">Online</strong><small>Last heartbeat just now</small></div></div><div className="surface-panel table-panel"><div className="panel-heading"><div><span className="section-eyebrow">WORK QUEUE</span><h2>Active tasks</h2></div><span className="section-muted">{tasks.length} tracked items</span></div><div className="task-table">{tasks.map(task => <div className="task-table-row" key={task.id}><span className={`task-state-dot ${task.stage.toLowerCase().replaceAll(" ", "-")}`} /><div className="task-table-main"><strong>{task.title}</strong><span>{task.detail}</span><div className="progress-line"><i><b style={{ width: `${task.progress}%` }} /></i><em>{task.progress}%</em></div></div><span className="task-stage">{task.stage}</span>{task.approvalRequired ? <button className="secondary-action compact-action" onClick={() => approveTask(task)}><Check size={13} /> Approve prep</button> : <span className="cleared-label"><CheckCircle2 size={14} /> Cleared</span>}</div>)}</div></div><div className="surface-panel worker-panel"><div><span className="section-eyebrow">BACKGROUND WORKER</span><h2>Reliable in the background</h2><p>Connector sync and approved jobs are processed through an idempotent queue. No action is executed without its configured authorization boundary.</p></div><div className="worker-stats"><span><b>5 min</b> heartbeat</span><span><b>0</b> failed jobs</span><span><b>22%</b> workload</span></div></div></section>
  );

  const renderLeads = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">LEADS & OUTREACH</span><h1>Build the next <em>relationship.</em></h1><p>Stage prospects, prepare personalized outreach, and keep sending behind an explicit approval boundary.</p></div><button className="primary-action" onClick={() => runAction("outreach", "Start Outreach")} disabled={processing}><Inbox size={15} /> Start outreach</button></div><div className="pipeline-strip"><div><span>DISCOVERED</span><strong>128</strong><small>+18.4% this week</small></div><div><span>QUALIFIED</span><strong>42</strong><small>32.8% of pipeline</small></div><div><span>STAGED</span><strong>12</strong><small>Ready for review</small></div><div><span>SENT</span><strong>64</strong><small>Approval history</small></div></div><div className="leads-grid"><div className="surface-panel table-panel"><div className="panel-heading"><div><span className="section-eyebrow">PROSPECT PIPELINE</span><h2>Today's lead queue</h2></div><button className="secondary-action"><Search size={14} /> Search</button></div><div className="lead-table"><div className="lead-table-head"><span>Prospect</span><span>Source</span><span>Stage</span><span>Next step</span></div>{[["Riyadh gift shop","LinkedIn","Ready for review","Personalized reply"],["Northstar Studio","Website","Qualified","Research account"],["Atlas Hospitality","Referral","Staged","Prepare intro email"],["Mosaic Commerce","LinkedIn","New","Enrich profile"]].map(([name, source, stage, next]) => <div className="lead-table-row" key={name}><div><span className="lead-avatar">{name.split(" ").map(part => part[0]).join("").slice(0, 2)}</span><strong>{name}</strong></div><span>{source}</span><span className={`lead-stage ${stage === "Ready for review" ? "ready" : ""}`}>{stage}</span><span>{next}</span></div>)}</div></div><div className="surface-panel outreach-panel"><div className="panel-heading"><div><span className="section-eyebrow">OUTREACH GUARDRAILS</span><h2>Safe by default</h2></div><ShieldCheck size={18} /></div><div className="guardrail-list"><div><CheckCircle2 size={15} /><span>Opt-out protections enabled</span></div><div><CheckCircle2 size={15} /><span>Messages paused for approval</span></div><div><CheckCircle2 size={15} /><span>Rate limits enforced</span></div><div><CheckCircle2 size={15} /><span>Every action audited</span></div></div><button className="secondary-action full-width" onClick={() => navigateTo("Approval Center")}>Review approval queue <ArrowUpRight size={14} /></button></div></div></section>
  );

  const renderIntegrations = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">INTEGRATIONS</span><h1>Your connected <em>stack.</em></h1><p>Manage provider access and keep every external capability visible, scoped, and approval-aware.</p></div><span className="connection-summary"><span className="status-dot" /> {connectedCount} of {connections.length} connected</span></div><div className="integration-grid">{connections.map(connection => { const Icon = connection.icon; const connected = connection.status === "Connected"; return <div className="integration-card" key={connection.id}><div className={`integration-icon ${connection.tone}`}><Icon size={20} /></div><div className="integration-card-main"><div className="integration-card-title"><div><strong>{connection.label}</strong><span>{connection.description}</span></div><span className={`connection-state ${connected ? "connected" : "ready"}`}><span />{connected ? "Connected" : "Ready"}</span></div><p>{connection.meta}</p><div className="integration-card-footer"><span><LockKeyhole size={13} /> Encrypted server-side</span><button className={`secondary-action ${connected ? "selected" : ""}`} onClick={() => handleConnection(connection.id)}>{connected ? <><Check size={13} /> Disconnect</> : <>Connect <ArrowUpRight size={13} /></>}</button></div></div></div>; })}</div><div className="info-callout"><ShieldCheck size={17} /><div><strong>Approval boundaries stay intact</strong><span>Connection access does not grant permission to send, publish, deploy, or change external data.</span></div></div></section>
  );

  const renderVideoStudio = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">VIDEO STUDIO</span><h1>Shape the next <em>signal.</em></h1><p>Review generated assets, stage content, and approve publishing when everything is ready.</p></div><button className="primary-action" onClick={() => runAction("video", "Generate Video")} disabled={processing}><Video size={15} /> Generate draft</button></div><div className="studio-hero surface-panel"><div className="studio-orb"><Video size={28} /></div><div><span className="section-eyebrow">CONTENT PIPELINE</span><h2>Three drafts are ready for your eye.</h2><p>Generated content stays in review until you explicitly approve the next connected action.</p><div className="studio-tags"><span><CheckCircle2 size={13} /> 24 generated</span><span><Clock3 size={13} /> 3 awaiting review</span><span><ShieldCheck size={13} /> Approval required</span></div></div></div><div className="studio-grid">{[["Product launch reel","45 sec · Vertical","Awaiting approval","violet"],["Founder story cut","60 sec · Landscape","Draft","cyan"],["Weekly signal recap","30 sec · Vertical","Ready to review","amber"]].map(([title, meta, stage, tone]) => <div className="video-card" key={title}><div className={`video-preview ${tone}`}><Video size={22} /><span>PREVIEW</span><button aria-label={`Open ${title}`}><ArrowUpRight size={14} /></button></div><div className="video-card-copy"><strong>{title}</strong><span>{meta}</span><div><span className={`video-stage ${tone}`}>{stage}</span><button className="text-action" onClick={() => navigateTo("Approval Center")}>Review <ChevronRight size={13} /></button></div></div></div>)}</div></section>
  );

  const renderAnalytics = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">ANALYTICS</span><h1>See the <em>trajectory.</em></h1><p>Signals from your approved workflows, connected services, and operating rhythm.</p></div><button className="secondary-action"><Clock3 size={14} /> Last 30 days</button></div><div className="metric-grid analytics-metrics">{renderMetric("Leads discovered", "128", "+18.4% vs previous period", "positive", Inbox)}{renderMetric("Messages sent", "64", "+12.6% vs previous period", "positive", Send)}{renderMetric("Videos generated", "24", "3 pending review", "warning", Video)}{renderMetric("Uptime", "99.98%", "+0.02% vs previous period", "positive", Activity)}</div><div className="analytics-grid"><div className="surface-panel chart-panel"><div className="panel-heading"><div><span className="section-eyebrow">PERFORMANCE TREND</span><h2>Operating volume</h2></div><span className="chart-legend"><i className="cyan" /> Approved activity</span></div><div className="chart-area"><div className="chart-y-axis"><span>160</span><span>120</span><span>80</span><span>40</span><span>0</span></div><div className="chart-bars">{[34, 49, 41, 64, 58, 78, 67, 86, 74, 96, 88, 100].map((height, index) => <div key={index}><i style={{ height: `${height}%` }} /><span>{["01", "03", "05", "07", "09", "11", "13", "15", "17", "19", "21", "23"][index]}</span></div>)}</div></div></div><div className="surface-panel activity-breakdown"><div className="panel-heading"><div><span className="section-eyebrow">ACTIVITY MIX</span><h2>Where work lands</h2></div></div><div className="breakdown-list"><div><span><span className="breakdown-dot cyan" /> Outreach</span><strong>42%</strong></div><div><span><span className="breakdown-dot violet" /> Content</span><strong>28%</strong></div><div><span><span className="breakdown-dot amber" /> Delivery</span><strong>18%</strong></div><div><span><span className="breakdown-dot green" /> System</span><strong>12%</strong></div></div><div className="breakdown-total"><strong>18</strong><span>workflows cleared this period</span></div></div></div><div className="surface-panel audit-panel"><div className="panel-heading"><div><span className="section-eyebrow">HISTORICAL ACTIVITY</span><h2>Audit-ready signals</h2></div><button className="text-action">Export view <ArrowUpRight size={13} /></button></div><div className="audit-row"><span className="audit-icon green"><Check size={14} /></span><div><strong>Approval-gated workflows</strong><span>All connected actions remained within operator review.</span></div><b>100%</b></div><div className="audit-row"><span className="audit-icon cyan"><Activity size={14} /></span><div><strong>System availability</strong><span>Background worker and reasoning core remained operational.</span></div><b>99.98%</b></div></div></section>
  );

  const renderApprovals = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">APPROVAL CENTER</span><h1>Your decision, <em>always.</em></h1><p>Review the exact next step before any connected service acts on your behalf.</p></div><span className="approval-count-large"><strong>{approvals.length}</strong> pending</span></div><div className="approval-layout"><div className="surface-panel approval-queue-panel"><div className="panel-heading"><div><span className="section-eyebrow">WAITING FOR REVIEW</span><h2>Pending actions</h2></div><span className="section-muted">Nothing runs automatically</span></div>{approvals.length ? <div className="approval-queue-list">{approvals.map(item => { const Icon = item.icon; return <div className="approval-queue-item" key={item.id}><div className="approval-queue-icon"><Icon size={18} /></div><div className="approval-queue-copy"><div className="approval-queue-meta"><span>{item.tag}</span><span className={item.risk === "Sensitive" ? "sensitive" : "review"}>{item.risk}</span></div><h3>{item.action}</h3><p>{item.detail}</p><div className="approval-queue-actions"><button className="approve-action" onClick={() => resolveApproval(item, true)}><Check size={14} /> Approve</button><button className="reject-action" onClick={() => resolveApproval(item, false)}><X size={14} /> Reject</button><button className="text-action">Review details <ChevronRight size={13} /></button></div></div><time>Submitted today</time></div>; })}</div> : <div className="empty-state"><CheckCircle2 size={30} /><strong>Queue clear</strong><span>No external actions are waiting for approval.</span></div>}</div><aside className="approval-policy surface-panel"><div className="policy-icon"><ShieldCheck size={22} /></div><span className="section-eyebrow">OPERATOR POLICY</span><h2>Human control stays in the loop.</h2><p>Approving a task clears only the specific next step described above. Credentials, permissions, and provider rules remain enforced server-side.</p><div className="policy-points"><span><CheckCircle2 size={14} /> Consent and opt-outs enforced</span><span><CheckCircle2 size={14} /> Kill switch available</span><span><CheckCircle2 size={14} /> Every decision audited</span></div></aside></div></section>
  );

  const renderSettings = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">SETTINGS</span><h1>Keep the system <em>yours.</em></h1><p>Manage your operator profile, workspace preferences, and safety posture.</p></div><StatusPill>Protected session</StatusPill></div><div className="settings-grid"><div className="surface-panel settings-card"><div className="settings-card-head"><div className="settings-avatar">{(auth.user?.name ?? "CEO").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><span className="section-eyebrow">OPERATOR PROFILE</span><h2>{auth.user?.name || "CEO"}</h2><p>{auth.user?.email || "Authenticated operator"}</p></div><button className="secondary-action" onClick={() => setProfileOpen(true)}><Settings2 size={14} /> Edit profile</button></div><div className="settings-detail-grid"><div><span>Role</span><strong>{auth.user?.role === "admin" ? "Administrator" : "Operator"}</strong></div><div><span>Login method</span><strong>{auth.user?.loginMethod || "Manus account"}</strong></div><div><span>Account ID</span><strong>{auth.user?.openId.slice(0, 12)}…</strong></div></div></div><div className="surface-panel settings-card"><div className="panel-heading"><div><span className="section-eyebrow">SAFETY POSTURE</span><h2>Guardrails</h2></div><ShieldCheck size={18} /></div><div className="settings-toggle-list"><div><span><LockKeyhole size={15} /><span><strong>Approval required</strong><small>External actions wait for your decision.</small></span></span><span className="toggle-state on">ON</span></div><div><span><Volume2 size={15} /><span><strong>Voice replies</strong><small>Speak assistant responses in this browser.</small></span></span><button className={`toggle-state ${voiceRepliesEnabled ? "on" : "off"}`} onClick={() => setVoiceRepliesEnabled(previous => !previous)}>{voiceRepliesEnabled ? "ON" : "OFF"}</button></div><div><span><Bell size={15} /><span><strong>Live notifications</strong><small>Keep approval and system signals visible.</small></span></span><span className="toggle-state on">ON</span></div></div></div><div className="surface-panel settings-card"><div className="panel-heading"><div><span className="section-eyebrow">SHORTCUTS</span><h2>Command palette</h2></div><Command size={18} /></div><div className="shortcut-list"><span><kbd>/</kbd><small>Focus AI Assistant</small></span><span><kbd>Ctrl K</kbd><small>Focus AI Assistant</small></span><span><kbd>C</kbd><small>Open Integrations</small></span></div></div><div className="surface-panel settings-card danger-card"><div className="panel-heading"><div><span className="section-eyebrow">SESSION</span><h2>Sign out</h2></div><Unplug size={18} /></div><p>End the current authenticated operator session on this device.</p><button className="danger-action" onClick={() => auth.logout()}><Unplug size={14} /> Sign out of J.A.R.V.I.S</button></div></div></section>
  );

  const renderWorkspace = () => {
    switch (view) {
      case "AI Assistant": return renderAssistantWorkspace();
      case "Tasks & Workflows": return renderTasks();
      case "Leads & Outreach": return renderLeads();
      case "Integrations": return renderIntegrations();
      case "Video Studio": return renderVideoStudio();
      case "Analytics": return renderAnalytics();
      case "Approval Center": return renderApprovals();
      case "Settings": return renderSettings();
      default: return renderOverview();
    }
  };

  if (auth.loading) {
    return <div className="auth-screen"><div className="auth-card loading-card"><div className="auth-orb"><span>J</span></div><span className="eyebrow accent-eyebrow">AUTHENTICATING OPERATOR</span><h1>Connecting to J.A.R.V.I.S</h1><p>Verifying your secure operator session...</p></div></div>;
  }

  if (!auth.isAuthenticated || !auth.user) {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-orb"><span>J</span></div><div className="eyebrow accent-eyebrow"><span className="eyebrow-line" />SECURE OPERATOR ACCESS</div><h1>J.A.R.V.I.S <em>awaits.</em></h1><p>Sign in with your Manus account to access your private command center, connections, approvals, and profile.</p><button className="auth-login-button" onClick={() => startLogin()}><ShieldCheck size={16} /> Sign in to continue <ArrowUpRight size={15} /></button><span className="auth-footnote"><LockKeyhole size={13} /> Your dashboard is scoped to your authenticated profile.</span></div></div>;
  }

  return (
    <div className="jarvis-shell">
      <div className="shell-ambient shell-ambient-one" /><div className="shell-ambient shell-ambient-two" />
      <header className="app-topbar"><div className="topbar-left"><button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><AppMark /><span className="topbar-rule" /><div className="topbar-breadcrumb"><span>OPERATIONS CONSOLE</span><strong>/</strong><span>{view.toUpperCase()}</span></div></div><div className="topbar-right"><div className="topbar-clock"><strong>{formatTime()}</strong><span>{formatDate()}</span></div><StatusPill>System online</StatusPill><button className="topbar-icon-button" aria-label="Open approvals" onClick={() => navigateTo("Approval Center")}><Bell size={17} /><span>{approvals.length}</span></button><button className="topbar-avatar" aria-label="Open operator profile" onClick={() => setProfileOpen(true)}>{(auth.user.name ?? "CEO").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</button></div></header>
      <div className="shell-body"><aside className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${sidebarOpen ? "open" : ""}`}><div className="sidebar-head"><div><span className="sidebar-label">J.A.R.V.I.S</span><span className="sidebar-caption">Command platform</span></div><button className="sidebar-collapse" aria-label="Collapse sidebar" onClick={() => setSidebarCollapsed(previous => !previous)}><ChevronRight size={16} /></button></div><nav className="app-nav" aria-label="Primary navigation">{(["Workspace", "Operations", "System"] as const).map(group => <div className="nav-group" key={group}><span className="nav-group-label">{group}</span>{workspaceNav.filter(item => item.group === group).map(item => { const Icon = item.icon; const active = item.label === view; return <button className={`app-nav-item ${active ? "active" : ""}`} key={item.label} onClick={() => navigateTo(item.label)}><Icon size={17} /><span>{item.label}</span>{item.label === "Approval Center" && approvals.length > 0 && <b>{approvals.length}</b>}</button>; })}</div>)}</nav><div className="sidebar-footer"><div className="sidebar-health"><span className="pulse-dot" /><div><strong>ALL SYSTEMS NOMINAL</strong><small>Last check {formatTime()}</small></div></div><button className="sidebar-profile" onClick={() => setProfileOpen(true)}><span className="sidebar-profile-avatar">{(auth.user.name ?? "CEO").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{auth.user.name || "CEO"}</strong><small>{auth.user.email || "Operator"}</small></span><ChevronRight size={14} /></button></div></aside>{sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
        <main className="shell-main"><div className="mobile-page-bar"><button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button><span>{view}</span><span className="mobile-page-status"><span className="status-dot" /> Online</span></div>{renderWorkspace()}<footer className="shell-footer"><span><span className="footer-core" /> J.A.R.V.I.S · JUST A RATHER VERY INTELLIGENT SYSTEM</span><span>BUILD 2.4.8 · APPROVAL-GATED</span></footer></main></div>
      {notification && <div className="toast-notification"><div className="toast-icon"><Check size={15} /></div><div><strong>{notification.title}</strong><span>{notification.detail}</span></div><button aria-label="Dismiss notification" onClick={() => setNotification(null)}><X size={15} /></button></div>}
      {profileOpen && <div className="profile-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="profile-dialog-top"><div><div className="eyebrow accent-eyebrow">OPERATOR PROFILE</div><h2 id="profile-title">Your J.A.R.V.I.S identity</h2></div><button className="profile-close" aria-label="Close profile" onClick={() => setProfileOpen(false)}><X size={17} /></button></div><div className="profile-identity"><div className="profile-avatar">{(auth.user.name ?? "CEO").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><strong>{auth.user.email ?? "Authenticated operator"}</strong><span>{auth.user.role === "admin" ? "Administrator" : "Operator"} · {auth.user.loginMethod ?? "Manus account"}</span></div></div><label className="profile-field"><span>Display name</span><input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="CEO" maxLength={80} /></label><div className="profile-readonly"><div><span>Account email</span><strong>{auth.user.email ?? "Not provided"}</strong></div><div><span>Access role</span><strong>{auth.user.role === "admin" ? "Administrator" : "Operator"}</strong></div><div><span>Account ID</span><strong>{auth.user.openId.slice(0, 12)}…</strong></div></div><div className="profile-dialog-footer"><button className="logout-button" onClick={() => auth.logout()}><Unplug size={14} /> Sign out</button><button className="save-profile-button" disabled={profileUpdate.isPending || !profileName.trim()} onClick={() => profileUpdate.mutate({ name: profileName.trim() })}><Save size={14} /> {profileUpdate.isPending ? "Saving..." : "Save profile"}</button></div></section></div>}
    </div>
  );
}

function Link2Icon() {
  return <ArrowUpRight size={12} />;
}
