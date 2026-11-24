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
type ConnectionStatus = "Connected" | "Not connected" | "Setup required" | "Pending" | "Error" | "Simulated";

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
  status: string;
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

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
  | { type: "file_url"; file_url: { url: string; mime_type?: string } };
type ChatMessage = { role: "user" | "assistant"; content: string | ChatContentPart[] };
type TaskStage = "Pending" | "Running" | "Reasoning" | "Preparing" | "Awaiting approval" | "Approved" | "Complete" | "Failed" | "Cancelled";
type TaskItem = { id: string; title: string; detail: string; stage: TaskStage; progress: number; approvalRequired: boolean };
type LocalAttachment = { id: string; name: string; type: string; size: number; dataUrl: string; previewUrl?: string };
type ChatSession = { id: string; title: string; updatedAt: number; messages: ChatMessage[]; archived?: boolean };

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const readBlobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error ?? new Error("Could not read attachment"));
  reader.readAsDataURL(blob);
});
const chatMessageText = (content: ChatMessage["content"]) => typeof content === "string"
  ? content
  : content.filter(part => part.type === "text").map(part => part.type === "text" ? part.text : "").join("\n");

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

const initialLogs: LogEntry[] = [];

const initialConnections: Connection[] = [
  { id: "gmail", label: "Gmail", description: "Inbox, drafts & outbound mail", meta: "Provider setup required", status: "Setup required", icon: Mail, tone: "coral" },
  { id: "github", label: "GitHub", description: "Repos, branches & pull requests", meta: "Provider setup required", status: "Setup required", icon: Github, tone: "violet" },
  { id: "vercel", label: "Vercel", description: "Projects, builds & deployments", meta: "Provider setup required", status: "Setup required", icon: Globe2, tone: "slate" },
  { id: "linkedin", label: "LinkedIn", description: "Lead discovery & prospect lists", meta: "No supported adapter configured", status: "Setup required", icon: Linkedin, tone: "blue" },
  { id: "apify", label: "Apify", description: "Actor runs & lead discovery", meta: "API token required", status: "Setup required", icon: Code2, tone: "amber" },
  { id: "n8n", label: "n8n", description: "Workflow orchestration & webhooks", meta: "Webhook URL required · execution adapter pending", status: "Setup required", icon: Network, tone: "violet" },
  { id: "openai", label: "Managed reasoning", description: "Reasoning, copy & structured output", meta: "Provided by the application runtime", status: "Connected", icon: Sparkles, tone: "mint" },
  { id: "video", label: "Video stack", description: "Generate, review & publish content", meta: "No video provider configured", status: "Setup required", icon: Video, tone: "amber" },
];

const actionData = [
  { id: "outreach", label: "Start Outreach", description: "Requires a connected lead and outreach adapter", icon: Inbox, stat: "Not connected", tint: "cyan" },
  { id: "video", label: "Generate Video", description: "Requires a configured video provider", icon: Video, stat: "Setup required", tint: "violet" },
  { id: "deploy", label: "Deploy Project", description: "Requires an approved deployment workflow", icon: Rocket, stat: "Not connected", tint: "amber" },
];

