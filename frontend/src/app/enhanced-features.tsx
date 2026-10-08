"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Check,
  Clock,
  Download,
  ExternalLink,
  Info,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  Pencil,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { RealtimeCall } from "@/app/realtime-call";

const initials = (value: string) =>
  (value || "N")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const when = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
const memberSince = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

function Heading({ eyebrow, title, subtitle, children }: any) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
function Empty({ icon: Icon = BookOpen, title, body }: any) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={29} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="choice" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([id, name]) => (
          <SelectItem key={id} value={id}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AssistantPlus({ state, act, busy }: any) {
  const [question, setQuestion] = useState("");
  const [resourceId, setResourceId] = useState("none");
  const [uploaded, setUploaded] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [listening, setListening] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition,
    );
  const history = state?.history || [];
  const resourceRecords = [
    ...(state?.resources || []),
    ...uploaded.filter(
      (local) =>
        !(state?.resources || []).some((saved: any) => saved.id === local.id),
    ),
  ];
  const resources: [string, string][] = [
    ["none", "Built-in study notes"],
    ...resourceRecords
      .filter((resource: any) => resource.content || resource.searchable)
      .map(
        (resource: any) => [resource.id, resource.title] as [string, string],
      ),
  ];
  const selectedFile = resources.find(([id]) => id === resourceId)?.[1];
  const send = async (value = question) => {
    const clean = value.trim();
    if (!clean || busy) return;
    if (
      await act(
        "tutor",
        {
          question: clean,
          resourceId: resourceId === "none" ? null : resourceId,
        },
        "",
      )
    )
      setQuestion("");
  };
  const upload = async (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/files", {
        method: "POST",
        body: form,
      });
      const data = await response
        .json()
        .catch(() => ({ error: "The server returned an invalid response." }));
      if (!response.ok)
        throw new Error(data.error || "The file could not be uploaded.");
      if (data.resource?.searchable) {
        setUploaded((items) => [data.resource, ...items]);
        setResourceId(data.resource.id);
        toast.success(data.note || "File uploaded and selected for AI.");
      } else toast.info(data.note || "File uploaded.");
    } catch (error: any) {
      toast.error(error.message || "The file could not be uploaded.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const toggleVoice = () => {
    if (!voiceSupported) {
      toast.error(
        "Voice input is not supported in this browser. Try Chrome or Edge.",
      );
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new Recognition();
    const startingText = question.trim();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: any) => {
      const spoken = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || "")
        .join("")
        .trim();
      setQuestion([startingText, spoken].filter(Boolean).join(" "));
    };
    recognition.onerror = (event: any) => {
      if (event.error !== "aborted")
        toast.error(
          event.error === "not-allowed"
            ? "Allow microphone access to use voice input."
            : "Voice input could not start. Please try again.",
        );
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
  };
  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );
  return (
    <>
      <Heading
        eyebrow="MAKE ROOM FOR UNDERSTANDING"
        title="Your study assistant"
        subtitle="Ask a question, use your saved notes as context, and keep the conversation in one place."
      />
      <section className="assistant-panel panel">
        <div className="chat-history">
          {!history.length ? (
            <div className="assistant-welcome">
              <span className="assistant-mark">
                <Sparkles size={34} />
              </span>
              <h2>What are we learning today?</h2>
              <p>
                Start with a concept, a confusing step, or a question from your
                notes.
              </p>
              <div className="suggested-prompts">
                {[
                  "Explain graph traversal step by step",
                  "Quiz me on database normalization",
                  "Compare SQL joins with examples",
                  "Help me understand dynamic programming",
                ].map((prompt) => (
                  <button key={prompt} onClick={() => send(prompt)}>
                    {prompt}
                    <Sparkles size={14} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            history.map((message: any) => (
              <div key={message.id} className={"chat-message " + message.role}>
                <span className="message-avatar">
                  {message.role === "assistant" ? (
                    <Sparkles size={17} />
                  ) : (
                    initials(state?.profile?.name || "You")
                  )}
                </span>
                <div>
                  <b>
                    {message.role === "assistant"
                      ? state?.aiConnected
                        ? "Nexovia · Gemini tutor"
                        : "Nexovia · Reference notes"
                      : "You"}
                  </b>
                  <p>{message.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="composer">
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
            onChange={(event) => upload(event.target.files?.[0])}
          />
          <div className="assistant-context-row">
            <Choice
              label="Study context"
              value={resourceId}
              onChange={setResourceId}
              options={resources}
            />
            {resourceId !== "none" && (
              <span className="selected-context">
                <Check size={15} /> Using {selectedFile}
              </span>
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <button
              className="composer-tool"
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              aria-label="Attach a study file"
              title="Attach PDF, TXT or Markdown"
            >
              <Plus size={20} />
            </button>
            <input
              aria-label="Ask a study question"
              placeholder={
                resourceId === "none"
                  ? "Ask about a concept…"
                  : `Ask a question about ${selectedFile}…`
              }
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button
              className={"composer-tool " + (listening ? "listening" : "")}
              type="button"
              onClick={toggleVoice}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              title={listening ? "Stop listening" : "Speak your question"}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              className="primary"
              disabled={busy || !question.trim()}
              aria-label="Send question"
            >
              <Send size={17} />
            </button>
          </form>
          <p className="help">
            Use + to attach PDF, TXT or Markdown notes. The selected file is
            sent as private context with your question. Scanned/image-only PDFs
            need OCR before upload. AI can make mistakes.
          </p>
        </div>
      </section>
    </>
  );
}

export function NotificationsView({
  state,
  taskNotifications,
  act,
  go,
  openTask,
  recover,
}: any) {
  const appNotifications = state?.notifications || [];
  const unread = state?.unreadNotifications || 0;
  const browserSupported =
    typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<string>(
    browserSupported ? Notification.permission : "unsupported",
  );
  const enableAlerts = async () => {
    if (!browserSupported) {
      toast.error("This browser does not support system notifications.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    result === "granted"
      ? toast.success("Browser alerts enabled while Nexovia is open.")
      : toast.info("Browser alerts were not enabled.");
  };
  const openNotification = async (notification: any) => {
    await act("readNotifications", { id: notification.id }, "");
    if (notification.link?.startsWith("community:")) {
      sessionStorage.setItem(
        "nexovia-community-peer",
        notification.link.slice("community:".length),
      );
      go("Community");
    }
  };
  return (
    <>
      <Heading
        eyebrow="STAY IN THE LOOP"
        title="Notifications"
        subtitle="Connection requests, messages, and study reminders appear here as they arrive."
      >
        <div className="notification-toolbar">
          {permission !== "granted" && (
            <button className="secondary" onClick={enableAlerts}>
              <Bell size={16} /> Enable browser alerts
            </button>
          )}
          {unread > 0 && (
            <button
              className="secondary"
              onClick={() =>
                act(
                  "readNotifications",
                  { all: true },
                  "All notifications marked as read.",
                )
              }
            >
              <Check size={16} /> Mark all read
            </button>
          )}
        </div>
      </Heading>
      {permission === "granted" && (
        <div className="notice ai-live">
          <Bell size={18} />
          <span>
            <b>Browser alerts are on.</b> New community activity will also
            appear as a system alert while Nexovia is open.
          </span>
        </div>
      )}
      <section className="panel notification-panel">
        <div className="section-title">
          <div>
            <h2>Community activity</h2>
            <p>
              {unread
                ? `${unread} unread update${unread === 1 ? "" : "s"}`
                : "You’re all caught up"}
            </p>
          </div>
        </div>
        {!appNotifications.length ? (
          <Empty
            icon={Users}
            title="No community notifications yet"
            body="New connection requests, accepted requests, and messages will be saved here."
          />
        ) : (
          <div className="notification-list">
            {appNotifications.map((notification: any) => (
              <button
                key={notification.id}
                className={
                  "notification-row app-notification " +
                  (!notification.read ? "unread" : "")
                }
                onClick={() => openNotification(notification)}
              >
                <span className="notification-kind">
                  {notification.kind?.startsWith("call") ? (
                    <Phone size={18} />
                  ) : notification.kind === "message" ? (
                    <MessageCircle size={18} />
                  ) : (
                    <Users size={18} />
                  )}
                </span>
                <div>
                  <h3>{notification.title}</h3>
                  <p>{notification.body}</p>
                  <small>{when(notification.created)}</small>
                </div>
                {!notification.read && <i aria-label="Unread" />}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="panel notification-panel task-reminders">
        <div className="section-title">
          <div>
            <h2>Study reminders</h2>
            <p>Based on your plan, priority, and deadlines</p>
          </div>
        </div>
        {!taskNotifications.length ? (
          <Empty
            icon={Clock}
            title="No study reminders right now"
            body="Upcoming sessions will appear here when it is time to begin."
          />
        ) : (
          <div className="notification-list">
            {taskNotifications.map((task: any) => (
              <div className="notification-row" key={task.id}>
                <span className="notification-kind">
                  <Clock size={18} />
                </span>
                <div>
                  <h3>{task.topic}</h3>
                  <p>
                    {task.subject} · {task.date} at {task.time} ·{" "}
                    {task.duration} min
                  </p>
                </div>
                <div className="row-actions">
                  <button onClick={() => openTask(task)}>Open</button>
                  <button onClick={() => recover(task)}>Find new time</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function CommunityPlus({ state, act, go, busy, load }: any) {
  const [query, setQuery] = useState("");
  const [nearby, setNearby] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [chatPeer, setChatPeer] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [chatUploading, setChatUploading] = useState(false);
  const [chatListening, setChatListening] = useState(false);
  const chatFileInput = useRef<HTMLInputElement>(null);
  const chatRecognitionRef = useRef<any>(null);
  const profile = state?.profile;
  const peers = state?.peers || [];
  const connections = state?.connections || [];
  const notifications = state?.notifications || [];
  const connection = (id: string) =>
    connections.find(
      (item: any) =>
        (item.sender === id && item.recipient === state?.user?.id) ||
        (item.recipient === id && item.sender === state?.user?.id),
    );
  const distance = (peer: any) => {
    if (profile?.latitude == null || peer.latitude == null) return null;
    const radians = (value: number) => (value * Math.PI) / 180;
    const a =
      Math.sin(radians(peer.latitude - profile.latitude) / 2) ** 2 +
      Math.cos(radians(profile.latitude)) *
        Math.cos(radians(peer.latitude)) *
        Math.sin(radians(peer.longitude - profile.longitude) / 2) ** 2;
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };
  const accepted = peers.filter(
    (peer: any) => connection(peer.id)?.status === "accepted",
  );
  const incoming = peers.filter((peer: any) => {
    const item = connection(peer.id);
    return item?.status === "pending" && item.recipient === state?.user?.id;
  });
  const visible = peers
    .filter((peer: any) =>
      (peer.name + " " + (peer.subjects || ""))
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (peer: any) =>
        !nearby || (distance(peer) != null && Number(distance(peer)) <= 100),
    );
  const chat = useMemo(
    () =>
      (state?.messages || []).filter(
        (item: any) =>
          (item.sender === state?.user?.id &&
            item.recipient === chatPeer?.id) ||
          (item.sender === chatPeer?.id && item.recipient === state?.user?.id),
      ),
    [state?.messages, state?.user?.id, chatPeer?.id],
  );
  const unreadFor = (id: string) =>
    notifications.filter(
      (item: any) =>
        !item.read &&
        item.kind === "message" &&
        item.link === `community:${id}`,
    ).length;
  const openChat = async (peer: any) => {
    setSelectedProfile(null);
    setChatPeer(peer);
    await act("readNotifications", { peerId: peer.id }, "");
  };
  const submitMessage = async (event: any) => {
    event.preventDefault();
    const body = message.trim();
    if (!body || !chatPeer || busy) return;
    if (await act("message", { id: chatPeer.id, body }, "")) setMessage("");
  };
  const uploadChatFile = async (file?: File) => {
    if (!file || !chatPeer || chatUploading) return;
    setChatUploading(true);
    try {
      const form = new FormData();
      form.append("peer", chatPeer.id);
      form.append("file", file);
      if (message.trim()) form.append("caption", message.trim());
      const response = await fetch("/api/chat-files", {
        method: "POST",
        body: form,
      });
      const data = await response
        .json()
        .catch(() => ({ error: "The server returned an invalid response." }));
      if (!response.ok)
        throw new Error(data.error || "The file could not be sent.");
      setMessage("");
      await load();
      toast.success(data.note || "File sent.");
    } catch (error: any) {
      toast.error(error.message || "The file could not be sent.");
    } finally {
      setChatUploading(false);
      if (chatFileInput.current) chatFileInput.current.value = "";
    }
  };
  const toggleChatVoice = () => {
    const Recognition =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition);
    if (!Recognition) {
      toast.error(
        "Voice input is not supported in this browser. Try Chrome or Edge.",
      );
      return;
    }
    if (chatListening) {
      chatRecognitionRef.current?.stop();
      return;
    }
    const recognition = new Recognition();
    const startingText = message.trim();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => setChatListening(true);
    recognition.onresult = (event: any) => {
      const spoken = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || "")
        .join("")
        .trim();
      setMessage([startingText, spoken].filter(Boolean).join(" "));
    };
    recognition.onerror = (event: any) => {
      if (event.error !== "aborted")
        toast.error(
          event.error === "not-allowed"
            ? "Allow microphone access to use voice input."
            : "Voice input could not start. Please try again.",
        );
    };
    recognition.onend = () => {
      setChatListening(false);
      chatRecognitionRef.current = null;
    };
    chatRecognitionRef.current = recognition;
    recognition.start();
  };
  const actionFor = (peer: any) => {
    const item = connection(peer.id);
    if (!item)
      return (
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            act("connect", { id: peer.id }, "Connection request sent.")
          }
        >
          <Users size={15} /> Connect
        </button>
      );
    if (item.status === "accepted")
      return (
        <button className="primary" onClick={() => openChat(peer)}>
          <MessageCircle size={15} /> Message
        </button>
      );
    if (item.recipient === state?.user?.id)
      return (
        <button
          className="primary"
          disabled={busy}
          onClick={() => act("accept", { id: item.id }, "Connection accepted.")}
        >
          <Check size={15} /> Accept request
        </button>
      );
    return (
      <button className="secondary" disabled>
        Request sent
      </button>
    );
  };

  useEffect(() => {
    const peerId = sessionStorage.getItem("nexovia-community-peer");
    if (!peerId) return;
    const peer = peers.find((item: any) => item.id === peerId);
    if (peer) {
      sessionStorage.removeItem("nexovia-community-peer");
      connection(peer.id)?.status === "accepted"
        ? openChat(peer)
        : setSelectedProfile(peer);
    }
  }, [peers.length]);
  useEffect(() => {
    if (!chatPeer && accepted.length) setChatPeer(accepted[0]);
  }, [accepted.length, chatPeer?.id]);
  useEffect(
    () => () => {
      chatRecognitionRef.current?.abort();
    },
    [],
  );

  return (
    <>
      <Heading
        eyebrow="GROW TOGETHER"
        title="Community"
        subtitle="Connect, see learner profiles, and keep study conversations together."
      >
        <button className="secondary" onClick={() => go("Settings")}>
          <Pencil size={16} /> Edit learning profile
        </button>
      </Heading>
      <div className="community-banner">
        <span className="community-icon">
          <Users size={34} />
        </span>
        <div>
          <h2>Learning is better with a little company.</h2>
          <p>
            Find learners with shared interests. Connect before starting a
            private conversation.
          </p>
        </div>
        <span className="pill">PEER LEARNING</span>
      </div>
      {!profile?.discoverable && (
        <div className="notice">
          <ShieldCheck size={18} />
          <span>
            Your profile is private. Existing connections still work, but new
            learners cannot discover you.
          </span>
          <button className="secondary" onClick={() => go("Settings")}>
            Privacy settings
          </button>
        </div>
      )}
      {!!incoming.length && (
        <section className="panel connection-requests">
          <div className="section-title">
            <div>
              <h2>Connection requests</h2>
              <p>
                {incoming.length} learner
                {incoming.length === 1 ? " wants" : "s want"} to connect
              </p>
            </div>
          </div>
          {incoming.map((peer: any) => (
            <div className="request-row" key={peer.id}>
              <span className="avatar">{initials(peer.name)}</span>
              <div>
                <b>{peer.name}</b>
                <p>{peer.subjects || "Exploring new subjects"}</p>
              </div>
              <button
                className="secondary"
                onClick={() => setSelectedProfile(peer)}
              >
                View profile
              </button>
              {actionFor(peer)}
            </div>
          ))}
        </section>
      )}
      <section className="community-hub">
        <aside className="panel conversation-list">
          <div className="section-title">
            <div>
              <h2>Messages</h2>
              <p>Your connected learners</p>
            </div>
          </div>
          {!accepted.length ? (
            <Empty
              icon={MessageCircle}
              title="No conversations yet"
              body="Connect with a learner below to start chatting."
            />
          ) : (
            accepted.map((peer: any) => (
              <button
                key={peer.id}
                className={
                  "conversation-button " +
                  (chatPeer?.id === peer.id ? "active" : "")
                }
                onClick={() => openChat(peer)}
              >
                <span className="avatar">{initials(peer.name)}</span>
                <div>
                  <b>{peer.name}</b>
                  <small>{peer.subjects || "Study connection"}</small>
                </div>
                {unreadFor(peer.id) > 0 && (
                  <span className="unread-badge">{unreadFor(peer.id)}</span>
                )}
              </button>
            ))
          )}
        </aside>
        <div className="panel community-chat-panel">
          {!chatPeer ? (
            <Empty
              icon={MessageCircle}
              title="Choose a conversation"
              body="Select a connected learner to see your messages and continue studying together."
            />
          ) : (
            <>
              <header>
                <button
                  className="chat-profile-button"
                  onClick={() => setSelectedProfile(chatPeer)}
                >
                  <span className="avatar">{initials(chatPeer.name)}</span>
                  <div>
                    <b>{chatPeer.name}</b>
                    <small>View learning profile</small>
                  </div>
                </button>
                <div className="chat-header-actions">
                  <RealtimeCall
                    userId={state?.user?.id}
                    peer={chatPeer}
                    peers={peers}
                    onIncomingPeer={openChat}
                  />
                  {chatPeer.video && (
                    <a
                      className="secondary"
                      href={chatPeer.video}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={15} /> Meeting link
                    </a>
                  )}
                </div>
              </header>
              <div className="peer-chat-messages">
                {!chat.length ? (
                  <Empty
                    icon={MessageCircle}
                    title="Start the conversation"
                    body={`Say hello to ${chatPeer.name} and share what you’re studying.`}
                  />
                ) : (
                  chat.map((item: any) => (
                    <div
                      key={item.id}
                      className={
                        "peer-message " +
                        (item.sender === state?.user?.id ? "mine" : "theirs")
                      }
                    >
                      {item.body && <p>{item.body}</p>}
                      {item.attachment_name && (
                        <a
                          className="chat-attachment"
                          href={`/api/chat-files?id=${encodeURIComponent(item.id)}`}
                        >
                          <Paperclip size={16} />
                          <span>
                            <b>{item.attachment_name}</b>
                            <small>
                              {item.attachment_kind?.toUpperCase()} ·{" "}
                              {Math.max(
                                1,
                                Math.round((item.attachment_size || 0) / 1024),
                              )}{" "}
                              KB
                            </small>
                          </span>
                          <Download size={15} />
                        </a>
                      )}
                      <small>{when(item.created)}</small>
                    </div>
                  ))
                )}
              </div>
              <form className="chat-composer" onSubmit={submitMessage}>
                <input
                  ref={chatFileInput}
                  hidden
                  type="file"
                  accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp"
                  onChange={(event) => uploadChatFile(event.target.files?.[0])}
                />
                <button
                  className="composer-tool"
                  type="button"
                  disabled={chatUploading}
                  onClick={() => chatFileInput.current?.click()}
                  aria-label="Attach a file"
                  title="Attach a file"
                >
                  <Plus size={19} />
                </button>
                <input
                  aria-label={`Message ${chatPeer.name}`}
                  placeholder={`Message ${chatPeer.name}…`}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <button
                  className={
                    "composer-tool " + (chatListening ? "listening" : "")
                  }
                  type="button"
                  onClick={toggleChatVoice}
                  aria-label={
                    chatListening ? "Stop voice input" : "Start voice input"
                  }
                  title={
                    chatListening ? "Stop listening" : "Speak your message"
                  }
                >
                  {chatListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button className="primary" disabled={busy || !message.trim()}>
                  <Send size={17} />
                </button>
              </form>
            </>
          )}
        </div>
      </section>
      <div className="section-title community-discovery-title">
        <div>
          <h2>Discover learners</h2>
          <p>Profiles show only details people chose to share</p>
        </div>
      </div>
      <div className="resource-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search learners"
            placeholder="Search names or subjects…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          className={"secondary " + (nearby ? "active" : "")}
          onClick={() => setNearby((value) => !value)}
        >
          <MapPin size={16} /> Within 100 km
        </button>
      </div>
      {!visible.length ? (
        <Empty
          icon={Users}
          title="No matching learners"
          body="Try another search, turn off the nearby filter, or invite someone to make their profile discoverable."
        />
      ) : (
        <div className="peer-grid">
          {visible.map((peer: any) => {
            const km = distance(peer);
            return (
              <article className="peer-card" key={peer.id}>
                <span className="avatar peer-avatar">
                  {initials(peer.name)}
                </span>
                <h3>{peer.name}</h3>
                <p>
                  {peer.bio ||
                    "Building better study habits, one session at a time."}
                </p>
                <div className="peer-subjects">
                  {(peer.subjects || "Open to study partners")
                    .split(",")
                    .slice(0, 3)
                    .map((subject: string) => (
                      <span className="subject-chip" key={subject}>
                        {subject.trim()}
                      </span>
                    ))}
                </div>
                {km != null && (
                  <small>
                    <MapPin size={13} />
                    {km} km away
                  </small>
                )}
                <div className="peer-actions">
                  <button
                    className="secondary"
                    onClick={() => setSelectedProfile(peer)}
                  >
                    View profile
                  </button>
                  {actionFor(peer)}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Dialog
        open={!!selectedProfile}
        onOpenChange={(open) => !open && setSelectedProfile(null)}
      >
        <DialogContent className="profile-dialog">
          {selectedProfile && (
            <>
              <DialogHeader>
                <DialogDescription className="modal-kicker">
                  LEARNER PROFILE
                </DialogDescription>
                <DialogTitle>{selectedProfile.name}</DialogTitle>
              </DialogHeader>
              <div className="profile-hero">
                <span className="avatar profile-avatar">
                  {initials(selectedProfile.name)}
                </span>
                <div>
                  <h3>{selectedProfile.name}</h3>
                  <p>
                    {selectedProfile.bio ||
                      "This learner has not added a bio yet."}
                  </p>
                </div>
              </div>
              <div className="profile-meta">
                <div>
                  <BookOpen size={17} />
                  <span>
                    <small>Subjects</small>
                    <b>{selectedProfile.subjects || "Not specified"}</b>
                  </span>
                </div>
                <div>
                  <Clock size={17} />
                  <span>
                    <small>Weekly goal</small>
                    <b>{Math.round((selectedProfile.goal || 0) / 60)} hours</b>
                  </span>
                </div>
                <div>
                  <Users size={17} />
                  <span>
                    <small>Member since</small>
                    <b>{memberSince(selectedProfile.created)}</b>
                  </span>
                </div>
                {distance(selectedProfile) != null && (
                  <div>
                    <MapPin size={17} />
                    <span>
                      <small>Approximate distance</small>
                      <b>{distance(selectedProfile)} km</b>
                    </span>
                  </div>
                )}
              </div>
              <div className="modal-actions">
                {actionFor(selectedProfile)}
                {selectedProfile.video && (
                  <a
                    className="secondary"
                    href={selectedProfile.video}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Video size={15} /> Open study room{" "}
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <p className="profile-privacy">
                <Info size={14} /> Nexovia shares only community profile
                details—not study plans, quiz scores, or private resources.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