const connectionRequirements: Record<string, string> = {
  gmail: "Gmail adapter pending · Google OAuth app required",
  github: "Missing GITHUB_CLIENT_ID / SECRET or PUBLIC_APP_URL",
  vercel: "Missing VERCEL_CLIENT_ID / SECRET or PUBLIC_APP_URL",
  linkedin: "LinkedIn developer app + approved OAuth scopes required",
  apify: "Save APIFY_API_TOKEN in the API Vault",
  n8n: "Save N8N_API_KEY and N8N_WEBHOOK_URL in Settings → API Vault",
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
  const environmentQuery = trpc.environment.list.useQuery();
  const environmentUpdate = trpc.environment.update.useMutation({
    onSuccess: async result => {
      await environmentQuery.refetch();
      await activityQuery.refetch();
      setEnvironmentSaveMessage(result.message);
      setEnvironmentValues({ OPENAI_API_KEY: "", APIFY_API_TOKEN: "", N8N_API_KEY: "", N8N_WEBHOOK_URL: "" });
      flash("API Vault updated", "The submitted values were encrypted server-side and masked in the dashboard.");
    },
    onError: error => flash("API Vault update failed", error.message),
  });
  const environmentRemove = trpc.environment.remove.useMutation({ onSuccess: async (_result, variables) => { await environmentQuery.refetch(); await activityQuery.refetch(); flash("Credential removed", `${variables.name} was removed from your API Vault.`); }, onError: error => flash("Credential could not be removed", error.message) });
  const activityQuery = trpc.workflows.activity.list.useQuery();
  const activityRecord = trpc.workflows.activity.record.useMutation({ onSuccess: () => void activityQuery.refetch() });
  const workflowTasksQuery = trpc.workflows.tasks.list.useQuery();
  const workflowTaskCreate = trpc.workflows.tasks.create.useMutation({ onSuccess: async () => { await workflowTasksQuery.refetch(); setNewTaskTitle(""); setNewTaskDetail(""); flash("Task saved", "The task was persisted to your workspace."); }, onError: error => flash("Task could not be saved", error.message) });
  const workflowTaskUpdate = trpc.workflows.tasks.update.useMutation({ onSuccess: async () => { await workflowTasksQuery.refetch(); }, onError: error => flash("Task update failed", error.message) });
  const workflowTaskDelete = trpc.workflows.tasks.delete.useMutation({ onSuccess: async () => { await workflowTasksQuery.refetch(); flash("Task deleted", "The task was removed from your workspace."); }, onError: error => flash("Task could not be deleted", error.message) });
  const approvalsQuery = trpc.workflows.approvals.list.useQuery();
  const approvalDecide = trpc.workflows.approvals.decide.useMutation({
    onSuccess: async () => {
      await approvalsQuery.refetch();
      await activityQuery.refetch();
    },
  });
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
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalItem[]>([]);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastAction, setLastAction] = useState("SYSTEM READY");
  const [notification, setNotification] = useState<{ title: string; detail: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [environmentValues, setEnvironmentValues] = useState({ OPENAI_API_KEY: "", APIFY_API_TOKEN: "", N8N_API_KEY: "", N8N_WEBHOOK_URL: "" });
  const [environmentSaveMessage, setEnvironmentSaveMessage] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(loadChatSessions);
  const [currentChatId, setCurrentChatId] = useState(() => loadChatSessions()[0]?.id ?? "current");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => loadChatSessions()[0]?.messages ?? [welcomeMessage]);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(false);
  const [voiceCallMode, setVoiceCallMode] = useState(false);
  const [recordingVoiceNote, setRecordingVoiceNote] = useState(false);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDetail, setNewTaskDetail] = useState("");
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
      const firstUserMessage = chatMessageText(chatHistory.find(message => message.role === "user")?.content ?? "").replace(/\n\n\[Evidence (?:staged|attached):[\s\S]*$/, "") || "New command session";
      const persistedMessages = chatHistory.map(message => ({ ...message, content: chatMessageText(message.content) }));
      const updated = previous.some(session => session.id === currentChatId)
        ? previous.map(session => session.id === currentChatId ? { ...session, title: session.title === "New command session" ? firstUserMessage.slice(0, 46) : session.title, updatedAt: Date.now(), messages: persistedMessages } : session)
        : [{ id: currentChatId, title: firstUserMessage.slice(0, 46), updatedAt: Date.now(), messages: persistedMessages }, ...previous];
      window.localStorage.setItem("jarvis-chat-sessions", JSON.stringify(updated.slice(0, 12)));
      return updated.slice(0, 12);
    });
  }, [chatHistory, currentChatId]);

  useEffect(() => {
    setConnections(previous => previous.map(connection => {
      if (connection.id === "openai") return { ...connection, status: "Setup required", meta: "Application-managed model route; live health is not probed. Vault OpenAI key is not yet used for chat." };
      if (connection.id === "video") return { ...connection, status: "Setup required", meta: "No video provider adapter is configured" };
      const catalogRecord = connectorCatalog.data?.find(item => item.provider === connection.id);
      const record = connectorList.data?.find(item => item.provider === connection.id);
      if (record?.status === "connected") return { ...connection, status: "Connected", meta: record.accountLabel || "Connected account" };
      if (record?.status === "pending") return { ...connection, status: "Pending", meta: "OAuth connection is pending" };
      if (record?.status === "error") return { ...connection, status: "Error", meta: "The last connection attempt failed" };
      return { ...connection, status: catalogRecord?.configured ? "Not connected" : "Setup required", meta: catalogRecord?.configured ? "OAuth is configured; connect an account" : connectionRequirements[connection.id] || "Provider configuration required" };
    }));
  }, [connectorCatalog.data, connectorList.data]);

  useEffect(() => {
    if (!activityQuery.data) return;
    setLogs(activityQuery.data.map(event => ({
      id: event.id,
      time: new Date(event.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      kind: (event.kind as LogKind) || "info",
      message: event.message,
    })));
  }, [activityQuery.data]);

  useEffect(() => {
    if (!workflowTasksQuery.data) return;
    setTasks(workflowTasksQuery.data.map(task => ({
      id: String(task.id),
      title: task.title,
      detail: task.detail,
      stage: task.status === "running" ? "Running" : task.status === "completed" ? "Complete" : task.status === "failed" ? "Failed" : task.status === "cancelled" ? "Cancelled" : task.status === "approved" ? "Approved" : task.status === "awaiting_approval" ? "Awaiting approval" : "Pending",
      progress: task.progress,
      approvalRequired: Boolean(task.approvalRequired),
    })));
  }, [workflowTasksQuery.data]);

  useEffect(() => {
    if (!approvalsQuery.data) return;
    const mappedApprovals = approvalsQuery.data.map(item => ({
      id: String(item.id),
      action: item.action,
      detail: item.detail,
      tag: item.tag,
      risk: item.risk === "sensitive" ? "Sensitive" as const : "Review" as const,
      status: item.status,
      icon: item.tag.toLowerCase().includes("content") ? Video : item.tag.toLowerCase().includes("deploy") ? Rocket : Mail,
    }));
    setApprovals(mappedApprovals.filter(item => item.status === "pending"));
    setApprovalHistory(mappedApprovals.filter(item => item.status !== "pending"));
  }, [approvalsQuery.data]);

  useEffect(() => {
    const apify = environmentQuery.data?.find(item => item.name === "APIFY_API_TOKEN");
    if (!apify) return;
    setConnections(previous => previous.map(connection => connection.id === "apify"
      ? { ...connection, status: "Setup required", meta: apify.configured ? "Token saved; provider identity and actor execution are not verified" : "API token required" }
      : connection));
  }, [environmentQuery.data]);

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
    activityRecord.mutate({ kind, message });
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

  const approveTask = async (task: TaskItem) => {
    try {
      await workflowTaskUpdate.mutateAsync({ id: Number(task.id), approvalRequired: false });
      addLog("success", `Preparation approved for task: ${task.title}. No workflow execution was started.`);
      flash("Preparation approved", `${task.title} is cleared for preparation only. External execution remains adapter-gated.`);
    } catch (error) {
      flash("Approval could not be saved", error instanceof Error ? error.message : "The task service is unavailable.");
    }
  };

  const createTask = () => {
    const title = newTaskTitle.trim();
    const detail = newTaskDetail.trim();
    if (!title || !detail) { flash("Task details required", "Enter both a task title and a short description."); return; }
    workflowTaskCreate.mutate({ title, detail, approvalRequired: true });
  };

  const editTask = async (task: TaskItem) => {
    const title = window.prompt("Edit task title", task.title);
    if (title === null) return;
    const detail = window.prompt("Edit task description", task.detail);
    if (detail === null) return;
    if (!title.trim() || !detail.trim()) { flash("Invalid task", "Title and description cannot be empty."); return; }
    try {
      await workflowTaskUpdate.mutateAsync({ id: Number(task.id), title: title.trim(), detail: detail.trim() });
      flash("Task updated", "Your changes were saved.");
    } catch {
      // The mutation error handler displays the backend failure.
    }
  };

  const updateTaskStatus = (task: TaskItem, status: "completed" | "cancelled" | "failed") => {
    workflowTaskUpdate.mutate({ id: Number(task.id), status, progress: status === "completed" ? 100 : task.progress });
  };

  const handleAttachmentSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 5);
    const acceptedFiles = files.filter(file => file.size <= MAX_ATTACHMENT_BYTES);
    const rejectedCount = files.length - acceptedFiles.length;
    try {
      const nextAttachments = await Promise.all(acceptedFiles.map(async file => ({
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: await readBlobAsDataUrl(file),
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })));
      setAttachments(previous => [...previous, ...nextAttachments].slice(-5));
      if (nextAttachments.length) flash("Evidence staged", `${nextAttachments.length} file${nextAttachments.length === 1 ? "" : "s"} ready for J.A.R.V.I.S to inspect.`);
      if (rejectedCount) flash("Some files were skipped", `Files must be 8 MB or smaller. ${rejectedCount} file${rejectedCount === 1 ? " was" : "s were"} not staged.`);
    } catch {
      flash("Attachment failed", "J.A.R.V.I.S could not read one of those files in this browser.");
    }
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
      recorder.onstop = async () => {
        const blob = new Blob(voiceNoteChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size <= MAX_ATTACHMENT_BYTES) {
          const dataUrl = await readBlobAsDataUrl(blob);
          setAttachments(previous => [...previous, { id: `voice-${Date.now()}`, name: `voice-note-${new Date().toISOString().slice(11, 19).replaceAll(":", "-")}.webm`, type: blob.type, size: blob.size, dataUrl, previewUrl: URL.createObjectURL(blob) }].slice(-5));
        } else {
          flash("Voice note too large", "Keep voice notes under 8 MB so J.A.R.V.I.S can inspect them.");
        }
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
    setHistory(prev => [label, ...prev].slice(0, 5));
    setLastAction("NO EXECUTION ADAPTER");
    flash(`${label} unavailable`, id === "outreach"
      ? "No lead or outreach backend is connected yet. Nothing was scraped or sent."
      : id === "video"
        ? "No video provider is configured. No draft was generated."
        : "No deployment workflow is connected. Nothing was pushed or deployed.");
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
  const toggleVoiceReplies = () => {
    setVoiceRepliesEnabled(previous => {
      const next = !previous;
      if (!next && "speechSynthesis" in window) window.speechSynthesis.cancel();
      return next;
    });
  };
  const buildAttachmentPart = (attachment: LocalAttachment): ChatContentPart => attachment.type.startsWith("image/")
    ? { type: "image_url", image_url: { url: attachment.dataUrl, detail: "auto" } }
    : { type: "file_url", file_url: { url: attachment.dataUrl, mime_type: attachment.type } };

  const submitText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || processingRef.current) return;
    setCommand("");
    if (!attachments.length && /^(hi|hii|hey|hello|good morning|good afternoon|good evening)[!.?\s]*$/i.test(trimmed)) {
      const nextMessages: ChatMessage[] = [...chatHistoryRef.current, { role: "user" as const, content: trimmed }, { role: "assistant" as const, content: "Hey Abubakar! I’m here and ready. How are you doing, and what do we have today?" }].slice(-24);
      chatHistoryRef.current = nextMessages;
      setChatHistory(nextMessages);
      setHistory(previous => [trimmed, ...previous].slice(0, 5));
      addLog("user", trimmed);
      speakAssistant("Hey Abubakar! I’m here and ready. How are you doing, and what do we have today?");
      return;
    }
    setHistory(prev => [trimmed, ...prev].slice(0, 5));
    addLog("user", trimmed);
    const attachmentSummary = attachments.length ? `\n\n[Evidence attached: ${attachments.map(item => `${item.name} (${item.type})`).join(", ")}]` : "";
    const userContent: ChatMessage["content"] = attachments.length
      ? [{ type: "text", text: `${trimmed}${attachmentSummary}` }, ...attachments.map(buildAttachmentPart)]
      : `${trimmed}${attachmentSummary}`;
    const nextMessages: ChatMessage[] = [...chatHistoryRef.current, { role: "user" as const, content: userContent }].slice(-24);
    chatHistoryRef.current = nextMessages;
    setChatHistory(nextMessages);
    setAttachments([]);
    processingRef.current = true;
    setProcessing(true);
    setLastAction("J.A.R.V.I.S IS THINKING");
    addLog("info", "Processing command through the J.A.R.V.I.S reasoning core. No external workflow was started.");
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
      flash("J.A.R.V.I.S responded", "The response was generated. No external action was taken.");
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
    if (id === "apify" || id === "n8n") { navigateTo("Settings"); flash("API Vault", "Add or update the provider credentials in Settings."); return; }
    if (id === "openai" || id === "video") {
      flash(connection.label, id === "openai" ? "This capability is provided by the application runtime, not a user connector." : id === "apify" ? "Configure Apify from Settings → API Vault. This card never handles the token directly." : "No video provider adapter is configured, so there is nothing to connect.");
      return;
    }
    if (connection.status === "Connected") {
      await connectorDisconnect.mutateAsync({ provider: id as "github" | "vercel" | "instagram" | "tiktok" | "linkedin" | "gmail" });
      setConnections(prev => prev.map(item => item.id === id ? { ...item, status: "Not connected", meta: "Connection revoked" } : item));
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

  const resolveApproval = async (item: ApprovalItem, approved: boolean) => {
    try {
      await approvalDecide.mutateAsync({ id: Number(item.id), status: approved ? "approved" : "rejected" });
      flash(approved ? "Approval recorded" : "Action rejected", approved ? `${item.action} is approved, but execution is tracked separately and has not been claimed complete.` : "The workflow remains paused and no action was sent.");
    } catch (error) {
      flash("Approval could not be saved", error instanceof Error ? error.message : "The approval service is unavailable.");
    }
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
          <div className="ai-conversation-head"><div><span className="section-eyebrow">CURRENT THREAD</span><h2>{chatSessions.find(session => session.id === currentChatId)?.title || "New command session"}</h2></div><button className={`secondary-action ${voiceRepliesEnabled ? "selected" : ""}`} onClick={toggleVoiceReplies}>{voiceRepliesEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />} Voice replies {voiceRepliesEnabled ? "on" : "off"}</button></div>
          <div className="ai-messages">{chatHistory.map((message, index) => <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}><div className="ai-avatar">{message.role === "assistant" ? "J" : "CEO"}</div><div className="ai-bubble"><span>{message.role === "assistant" ? "J.A.R.V.I.S" : "YOU"}</span><p>{chatMessageText(message.content)}</p>{Array.isArray(message.content) && message.content.some(part => part.type !== "text") && <small className="message-attachment-note">Attachment content included for analysis</small>}</div></div>)}{processing && <div className="ai-message assistant"><div className="ai-avatar">J</div><div className="ai-bubble thinking-bubble"><span>J.A.R.V.I.S · THINKING</span><p><i /><i /><i /></p></div></div>}</div>
          <div className="ai-composer"><div className="ai-attachments">{attachments.length ? attachments.map(item => <div className="attachment-chip" key={item.id}>{item.previewUrl ? <img src={item.previewUrl} alt="" /> : <Upload size={13} />}<span>{item.name}</span><button onClick={() => removeAttachment(item.id)} aria-label={`Remove ${item.name}`}><X size={12} /></button></div>) : <span><Paperclip size={13} /> Attach evidence, files, or a voice note</span>}</div><div className="ai-input-row"><input ref={chatInputRef} value={command} onChange={event => setCommand(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submitCommand(); }} placeholder="Message J.A.R.V.I.S..." aria-label="Message J.A.R.V.I.S" /><button className="secondary-action" onClick={() => attachmentInputRef.current?.click()}><Paperclip size={15} /><span>Attach</span></button><input ref={attachmentInputRef} className="hidden-file-input" type="file" multiple accept="image/*,audio/*,video/*,.pdf,.txt,.md,.csv,.json,.xml,.html,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleAttachmentSelection} /><button className={`secondary-action ${listening ? "selected" : ""}`} onClick={toggleListening}><Mic size={15} /><span>{listening ? "Listening" : "Voice"}</span></button><button className="primary-action" onClick={submitCommand} disabled={processing || (!command.trim() && !attachments.length)}><Send size={15} /><span>Send</span></button></div><div className="ai-composer-footer"><span>{voiceSupported ? "Voice input ready" : "Open in Chrome on Android to enable voice input"}</span><button onClick={toggleVoiceNote}><Radio size={12} /> {recordingVoiceNote ? "Stop note" : "Voice note"}</button><button onClick={toggleVoiceCall}>{voiceCallMode ? <PhoneOff size={12} /> : <Phone size={12} />} {voiceCallMode ? "End call" : "Voice call"}</button></div></div>
        </div>
      </div>
    </section>
  );

  const renderOverview = () => (
    <section className="workspace-page">
      <div className="page-intro overview-intro"><div><span className="page-kicker">OVERVIEW / COMMAND CENTER</span><h1>Good evening, <em>CEO.</em></h1><p>J.A.R.V.I.S is available for instructions. Operational telemetry is not configured yet.</p></div><div className="intro-actions"><span className="keyboard-hint"><kbd>/</kbd> Focus assistant</span><button className="secondary-action" onClick={() => { void connectorCatalog.refetch(); void connectorList.refetch(); flash("Status refreshed", "Only verified connector configuration is shown."); }}><RefreshCw size={14} /> Refresh status</button></div></div>
      <div className="overview-status-row"><div className="status-banner"><div className="status-banner-icon"><span className="pulse-dot" /></div><div><span className="section-eyebrow">SYSTEM STATUS</span><strong>Telemetry not configured</strong><p>Secure operator session active · Last checked {formatTime()}</p></div><span className="status-banner-meta">UNVERIFIED</span></div><div className="overview-date"><span className="section-eyebrow">LOCAL TIME</span><strong>{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</strong><span>{formatDate()}</span></div></div>
      <div className="metric-grid">{renderMetric("Leads discovered", "—", "No lead data connected", "warning", Inbox)}{renderMetric("Messages prepared", "—", "No outreach data connected", "warning", Send)}{renderMetric("Videos in studio", "—", "No video provider configured", "warning", Video)}{renderMetric("System uptime", "—", "No uptime monitor configured", "warning", Activity)}</div>
      <div className="overview-grid"><div className="surface-panel workflow-panel"><div className="panel-heading"><div><span className="section-eyebrow">ACTIVE WORKFLOWS</span><h2>What J.A.R.V.I.S is doing</h2></div><button className="text-action" onClick={() => navigateTo("Tasks & Workflows")}>View all <ChevronRight size={14} /></button></div><div className="workflow-list"><div className="workflow-row"><span className="workflow-icon cyan"><Radio size={15} /></span><div><strong>{processing ? "Analyzing your latest command" : "Ready for your next instruction"}</strong><span>{processing ? "Reasoning core active · response in progress" : "No background workflow is running"}</span></div><b>{processing ? "ACTIVE" : "IDLE"}</b></div><div className="workflow-row"><span className="workflow-icon green"><RefreshCw size={15} /></span><div><strong>Background worker</strong><span>Worker health is not verified in this deployment.</span></div><b className="green">UNVERIFIED</b></div></div></div><div className="surface-panel approval-preview"><div className="panel-heading"><div><span className="section-eyebrow">APPROVAL CENTER</span><h2>Needs your review</h2></div><span className="count-badge">{approvals.length}</span></div>{approvals.slice(0, 3).map(item => <button className="approval-preview-row" key={item.id} onClick={() => navigateTo("Approval Center")}><span className="approval-preview-icon"><item.icon size={14} /></span><span><strong>{item.action}</strong><small>{item.detail}</small></span><ChevronRight size={14} /></button>)}{approvals.length === 0 && <div className="empty-state compact"><CheckCircle2 size={20} /><span>No pending approvals</span></div>}</div></div>
      <div className="section-block"><div className="section-heading-v2"><div><span className="page-kicker">QUICK ACTIONS</span><h2>Move work forward</h2></div><span className="section-muted"><ShieldCheck size={13} /> Every external action remains approval-gated</span></div><div className="action-grid">{actionData.map(action => { const Icon = action.icon; return <button className="action-card-v2" key={action.id} onClick={() => runAction(action.id, action.label)} disabled={processing}><span className={`action-card-icon ${action.tint}`}><Icon size={19} /></span><span><strong>{action.label}</strong><small>{action.description}</small><em>{action.stat}</em></span><ArrowUpRight size={15} /></button>; })}</div></div>
      <div className="overview-bottom-grid"><div className="surface-panel activity-preview"><div className="panel-heading"><div><span className="section-eyebrow">RECENT ACTIVITY</span><h2>Latest signals</h2></div><button className="text-action" onClick={() => navigateTo("Analytics")}>Open analytics <ChevronRight size={14} /></button></div><div className="activity-feed">{logs.length ? logs.slice(-4).reverse().map(log => <div className="activity-feed-row" key={log.id}><span className={`activity-marker ${log.kind}`}><span /></span><div><strong>{log.message}</strong><small>{log.kind.toUpperCase()} · {log.time}</small></div></div>) : <div className="empty-state compact"><Activity size={20} /><span>No persisted activity events</span></div>}</div></div><div className="surface-panel health-preview"><div className="panel-heading"><div><span className="section-eyebrow">SYSTEM HEALTH</span><h2>Telemetry</h2></div><span className="live-label"><span className="status-dot" /> NOT VERIFIED</span></div><div className="health-rows"><div><span><Cpu size={14} /> AI inference</span><b>Not verified <small>no monitor</small></b></div><div><span><Server size={14} /> API gateway</span><b>Not verified <small>no monitor</small></b></div><div><span><Database size={14} /> Data sync</span><b>Not configured <small>no event store</small></b></div><div><span><ShieldCheck size={14} /> Security layer</span><b>Protected <small>session active</small></b></div></div></div></div>
    </section>
  );

  const renderTasks = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">TASKS & WORKFLOWS</span><h1>Everything <em>in motion.</em></h1><p>Track persisted work, approval boundaries, and verified worker state.</p></div><span className="mode-badge"><ShieldCheck size={14} /> Approval-gated autonomy</span></div><div className="task-summary-grid"><div className="summary-card"><span>Active tasks</span><strong>{tasks.length}</strong><small>Persisted tasks only</small></div><div className="summary-card"><span>Awaiting approval</span><strong>{tasks.filter(task => task.approvalRequired).length}</strong><small>Operator review required</small></div><div className="summary-card"><span>Worker status</span><strong>Unverified</strong><small>No live worker monitor connected</small></div></div><div className="surface-panel table-panel"><div className="panel-heading"><div><span className="section-eyebrow">WORK QUEUE</span><h2>Active tasks</h2></div><span className="section-muted">{tasks.length} persisted items</span></div><div className="task-create-row"><input value={newTaskTitle} onChange={event => setNewTaskTitle(event.target.value)} placeholder="Task title" maxLength={191} aria-label="Task title" /><input value={newTaskDetail} onChange={event => setNewTaskDetail(event.target.value)} placeholder="What needs to be done?" maxLength={12000} aria-label="Task description" /><button className="primary-action" onClick={createTask} disabled={workflowTaskCreate.isPending}><ListTodo size={14} /> {workflowTaskCreate.isPending ? "Saving..." : "Add task"}</button></div><div className="task-table">{tasks.length ? tasks.map(task => <div className="task-table-row" key={task.id}><span className={`task-state-dot ${task.stage.toLowerCase().replaceAll(" ", "-")}`} /><div className="task-table-main"><strong>{task.title}</strong><span>{task.detail}</span><div className="progress-line"><i><b style={{ width: `${task.progress}%` }} /></i><em>{task.progress}%</em></div></div><span className="task-stage">{task.stage}</span><div className="task-row-actions"><button className="secondary-action compact-action" onClick={() => editTask(task)}>Edit</button>{task.approvalRequired ? <button className="secondary-action compact-action" onClick={() => approveTask(task)}><Check size={13} /> Approve prep</button> : <span className="cleared-label"><CheckCircle2 size={14} /> Prep cleared</span>}{!["Complete", "Cancelled", "Failed"].includes(task.stage) && <button className="secondary-action compact-action" onClick={() => updateTaskStatus(task, "completed")}>Complete</button>}<button className="secondary-action compact-action" onClick={() => updateTaskStatus(task, "cancelled")}>Cancel</button><button className="danger-action compact-action" onClick={() => { if (window.confirm(`Delete "${task.title}"?`)) workflowTaskDelete.mutate({ id: Number(task.id) }); }}><Trash2 size={13} /> Delete</button></div></div>) : <div className="empty-state"><ListTodo size={30} /><strong>No persisted tasks</strong><span>Create a task above to store it in the database. Status changes are persisted.</span></div>}</div></div><div className="surface-panel worker-panel"><div><span className="section-eyebrow">BACKGROUND WORKER</span><h2>Worker status is not verified</h2><p>The queue code exists, but this workspace does not claim a heartbeat or job result until a persisted worker event is available.</p></div><div className="worker-stats"><span><b>—</b> heartbeat</span><span><b>—</b> failed jobs</span><span><b>—</b> workload</span></div></div></section>
  );

  const renderLeads = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">LEADS & OUTREACH</span><h1>Build the next <em>relationship.</em></h1><p>Lead discovery and outreach are unavailable until a verified provider and persisted lead store are connected.</p></div><button className="primary-action" onClick={() => runAction("outreach", "Start Outreach")} disabled={processing}><Inbox size={15} /> Start outreach</button></div><div className="pipeline-strip"><div><span>DISCOVERED</span><strong>—</strong><small>No lead store</small></div><div><span>QUALIFIED</span><strong>—</strong><small>No lead store</small></div><div><span>STAGED</span><strong>—</strong><small>No lead store</small></div><div><span>SENT</span><strong>—</strong><small>No send adapter</small></div></div><div className="leads-grid"><div className="surface-panel table-panel"><div className="panel-heading"><div><span className="section-eyebrow">PROSPECT PIPELINE</span><h2>Today's lead queue</h2></div><button className="secondary-action" disabled><Search size={14} /> Search</button></div><div className="empty-state"><Users size={30} /><strong>No persisted leads</strong><span>No prospects are being claimed as real until a lead source and database records are connected.</span></div></div><div className="surface-panel outreach-panel"><div className="panel-heading"><div><span className="section-eyebrow">OUTREACH GUARDRAILS</span><h2>Safe by default</h2></div><ShieldCheck size={18} /></div><div className="guardrail-list"><div><CheckCircle2 size={15} /><span>External sending is disabled</span></div><div><CheckCircle2 size={15} /><span>Approval is required before any send</span></div><div><CheckCircle2 size={15} /><span>Provider consent must be verified</span></div><div><AlertTriangle size={15} /><span>Approval and decision history are stored; external execution is not configured</span></div></div><button className="secondary-action full-width" onClick={() => navigateTo("Approval Center")}>Review approval queue <ArrowUpRight size={14} /></button></div></div></section>
  );

  const renderIntegrations = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">INTEGRATIONS</span><h1>Your connected <em>stack.</em></h1><p>Only verified provider configuration and persisted connection records are shown as connected.</p></div><span className="connection-summary"><span className="status-dot" /> {connectedCount} of {connections.length} connected</span></div><div className="integration-grid">{connections.map(connection => { const Icon = connection.icon; const connected = connection.status === "Connected"; const canConnect = ["github", "vercel", "instagram", "tiktok", "linkedin", "gmail"].includes(connection.id); return <div className="integration-card" key={connection.id}><div className={`integration-icon ${connection.tone}`}><Icon size={20} /></div><div className="integration-card-main"><div className="integration-card-title"><div><strong>{connection.label}</strong><span>{connection.description}</span></div><span className={`connection-state ${connected ? "connected" : "ready"}`}><span />{connection.status}</span></div><p>{connection.meta}</p><div className="integration-card-footer"><span><LockKeyhole size={13} /> {connected ? "Connection verified server-side" : "No active connection"}</span>{canConnect ? <button className={`secondary-action ${connected ? "selected" : ""}`} onClick={() => handleConnection(connection.id)}>{connected ? <><Check size={13} /> Disconnect</> : <>Connect <ArrowUpRight size={13} /></>}</button> : <button className="secondary-action" onClick={() => handleConnection(connection.id)}>{connection.id === "apify" || connection.id === "n8n" ? "Open API Vault" : "Details"}</button>}</div></div></div>; })}</div><div className="info-callout"><ShieldCheck size={17} /><div><strong>Approval boundaries stay intact</strong><span>Connection access does not grant permission to send, publish, deploy, or change external data.</span></div></div></section>
  );

  const renderVideoStudio = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">VIDEO STUDIO</span><h1>Shape the next <em>signal.</em></h1><p>Review generated assets only after a real video provider returns them.</p></div><button className="primary-action" onClick={() => runAction("video", "Generate Video")} disabled={processing}><Video size={15} /> Generate draft</button></div><div className="studio-hero surface-panel"><div className="studio-orb"><Video size={28} /></div><div><span className="section-eyebrow">CONTENT PIPELINE</span><h2>No video provider is configured.</h2><p>No generated videos, previews, exports, or approval items are being claimed as real.</p><div className="studio-tags"><span><AlertTriangle size={13} /> Setup required</span><span><Clock3 size={13} /> No pending assets</span><span><ShieldCheck size={13} /> Approval required</span></div></div></div><div className="surface-panel"><div className="empty-state"><Video size={30} /><strong>No generated assets</strong><span>Connect an approved video provider before generating or publishing content.</span></div></div></section>
  );

  const renderAnalytics = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">ANALYTICS</span><h1>See the <em>trajectory.</em></h1><p>Only persisted events and verified provider responses belong in this view.</p></div><button className="secondary-action" disabled><Clock3 size={14} /> Last 30 days</button></div><div className="metric-grid analytics-metrics">{renderMetric("Leads discovered", "—", "No event data", "warning", Inbox)}{renderMetric("Messages sent", "—", "No event data", "warning", Send)}{renderMetric("Videos generated", "—", "No event data", "warning", Video)}{renderMetric("Uptime", "—", "No monitor configured", "warning", Activity)}</div><div className="surface-panel"><div className="empty-state"><BarChart3 size={30} /><strong>No analytics events</strong><span>Charts and exports will appear after workflows, approvals, and provider results are persisted.</span></div></div></section>
  );

  const renderApprovals = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">APPROVAL CENTER</span><h1>Your decision, <em>always.</em></h1><p>Review the exact next step before any connected service acts on your behalf.</p></div><span className="approval-count-large"><strong>{approvals.length}</strong> pending</span></div><div className="approval-layout"><div className="surface-panel approval-queue-panel"><div className="panel-heading"><div><span className="section-eyebrow">WAITING FOR REVIEW</span><h2>Pending actions</h2></div><span className="section-muted">Nothing runs automatically</span></div>{approvals.length ? <div className="approval-queue-list">{approvals.map(item => { const Icon = item.icon; return <div className="approval-queue-item" key={item.id}><div className="approval-queue-icon"><Icon size={18} /></div><div className="approval-queue-copy"><div className="approval-queue-meta"><span>{item.tag}</span><span className={item.risk === "Sensitive" ? "sensitive" : "review"}>{item.risk}</span></div><h3>{item.action}</h3><p>{item.detail}</p><div className="approval-queue-actions"><button className="approve-action" onClick={() => resolveApproval(item, true)}><Check size={14} /> Approve</button><button className="reject-action" onClick={() => resolveApproval(item, false)}><X size={14} /> Reject</button><button className="text-action">Review details <ChevronRight size={13} /></button></div></div><time>Submitted today</time></div>; })}</div> : <div className="empty-state"><CheckCircle2 size={30} /><strong>No persisted approvals</strong><span>Nothing is currently waiting for your review.</span></div>}</div><aside className="approval-policy surface-panel"><div className="policy-icon"><ShieldCheck size={22} /></div><span className="section-eyebrow">OPERATOR POLICY</span><h2>Human control stays in the loop.</h2><p>Approval decisions are not claimed as complete until a durable backend state transition and execution result are available.</p><div className="policy-points"><span><CheckCircle2 size={14} /> External sends remain disabled</span><span><CheckCircle2 size={14} /> Kill switch remains respected</span><span><AlertTriangle size={14} /> Lead and outreach audit records are not implemented</span></div></aside></div><div className="surface-panel approval-history-panel"><div className="panel-heading"><div><span className="section-eyebrow">DECISION HISTORY</span><h2>Past decisions</h2></div><span className="section-muted">{approvalHistory.length} recorded</span></div>{approvalHistory.length ? <div className="approval-history-list">{approvalHistory.map(item => <div className="approval-history-row" key={item.id}><div><strong>{item.action}</strong><small>{item.detail}</small></div><span className={item.status === "approved" ? "history-approved" : "history-rejected"}>{item.status.toUpperCase()}</span></div>)}</div> : <div className="empty-state compact"><Clock3 size={20} /><span>No approval decisions recorded yet</span></div>}</div></section>
  );

  const saveEnvironment = () => {
    const payload = {
      ...(environmentValues.OPENAI_API_KEY.trim() ? { OPENAI_API_KEY: environmentValues.OPENAI_API_KEY.trim() } : {}),
      ...(environmentValues.APIFY_API_TOKEN.trim() ? { APIFY_API_TOKEN: environmentValues.APIFY_API_TOKEN.trim() } : {}),
      ...(environmentValues.N8N_API_KEY.trim() ? { N8N_API_KEY: environmentValues.N8N_API_KEY.trim() } : {}),
      ...(environmentValues.N8N_WEBHOOK_URL.trim() ? { N8N_WEBHOOK_URL: environmentValues.N8N_WEBHOOK_URL.trim() } : {}),
    };
    if (!payload.OPENAI_API_KEY && !payload.APIFY_API_TOKEN && !payload.N8N_API_KEY && !payload.N8N_WEBHOOK_URL) {
      flash("Nothing to save", "Enter an OpenAI key, Apify token, or n8n webhook URL.");
      return;
    }
    environmentUpdate.mutate(payload);
  };

  const renderSettings = () => (
    <section className="workspace-page"><div className="page-intro"><div><span className="page-kicker">SETTINGS</span><h1>Keep the system <em>yours.</em></h1><p>Manage your operator profile, workspace preferences, and safety posture.</p></div><StatusPill>Protected session</StatusPill></div><div className="settings-grid"><div className="surface-panel settings-card"><div className="settings-card-head"><div className="settings-avatar">{(auth.user?.name ?? "CEO").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><span className="section-eyebrow">OPERATOR PROFILE</span><h2>{auth.user?.name || "CEO"}</h2><p>{auth.user?.email || "Authenticated operator"}</p></div><button className="secondary-action" onClick={() => setProfileOpen(true)}><Settings2 size={14} /> Edit profile</button></div><div className="settings-detail-grid"><div><span>Role</span><strong>{auth.user?.role === "admin" ? "Administrator" : "Operator"}</strong></div><div><span>Login method</span><strong>{auth.user?.loginMethod || "Manus account"}</strong></div><div><span>Account ID</span><strong>{auth.user?.openId.slice(0, 12)}…</strong></div></div></div><div className="surface-panel settings-card"><div className="panel-heading"><div><span className="section-eyebrow">SAFETY POSTURE</span><h2>Guardrails</h2></div><ShieldCheck size={18} /></div><div className="settings-toggle-list"><div><span><LockKeyhole size={15} /><span><strong>Approval required</strong><small>External actions wait for your decision.</small></span></span><span className="toggle-state on">ON</span></div><div><span><Volume2 size={15} /><span><strong>Voice replies</strong><small>Text chat is the default. Enable this only when you want J.A.R.V.I.S to speak.</small></span></span><button className={`toggle-state ${voiceRepliesEnabled ? "on" : "off"}`} onClick={toggleVoiceReplies}>{voiceRepliesEnabled ? "ON" : "OFF"}</button></div><div><span><Bell size={15} /><span><strong>Live notifications</strong><small>Keep approval and system signals visible.</small></span></span><span className="toggle-state on">ON</span></div></div></div><div className="surface-panel settings-card vault-card"><div className="panel-heading"><div><span className="section-eyebrow">API VAULT / SYSTEM ENVIRONMENT</span><h2>Secure configuration</h2></div><KeyRound size={18} /></div><p>Values are encrypted on the server and never returned to the browser in plaintext. OpenAI keys can be stored here; the assistant currently uses the application-managed model runtime until direct OpenAI routing is enabled.</p><label className="profile-field"><span>OPENAI_API_KEY</span><input type="password" value={environmentValues.OPENAI_API_KEY} onChange={event => setEnvironmentValues(previous => ({ ...previous, OPENAI_API_KEY: event.target.value }))} placeholder={environmentQuery.data?.find(item => item.name === "OPENAI_API_KEY")?.masked ?? "Not configured"} autoComplete="new-password" /></label><label className="profile-field"><span>APIFY_API_TOKEN</span><input type="password" value={environmentValues.APIFY_API_TOKEN} onChange={event => setEnvironmentValues(previous => ({ ...previous, APIFY_API_TOKEN: event.target.value }))} placeholder={environmentQuery.data?.find(item => item.name === "APIFY_API_TOKEN")?.masked ?? "Not configured"} autoComplete="new-password" /></label><label className="profile-field"><span>N8N_API_KEY</span><input type="password" value={environmentValues.N8N_API_KEY} onChange={event => setEnvironmentValues(previous => ({ ...previous, N8N_API_KEY: event.target.value }))} placeholder={environmentQuery.data?.find(item => item.name === "N8N_API_KEY")?.masked ?? "Not configured"} autoComplete="new-password" /></label><label className="profile-field"><span>N8N_WEBHOOK_URL</span><input type="url" value={environmentValues.N8N_WEBHOOK_URL} onChange={event => setEnvironmentValues(previous => ({ ...previous, N8N_WEBHOOK_URL: event.target.value }))} placeholder={environmentQuery.data?.find(item => item.name === "N8N_WEBHOOK_URL")?.masked ?? "Not configured"} autoComplete="url" /></label><div className="vault-actions"><button className="primary-action" onClick={saveEnvironment} disabled={environmentUpdate.isPending}><KeyRound size={14} /> {environmentUpdate.isPending ? "Encrypting..." : "Save Configuration"}</button><span>Server-side encryption required</span></div>{environmentSaveMessage && <div className="info-callout"><CheckCircle2 size={16} /><div><strong>{environmentSaveMessage}</strong><span>Credentials are saved and masked. Provider execution remains unavailable until its adapter is implemented and tested.</span></div></div>}<div className="vault-status-list">{environmentQuery.data?.map(item => <div key={item.name}><span>{item.name}</span><strong>{item.configured ? item.masked : "Not configured"}</strong>{item.configured && <button className="text-action" onClick={() => { if (window.confirm(`Remove ${item.name} from the API Vault?`)) environmentRemove.mutate({ name: item.name as "OPENAI_API_KEY" | "APIFY_API_TOKEN" | "N8N_API_KEY" | "N8N_WEBHOOK_URL" }); }} disabled={environmentRemove.isPending}>Remove</button>}</div>)}</div></div><div className="surface-panel settings-card"><div className="panel-heading"><div><span className="section-eyebrow">SHORTCUTS</span><h2>Command palette</h2></div><Command size={18} /></div><div className="shortcut-list"><span><kbd>/</kbd><small>Focus AI Assistant</small></span><span><kbd>Ctrl K</kbd><small>Focus AI Assistant</small></span><span><kbd>C</kbd><small>Open Integrations</small></span></div></div><div className="surface-panel settings-card danger-card"><div className="panel-heading"><div><span className="section-eyebrow">SESSION</span><h2>Sign out</h2></div><Unplug size={18} /></div><p>End the current authenticated operator session on this device.</p><button className="danger-action" onClick={() => auth.logout()}><Unplug size={14} /> Sign out of J.A.R.V.I.S</button></div></div></section>
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
    return <div className="auth-screen"><div className="auth-card"><div className="auth-orb"><span>J</span></div><div className="eyebrow accent-eyebrow"><span className="eyebrow-line" />SECURE OPERATOR ACCESS</div><h1>J.A.R.V.I.S <em>awaits.</em></h1><p>Sign in with your Manus account to access your private command center, connections, approvals, and profile. Access is restricted to the configured owner account.</p><button className="auth-login-button" onClick={() => startLogin()}><ShieldCheck size={16} /> Sign in to continue <ArrowUpRight size={15} /></button><span className="auth-footnote"><LockKeyhole size={13} /> Only the configured owner account can use this dashboard.</span></div></div>;
  }

  return (
    <div className="jarvis-shell">
      <div className="shell-ambient shell-ambient-one" /><div className="shell-ambient shell-ambient-two" />
      <header className="app-topbar"><div className="topbar-left"><button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><AppMark /><span className="topbar-rule" /><div className="topbar-breadcrumb"><span>OPERATIONS CONSOLE</span><strong>/</strong><span>{view.toUpperCase()}</span></div></div><div className="topbar-right"><div className="topbar-clock"><strong>{formatTime()}</strong><span>{formatDate()}</span></div><StatusPill>Session active</StatusPill><button className="topbar-icon-button" aria-label="Open approvals" onClick={() => navigateTo("Approval Center")}><Bell size={17} /><span>{approvals.length}</span></button><button className="topbar-avatar" aria-label="Open operator profile" onClick={() => setProfileOpen(true)}>{(auth.user.name ?? "CEO").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</button></div></header>
      <div className="shell-body"><aside className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${sidebarOpen ? "open" : ""}`}><div className="sidebar-head"><div><span className="sidebar-label">J.A.R.V.I.S</span><span className="sidebar-caption">Command platform</span></div><button className="sidebar-collapse" aria-label="Collapse sidebar" onClick={() => setSidebarCollapsed(previous => !previous)}><ChevronRight size={16} /></button></div><nav className="app-nav" aria-label="Primary navigation">{(["Workspace", "Operations", "System"] as const).map(group => <div className="nav-group" key={group}><span className="nav-group-label">{group}</span>{workspaceNav.filter(item => item.group === group).map(item => { const Icon = item.icon; const active = item.label === view; return <button className={`app-nav-item ${active ? "active" : ""}`} key={item.label} onClick={() => navigateTo(item.label)}><Icon size={17} /><span>{item.label}</span>{item.label === "Approval Center" && approvals.length > 0 && <b>{approvals.length}</b>}</button>; })}</div>)}</nav><div className="sidebar-footer"><div className="sidebar-health"><span className="status-dot" /><div><strong>TELEMETRY UNVERIFIED</strong><small>Last checked {formatTime()}</small></div></div><button className="sidebar-profile" onClick={() => setProfileOpen(true)}><span className="sidebar-profile-avatar">{(auth.user.name ?? "CEO").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{auth.user.name || "CEO"}</strong><small>{auth.user.email || "Operator"}</small></span><ChevronRight size={14} /></button></div></aside>{sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
        <main className="shell-main"><div className="mobile-page-bar"><button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button><span>{view}</span><span className="mobile-page-status"><span className="status-dot" /> Session active</span></div>{renderWorkspace()}<footer className="shell-footer"><span><span className="footer-core" /> J.A.R.V.I.S · JUST A RATHER VERY INTELLIGENT SYSTEM</span><span>BUILD 2.4.8 · APPROVAL-GATED</span></footer></main></div>
      {notification && <div className="toast-notification"><div className="toast-icon"><Check size={15} /></div><div><strong>{notification.title}</strong><span>{notification.detail}</span></div><button aria-label="Dismiss notification" onClick={() => setNotification(null)}><X size={15} /></button></div>}
      {profileOpen && <div className="profile-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="profile-dialog-top"><div><div className="eyebrow accent-eyebrow">OPERATOR PROFILE</div><h2 id="profile-title">Your J.A.R.V.I.S identity</h2></div><button className="profile-close" aria-label="Close profile" onClick={() => setProfileOpen(false)}><X size={17} /></button></div><div className="profile-identity"><div className="profile-avatar">{(auth.user.name ?? "CEO").split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><strong>{auth.user.email ?? "Authenticated operator"}</strong><span>{auth.user.role === "admin" ? "Administrator" : "Operator"} · {auth.user.loginMethod ?? "Manus account"}</span></div></div><label className="profile-field"><span>Display name</span><input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="CEO" maxLength={80} /></label><div className="profile-readonly"><div><span>Account email</span><strong>{auth.user.email ?? "Not provided"}</strong></div><div><span>Access role</span><strong>{auth.user.role === "admin" ? "Administrator" : "Operator"}</strong></div><div><span>Account ID</span><strong>{auth.user.openId.slice(0, 12)}…</strong></div></div><div className="profile-dialog-footer"><button className="logout-button" onClick={() => auth.logout()}><Unplug size={14} /> Sign out</button><button className="save-profile-button" disabled={profileUpdate.isPending || !profileName.trim()} onClick={() => profileUpdate.mutate({ name: profileName.trim() })}><Save size={14} /> {profileUpdate.isPending ? "Saving..." : "Save profile"}</button></div></section></div>}
    </div>
  );
}

function Link2Icon() {
  return <ArrowUpRight size={12} />;
}
