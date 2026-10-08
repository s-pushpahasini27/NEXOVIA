"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sparkles,
  CalendarDays,
  LayoutDashboard,
  BookOpen,
  Brain,
  Layers,
  BarChart3,
  Users,
  Bell,
  Settings,
  Plus,
  Play,
  Clock,
  Flame,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Target,
  Search,
  FileText,
  ExternalLink,
  Upload,
  Send,
  RotateCcw,
  Pause,
  Square,
  Check,
  Trash2,
  Link2,
  MapPin,
  Video,
  Loader2,
  Pencil,
  GraduationCap,
  Info,
  LogOut,
  X,
  Timer,
  ArrowUpRight,
  MessageCircle,
  ShieldCheck,
  Activity,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import { api } from "@/lib/client";
import { AccountSecurity } from "./auth-ui";
import { ThemeToggle, UserGreeting } from "./theme-ui";
import {
  AssistantPlus,
  CommunityPlus,
  NotificationsView,
} from "./enhanced-features";
import { useTheme } from "next-themes";
import {
  defaultInput,
  today,
  addDays,
  Task,
  PlanInput,
  timeMinutes,
  validateTasks,
  planConflicts,
} from "@/lib/study";
const nav = [
  ["Overview", LayoutDashboard],
  ["Study planner", CalendarDays],
  ["AI study assistant", Sparkles],
  ["Resources", BookOpen],
  ["Flashcards & quizzes", Layers],
  ["Progress & insights", BarChart3],
  ["Community", Users],
] as const;
const dateLabel = (d: string, opts: any = { month: "short", day: "numeric" }) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", opts);
const initials = (s: string) =>
  (s || "N")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const fmt = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`
    : `${Math.round(m)} min`;
const startTimeOptions: [string, string][] = Array.from(
  { length: 48 },
  (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 ? "30" : "00";
    const value = `${String(hour).padStart(2, "0")}:${minute}`;
    return [value, `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`];
  },
);
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value?: string;
  onChange: (v: string) => void;
  options: (string | [string, string])[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="choice" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem
            key={typeof o === "string" ? o : o[0]}
            value={typeof o === "string" ? o : o[0]}
          >
            {typeof o === "string" ? o : o[1]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Field({ label, children }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({ icon: Icon = BookOpen, title, body, children }: any) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={29} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
function NavButton({ label, Icon, selected, onClick }: any) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={selected}
        onClick={() => {
          onClick();
          setOpenMobile(false);
        }}
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
function SidebarToggle({ inDrawer = false }: { inDrawer?: boolean }) {
  const { open, openMobile, isMobile } = useSidebar();
  // Only the active location renders a control, including while the mobile sheet exits.
  if (inDrawer !== (isMobile && openMobile)) return null;
  const expanded = isMobile ? openMobile : open;
  return (
    <SidebarTrigger
      aria-label={expanded ? "Close sidebar" : "Open sidebar"}
      aria-expanded={expanded}
      title={expanded ? "Close sidebar" : "Open sidebar"}
    />
  );
}
export default function Nexovia({
  sidebarDefaultOpen = true,
  googleEnabled = false,
}: {
  sidebarDefaultOpen?: boolean;
  googleEnabled?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(sidebarDefaultOpen);
  const [page, setPage] = useState("Overview"),
    [state, setState] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showBuilder, setShowBuilder] = useState(false),
    [selectedDate, setSelectedDate] = useState(today()),
    [selectedTask, setSelectedTask] = useState<Task | null>(null),
    [edit, setEdit] = useState<any>(null),
    [focus, setFocus] = useState<Task | null>(null),
    [started, setStarted] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [running, setRunning] = useState(false),
    [minutes, setMinutes] = useState(25),
    [complete, setComplete] = useState(false);
  const stateRef = useRef<any>(null),
    notificationIds = useRef<Set<string>>(new Set()),
    notificationsReady = useRef(false);
  stateRef.current = state;
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/workspace");
      const data: any = await r.json();
      if (data.error) {
        setError(data.error);
        setState(data);
        return;
      }
      const incoming: any[] = data.notifications || [];
      if (notificationsReady.current) {
        for (const item of incoming.filter(
          (item) => !item.read && !notificationIds.current.has(item.id),
        )) {
          toast.info(item.title, { description: item.body });
          if ("Notification" in window && Notification.permission === "granted")
            new Notification(item.title, { body: item.body, tag: item.id });
        }
      }
      notificationIds.current = new Set(incoming.map((item) => item.id));
      notificationsReady.current = true;
      setState(data);
      setError("");
    } catch {
      setError("Could not load your workspace. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    const hash = decodeURIComponent(location.hash.slice(1));
    if (
      [...nav.map((n) => n[0]), "Settings", "Notifications"].includes(
        hash as any,
      )
    )
      setPage(hash);
    return () => clearInterval(t);
  }, [load]);
  const go = (p: string) => {
    setPage(p);
    history.replaceState(null, "", "#" + encodeURIComponent(p));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  async function act(action: string, data: any = {}, message = "Saved") {
    setBusy(true);
    try {
      const result = await api(action, data);
      if (result.profile) setState(result);
      if (action === "submitQuiz") await load();
      if (message) toast.success(message);
      return result;
    } catch (e: any) {
      toast.error(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!running) return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [running, started]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const controller = new AbortController();
    for (const tool of [
      {
        name: "read_nexovia_plan",
        description:
          "Read the signed-in learner’s active dated study plan and tasks.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async () => ({
          plan: stateRef.current?.plan,
          tasks: stateRef.current?.tasks || [],
        }),
      },
      {
        name: "open_nexovia_planner",
        description:
          "Open the study planner. Does not create or change a plan.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input: any) => {
          if (!input || Object.keys(input).length)
            throw Error("No input fields are accepted.");
          setPage("Study planner");
          history.replaceState(null, "", "#Study%20planner");
          return { page: "Study planner" };
        },
      },
    ])
      Promise.resolve(
        ctx.registerTool(tool, { signal: controller.signal }),
      ).catch(() => {});
    return () => controller.abort();
  }, []);
  const tasks: Task[] = state?.tasks || [],
    sessions = state?.sessions || [],
    profile = state?.profile;
  const done = tasks.filter((t) => t.status === "completed"),
    todayTasks = tasks.filter((t) => t.date === today()),
    dailyMinutes = sessions
      .filter((s: any) => s.date === today())
      .reduce((a: number, s: any) => a + s.minutes, 0),
    weekStart = addDays(today(), -6),
    weekMinutes = sessions
      .filter((s: any) => s.date >= weekStart)
      .reduce((a: number, s: any) => a + s.minutes, 0);
  let streak = 0;
  const studyDates = new Set(sessions.map((s: any) => s.date));
  let offset = studyDates.has(today()) ? 0 : 1;
  while (studyDates.has(addDays(today(), -offset - streak))) streak++;
  const notifications =
    profile?.reminders === 0
      ? []
      : tasks.filter((t) => {
          const lead =
            (t.priority === "high" ? 30 : 10) +
            (t.difficulty === "hard" ? 15 : 0) +
            (t.deadline === today() ? 15 : 0);
          const remindAt =
            new Date(t.date + "T" + t.time + ":00+05:30").getTime() -
            lead * 60000;
          return (
            t.status !== "completed" &&
            (!t.snoozeUntil || new Date(t.snoozeUntil) < new Date()) &&
            Date.now() >= remindAt
          );
        });
  const missed = tasks.filter(
    (t) => t.date < today() && t.status !== "completed",
  );
  const focusTask = (task: Task) => {
    setFocus(task);
    setStarted(Date.now());
    setElapsed(0);
    setRunning(true);
    setMinutes(task.duration);
    setComplete(false);
  };
  const openTask = (task: Task) => {
    setSelectedTask(task);
    setEdit({ ...task });
    setMinutes(task.duration);
    setComplete(false);
  };
  const saveSession = async (task: Task, m: number) => {
    const r = await act("logSession", {
      taskId: task.id,
      minutes: m,
      complete,
    });
    if (r) {
      setFocus(null);
      setRunning(false);
      setSelectedTask(null);
    }
  };
  const recover = async (task: Task) => {
    const result = await act("recover", { id: task.id }, "");
    if (result) {
      setSelectedTask(task);
      setEdit({ ...task, ...result.proposal });
      toast.info("Suggested free slot. Review it and save to move this task.");
    }
  };
  const taskList = (list: Task[], preview = false) =>
    list.map((t, i) => (
      <div
        className={"task-row " + (t.status === "completed" ? "done" : "")}
        key={t.id}
      >
        <div className="task-time">
          {t.time}
          <span>{t.duration} min</span>
        </div>
        <div className={"task-stripe tone-" + (i % 3)} />
        <div className="task-main">
          <span className={"subject-chip tone-" + (i % 3)}>{t.subject}</span>
          <button className="task-title" onClick={() => openTask(t)}>
            {t.topic}
          </button>
          <p>
            {t.kind} <span>·</span> {t.difficulty}{" "}
            {t.deadline && (
              <>
                <span>·</span> Due {dateLabel(t.deadline)}
              </>
            )}
          </p>
        </div>
        <div className="task-actions">
          {t.status === "completed" ? (
            <span className="completed">
              <CheckCircle2 size={17} /> Done
            </span>
          ) : (
            <>
              <button
                className="icon-button"
                title="Edit task"
                onClick={() => openTask(t)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="play-button"
                onClick={() => focusTask(t)}
                title="Start focus session"
              >
                <Play size={14} fill="currentColor" />
              </button>
              <Checkbox
                aria-label={"Complete " + t.topic}
                checked={false}
                onCheckedChange={() =>
                  act(
                    "task",
                    { id: t.id, operation: "complete", complete: true },
                    "Task completed. Log a session to record actual time.",
                  )
                }
              />
            </>
          )}
        </div>
      </div>
    ));
  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{ "--sidebar-width": "252px" } as any}
    >
      <Sidebar>
        <SidebarHeader className="brand">
          <span className="brand-icon">N</span>
          <b>
            Nexovia<span>THE STUDY WORKSPACE</span>
          </b>
          <span className="sidebar-close">
            <SidebarToggle inDrawer />
          </span>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-label">YOUR WORKSPACE</p>
          <SidebarMenu>
            {nav.map(([label, Icon]) => (
              <NavButton
                key={label}
                label={label}
                Icon={Icon}
                selected={page === label}
                onClick={() => go(label)}
              />
            ))}
          </SidebarMenu>
          <p className="nav-label second">PREFERENCES</p>
          <SidebarMenu>
            {[
              ["Notifications", Bell],
              ["Settings", Settings],
            ].map(([label, Icon]: any) => (
              <NavButton
                key={label}
                label={label}
                Icon={Icon}
                selected={page === label}
                onClick={() => go(label)}
              />
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="side-note">
            <Sparkles />
            <b>A little progress. Every day.</b>
            <p>Your next chapter starts with one focused session.</p>
          </div>
          <button className="profile-button" onClick={() => go("Settings")}>
            <span className="avatar">{initials(profile?.name || "N")}</span>
            <div>
              <b>{profile?.name || "Your workspace"}</b>
              <span>Personal account</span>
            </div>
            <Settings size={15} />
          </button>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <div>
            <SidebarToggle /> <span className="crumb-root">My workspace</span>{" "}
            <span className="crumb-root">/</span> <b>{page}</b>
          </div>
          <div>
            <ThemeToggle />
            <span className="date-top">
              {dateLabel(today(), {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="topbar-divider" aria-hidden="true" />
            <button
              className="icon-button bell-button"
              aria-label="Notifications"
              onClick={() => go("Notifications")}
            >
              <Bell size={19} />
              <span className="notification-count">
                {(state?.unreadNotifications || 0) + notifications.length || ""}
              </span>
            </button>
            <button
              className="avatar"
              aria-label="Profile settings"
              onClick={() => go("Settings")}
            >
              {initials(profile?.name || "N")}
            </button>
          </div>
        </header>
        <div className="page">
          {loading && (
            <div className="loading-note">
              <Loader2 size={14} className="spin" /> Opening your workspace…
            </div>
          )}
          {error && (
            <div className="notice">
              <Info size={18} />
              <span>{error}</span>
              {state?.signIn ? (
                <a className="secondary" href="/login">
                  Log in
                </a>
              ) : (
                <button className="secondary" onClick={load}>
                  Retry
                </button>
              )}
            </div>
          )}
          {page === "Overview" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">YOUR SPACE TO GROW</p>
                  <UserGreeting name={profile?.name} />
                  <p>
                    {state?.plan
                      ? "A clear plan for today. A little closer to your goals."
                      : "One clear plan. A little focus. A lot of possibility."}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setShowBuilder(true)}
                >
                  <Plus size={17} /> Create a study plan
                </button>
              </div>
              <section className="hero-panel">
                <div>
                  <span className="pill">
                    <Sparkles size={14} /> MADE FOR YOUR WAY OF LEARNING
                  </span>
                  <h2>
                    {state?.plan ? "Your goals. Your pace." : "Big goals."}
                    <br />
                    <em>
                      {state?.plan
                        ? "Let’s find your focus."
                        : "Small, meaningful steps."}
                    </em>
                  </h2>
                  <p>
                    {state?.plan
                      ? `${todayTasks.length} sessions planned today. Start with one, and let the momentum follow.`
                      : "Turn your subjects, deadlines and available time into a plan that works for you."}
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      state?.plan ? go("Study planner") : setShowBuilder(true)
                    }
                  >
                    {state?.plan ? <Play size={16} /> : <Sparkles size={17} />}{" "}
                    {state?.plan ? "Open my study plan" : "Build my study plan"}
                  </button>
                  <span className="hero-caption">
                    Learn smarter. Connect better. Grow together.
                  </span>
                </div>
                <div className="study-art" aria-hidden="true">
                  <div className="art-sheet">
                    <BookOpen size={27} />
                    <div className="art-lines">
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="art-stamp">
                      <CheckCircle2 size={28} />
                    </span>
                  </div>
                  <span className="art-label first">
                    <Sparkles size={16} /> A little more clarity.
                  </span>
                  <span className="art-label last">
                    <CheckCircle2 size={17} /> One step closer.
                  </span>
                </div>
              </section>
              <div className="stats">
                {[
                  [
                    Clock,
                    "Study time today",
                    fmt(dailyMinutes),
                    `${fmt(todayTasks.reduce((n, t) => n + t.duration, 0))} planned`,
                  ],
                  [
                    CheckCircle2,
                    "Tasks completed",
                    `${done.length} / ${tasks.length}`,
                    tasks.length
                      ? `${Math.round((done.length / tasks.length) * 100)}% of your active plan`
                      : "Your next small win is waiting",
                  ],
                  [
                    Flame,
                    "Study streak",
                    `${streak} ${streak === 1 ? "day" : "days"}`,
                    "Built from actual study sessions",
                  ],
                  [
                    Target,
                    "Weekly goal",
                    `${Math.min(100, Math.round((weekMinutes / (profile?.goal || 600)) * 100))}%`,
                    `${fmt(weekMinutes)} of ${fmt(profile?.goal || 600)}`,
                  ],
                ].map(([Icon, label, val, detail]: any) => (
                  <div className="stat" key={label}>
                    <span className="icon-tile">
                      <Icon size={19} />
                    </span>
                    <p>{label}</p>
                    <strong>{val}</strong>
                    <small>{detail}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel schedule-panel">
                  <div className="section-title">
                    <div>
                      <h2>Today’s study plan</h2>
                      <p>
                        {dateLabel(today(), {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => go("Study planner")}
                    >
                      View planner <ChevronRight size={15} />
                    </button>
                  </div>
                  {todayTasks.length ? (
                    taskList(todayTasks)
                  ) : (
                    <Empty
                      title={
                        state?.plan
                          ? "Room to breathe today"
                          : "A fresh page for your goals"
                      }
                      body={
                        state?.plan
                          ? "You have no sessions scheduled today. Explore your upcoming days in the planner."
                          : "Create a plan around your subjects, deadlines and available time."
                      }
                    >
                      <button
                        className="secondary"
                        onClick={() =>
                          state?.plan
                            ? go("Study planner")
                            : setShowBuilder(true)
                        }
                      >
                        <CalendarDays size={16} />{" "}
                        {state?.plan
                          ? "View upcoming sessions"
                          : "Create my first plan"}
                      </button>
                    </Empty>
                  )}
                </section>
                <section className="panel insight">
                  <span className="eyebrow">
                    <Sparkles size={15} /> YOUR STUDY INSIGHT
                  </span>
                  <h2>
                    {missed.length
                      ? "A fresh start is always possible."
                      : sessions.length >= 5
                        ? "Make your plan fit your pace."
                        : "Work with your energy."}
                  </h2>
                  <p>
                    {missed.length
                      ? `${missed.length} unfinished sessions need a new home. Review a recovery suggestion without changing completed work.`
                      : sessions.length >= 5
                        ? `Your average logged session is ${Math.round(sessions.reduce((a: number, s: any) => a + s.minutes, 0) / sessions.length)} minutes. Adaptive planning can use this as a starting point.`
                        : "Start with a manageable study window. As you log sessions, Nexovia can suggest a pace based on your actual study time."}
                  </p>
                  <button
                    className="text-link"
                    onClick={() =>
                      go(
                        missed.length ? "Notifications" : "Progress & insights",
                      )
                    }
                  >
                    {missed.length
                      ? "Review missed sessions"
                      : "Explore your progress"}{" "}
                    <ChevronRight size={15} />
                  </button>
                  <div className="insight-footer">
                    <ShieldCheck size={15} /> You stay in control of every
                    change.
                  </div>
                </section>
              </div>
              <section className="quick-tools">
                <div className="section-title">
                  <h2>A little help along the way</h2>
                  <span>TOOLS FOR YOUR NEXT BREAKTHROUGH</span>
                </div>
                <div className="tools-grid">
                  {[
                    [
                      Sparkles,
                      "Untangle a concept",
                      "Open your study assistant",
                      "AI study assistant",
                    ],
                    [
                      Layers,
                      "Make knowledge stick",
                      "Review flashcards & try a quiz",
                      "Flashcards & quizzes",
                    ],
                    [
                      Users,
                      "Learn better, together",
                      "Find your study people",
                      "Community",
                    ],
                  ].map(([Icon, title, desc, p]: any) => (
                    <button
                      key={title}
                      className="tool-card"
                      onClick={() => go(p)}
                    >
                      <span>
                        <Icon size={21} />
                      </span>
                      <div>
                        <b>{title}</b>
                        <p>{desc}</p>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {page === "Study planner" && (
            <PlannerPage
              state={state}
              tasks={tasks}
              done={done}
              missed={missed}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              setShowBuilder={setShowBuilder}
              taskList={taskList}
              openTask={openTask}
              go={go}
              act={act}
              busy={busy}
            />
          )}
          {page === "AI study assistant" && (
            <AssistantPlus state={state} act={act} busy={busy} />
          )}
          {page === "Resources" && (
            <Resources state={state} act={act} load={load} busy={busy} />
          )}
          {page === "Flashcards & quizzes" && (
            <Practice state={state} act={act} busy={busy} go={go} />
          )}
          {page === "Progress & insights" && (
            <Analytics state={state} onPlan={() => setShowBuilder(true)} />
          )}
          {page === "Community" && (
            <CommunityPlus
              state={state}
              act={act}
              go={go}
              busy={busy}
              load={load}
            />
          )}
          {page === "Settings" && (
            <SettingsView
              state={state}
              act={act}
              busy={busy}
              googleEnabled={googleEnabled}
            />
          )}
          {page === "Notifications" && (
            <NotificationsView
              state={state}
              taskNotifications={notifications}
              act={act}
              go={go}
              openTask={openTask}
              recover={recover}
            />
          )}
        </div>
        <footer className="app-footer">
          <span>NEXOVIA</span> Learn smarter. Connect better. Grow together.
        </footer>
      </main>
      <PlanBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        state={state}
        act={act}
        busy={busy}
        onSaved={(date: string) => {
          setShowBuilder(false);
          go("Study planner");
          setSelectedDate(date);
        }}
      />
      <Dialog
        open={!!selectedTask}
        onOpenChange={(v) => !v && setSelectedTask(null)}
      >
        <DialogContent className="task-modal">
          <DialogHeader>
            <DialogTitle>{selectedTask?.topic}</DialogTitle>
            <DialogDescription>
              {selectedTask?.subject} · {selectedTask?.kind}
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Task details</TabsTrigger>
                <TabsTrigger value="log">Log study time</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <div className="form-grid">
                  <Field label="Topic">
                    <input
                      value={edit.topic}
                      onChange={(e) =>
                        setEdit({ ...edit, topic: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      type="date"
                      min={today()}
                      value={edit.date}
                      onChange={(e) =>
                        setEdit({ ...edit, date: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Start time">
                    <input
                      type="time"
                      value={edit.time}
                      onChange={(e) =>
                        setEdit({ ...edit, time: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Planned minutes">
                    <input
                      type="number"
                      min="5"
                      max="240"
                      value={edit.duration}
                      onChange={(e) =>
                        setEdit({ ...edit, duration: Number(e.target.value) })
                      }
                    />
                  </Field>
                </div>
                <div className="modal-actions">
                  <button
                    className="secondary"
                    disabled={busy || selectedTask?.status === "completed"}
                    onClick={() => recover(selectedTask!)}
                  >
                    <RotateCcw size={16} /> Suggest time
                  </button>
                  <button
                    className="primary"
                    disabled={busy || selectedTask?.status === "completed"}
                    onClick={async () => {
                      if (
                        await act(
                          "task",
                          {
                            id: selectedTask!.id,
                            operation: "edit",
                            task: edit,
                          },
                          "Task updated",
                        )
                      )
                        setSelectedTask(null);
                    }}
                  >
                    Save changes
                  </button>
                </div>
                {selectedTask?.status === "completed" && (
                  <p className="help">
                    Completed work is preserved. You can still log an actual
                    study session.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="log">
                <p className="help">
                  Planned minutes are a target. Record the time you actually
                  studied here.
                </p>
                <Field label="Actual study minutes">
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  />
                </Field>
                <label className="check-label">
                  <Checkbox
                    checked={complete}
                    onCheckedChange={(v) => setComplete(v === true)}
                  />{" "}
                  Also mark task complete
                </label>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => saveSession(selectedTask!, minutes)}
                >
                  Save study session
                </button>
              </TabsContent>
              <TabsContent value="resources">
                {(state?.resources || [])
                  .filter(
                    (r: any) =>
                      r.topic &&
                      [selectedTask?.topic, selectedTask?.subject].some(
                        (t) =>
                          t?.toLowerCase().includes(r.topic.toLowerCase()) ||
                          r.topic.toLowerCase().includes(t?.toLowerCase()),
                      ),
                  )
                  .map((r: any) => (
                    <a
                      className="attached-resource"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      key={r.id}
                    >
                      <FileText size={18} />
                      {r.title}
                      <ExternalLink size={14} />
                    </a>
                  ))}
                <p className="help">
                  Resources with a matching topic appear here automatically.
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    setSelectedTask(null);
                    go("Resources");
                  }}
                >
                  Manage resources
                </button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!focus}
        onOpenChange={(v) => {
          if (!v) {
            setFocus(null);
            setRunning(false);
          }
        }}
      >
        <DialogContent className="focus-modal">
          <DialogHeader>
            <DialogTitle>One thing at a time.</DialogTitle>
            <DialogDescription>
              {focus?.subject} · {focus?.topic}
            </DialogDescription>
          </DialogHeader>
          <div className="timer-face">
            <span className="eyebrow">FOCUS SESSION</span>
            <strong>
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </strong>
            <p>{focus?.duration} minutes planned</p>
          </div>
          <div className="timer-controls">
            <button
              className="secondary"
              onClick={() => {
                setStarted(Date.now() - elapsed * 1000);
                setRunning(!running);
              }}
            >
              {running ? <Pause size={17} /> : <Play size={17} />}{" "}
              {running ? "Pause" : "Resume"}
            </button>
            <button
              className="primary"
              disabled={elapsed < 60 || busy}
              onClick={() =>
                saveSession(focus!, Math.max(1, Math.round(elapsed / 60)))
              }
            >
              <Square size={15} /> Finish & log
            </button>
          </div>
          <label className="check-label">
            <Checkbox
              checked={complete}
              onCheckedChange={(v) => setComplete(v === true)}
            />{" "}
            Mark task complete when I finish
          </label>
          <p className="help">
            Actual elapsed time is saved when you finish. Closing this timer
            discards this unsaved session.
          </p>
        </DialogContent>
      </Dialog>
      <Toaster
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        position="bottom-right"
        richColors
      />
    </SidebarProvider>
  );
}
function PageHeading({ eyebrow, title, subtitle, children }: any) {
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
function PlannerPage({
  state,
  tasks,
  done,
  missed,
  selectedDate,
  setSelectedDate,
  setShowBuilder,
  taskList,
  openTask,
  go,
  act,
  busy,
}: any) {
  const plans: any[] = state?.plans || [];
  const archived: any[] = state?.archived || [];
  return (
    <>
      <PageHeading
        eyebrow="A PLAN THAT FITS YOUR LIFE"
        title="Study planner"
        subtitle="Your subjects, deadlines and saved plans together in one calendar."
      >
        <button className="primary" onClick={() => setShowBuilder(true)}>
          <Plus size={17} /> Add a plan
        </button>
      </PageHeading>
      {plans.length ? (
        <>
          <div className="plan-banner">
            <div>
              <span className="pill">
                {plans.length} SAVED {plans.length === 1 ? "PLAN" : "PLANS"}
              </span>
              <h2>Your study schedule</h2>
              <p>
                {tasks.length} sessions across your saved plans · Add another
                day without losing this work.
              </p>
            </div>
            <div className="plan-progress">
              <span>
                {done.length} of {tasks.length} complete
              </span>
              <Progress
                value={tasks.length ? (done.length / tasks.length) * 100 : 0}
              />
            </div>
          </div>
          <section className="saved-plans">
            <div className="section-title">
              <h2>Saved plans</h2>
              <span className="muted">
                Choose a plan to jump to its first day
              </span>
            </div>
            <div className="saved-plan-grid">
              {plans.map((p) => {
                const sessions = tasks.filter((t: Task) => t.planId === p.id);
                return (
                  <button
                    className="saved-plan-card"
                    key={p.id}
                    onClick={() => setSelectedDate(p.input.start)}
                  >
                    <span className="subject-chip tone-0">
                      {dateLabel(p.input.start)} –{" "}
                      {dateLabel(addDays(p.input.start, p.input.days - 1))}
                    </span>
                    <b>{p.title}</b>
                    <small>
                      {sessions.length} sessions ·{" "}
                      {
                        sessions.filter((t: Task) => t.status === "completed")
                          .length
                      }{" "}
                      complete
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="date-strip">
            <button
              className="icon-button"
              aria-label="Previous day"
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            >
              <ChevronLeft />
            </button>
            {Array.from({ length: 7 }, (_, i) =>
              addDays(selectedDate, -3 + i),
            ).map((d) => (
              <button
                key={d}
                className={d === selectedDate ? "selected" : ""}
                onClick={() => setSelectedDate(d)}
              >
                <span>{dateLabel(d, { weekday: "short" })}</span>
                <b>{dateLabel(d, { day: "numeric" })}</b>
                <i
                  className={
                    tasks.some((t: Task) => t.date === d) ? "has-tasks" : ""
                  }
                />
              </button>
            ))}
            <button
              className="icon-button"
              aria-label="Next day"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="section-title">
            <h2>
              {dateLabel(selectedDate, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
            <button
              className="secondary small"
              onClick={() => setSelectedDate(today())}
            >
              Today
            </button>
          </div>
          <section className="panel">
            {tasks.some((t: Task) => t.date === selectedDate) ? (
              taskList(tasks.filter((t: Task) => t.date === selectedDate))
            ) : (
              <Empty
                icon={CalendarDays}
                title="An open day"
                body="Choose another date or add a plan for this day."
              />
            )}
          </section>
          {missed.length > 0 && (
            <div className="notice amber">
              <RotateCcw size={18} />
              <span>
                {missed.length} missed sessions can be reviewed for recovery.
              </span>
              <button className="secondary" onClick={() => go("Notifications")}>
                Review
              </button>
            </div>
          )}
          <div className="panel below">
            <div className="section-title">
              <h2>All planned sessions</h2>
              <span className="muted">{tasks.length} total</span>
            </div>
            <div className="all-tasks">
              {tasks.map((t: Task) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedDate(t.date);
                    openTask(t);
                  }}
                >
                  <span
                    className={
                      "subject-dot tone-" + (t.subject.includes("Data") ? 0 : 1)
                    }
                  />
                  <div>
                    <b>{t.topic}</b>
                    <span>
                      {plans.find((p) => p.id === t.planId)?.title || t.subject}{" "}
                      · {t.subject} · {t.kind}
                    </span>
                  </div>
                  <span>
                    {dateLabel(t.date)} · {t.time}
                  </span>
                  {t.status === "completed" && <CheckCircle2 size={16} />}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <section className="panel">
          <Empty
            icon={CalendarDays}
            title="Less wondering. More learning."
            body="Choose a day or date range, add your topics, then review the schedule before saving."
          >
            <button className="primary" onClick={() => setShowBuilder(true)}>
              <Sparkles size={17} /> Build my study plan
            </button>
          </Empty>
          <div className="steps-row">
            <span>01 · Add your goals</span>
            <span>02 · Review your plan</span>
            <span>03 · Make progress</span>
          </div>
        </section>
      )}
      {archived.length > 0 && (
        <section className="panel below">
          <div className="section-title">
            <h2>Earlier saved plans</h2>
            <span className="muted">
              These plans were archived by the earlier planner
            </span>
          </div>
          {archived.map((p) => (
            <details className="archived-plan" key={p.id}>
              <summary>
                <span>
                  <b>{p.title}</b>
                  <small>
                    {dateLabel(p.input.start)} –{" "}
                    {dateLabel(addDays(p.input.start, p.input.days - 1))} ·{" "}
                    {p.tasks.length} sessions
                  </small>
                </span>
                <ChevronRight size={16} />
              </summary>
              <div className="archived-contents">
                {p.tasks.map((t: Task) => (
                  <div key={t.id} className="archived-task">
                    <span>
                      {dateLabel(t.date)} · {t.time}
                    </span>
                    <b>{t.topic}</b>
                    <span>
                      {t.status === "completed" ? "Completed" : t.subject}
                    </span>
                  </div>
                ))}
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    act(
                      "restorePlan",
                      { id: p.id },
                      "Saved plan restored to your calendar",
                    )
                  }
                >
                  Restore to calendar
                </button>
              </div>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
function PlanBuilder({ open, onClose, state, act, busy, onSaved }: any) {
  const [input, setInput] = useState<PlanInput>(defaultInput),
    [preview, setPreview] = useState<any>(null),
    [step, setStep] = useState("setup");
  useEffect(() => {
    if (open) {
      setInput(defaultInput());
      setPreview(null);
      setStep("setup");
    }
  }, [open]);
  const patch = (key: string, value: any) =>
    setInput((p) => ({ ...p, [key]: value }));
  const generate = async () => {
    const r = await act(
      "preview",
      {
        input: {
          ...input,
          adaptive: !!state?.profile?.adaptive && input.adaptive,
        },
      },
      "",
    );
    if (r) {
      setPreview(r);
      setStep("preview");
    }
  };
  const updateTask = (i: number, key: string, value: any) =>
    setPreview((p: any) => ({
      ...p,
      tasks: p.tasks.map((t: any, j: number) =>
        j === i ? { ...t, [key]: value, manual: 1 } : t,
      ),
    }));
  let previewErrors: string[] = [];
  if (preview?.tasks?.length) {
    try {
      validateTasks(preview.tasks, input);
      previewErrors = planConflicts(preview.tasks, state?.tasks || [], input);
    } catch (e: any) {
      previewErrors = [e.message];
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="builder-modal">
        <DialogHeader>
          <div className="modal-kicker">
            <Sparkles size={16} /> YOUR NEXT CHAPTER
          </div>
          <DialogTitle>
            {step === "setup"
              ? "Let’s make a plan that fits."
              : "Make this plan your own."}
          </DialogTitle>
          <DialogDescription>
            {step === "setup"
              ? "Tell us what you’re working towards. Review everything before it becomes your active plan."
              : "Edit your sessions, check the workload, then save when you’re ready."}
          </DialogDescription>
        </DialogHeader>
        <div className="builder-steps">
          <span className={step === "setup" ? "active" : ""}>
            1 · Your goals & time
          </span>
          <span className={step === "preview" ? "active" : ""}>
            2 · Review & save
          </span>
        </div>
        {step === "setup" ? (
          <div className="builder-body">
            <div className="form-grid">
              <Field label="Plan name">
                <input
                  value={input.title}
                  onChange={(e) => patch("title", e.target.value)}
                  placeholder="e.g. Mid-semester momentum"
                />
              </Field>
              <Field label="Start date">
                <input
                  type="date"
                  min={today()}
                  value={input.start}
                  onChange={(e) => patch("start", e.target.value)}
                />
              </Field>
            </div>
            <Field label="How far ahead would you like to plan?">
              <div className="duration-options">
                {[
                  ["1", "Today"],
                  ["tomorrow", "Tomorrow"],
                  ["3", "3 days"],
                  ["7", "7 days"],
                  ["14", "14 days"],
                  ["custom", "Custom"],
                ].map(([v, label]) => (
                  <button
                    className={
                      (
                        v === "tomorrow"
                          ? input.days === 1 &&
                            input.start === addDays(today(), 1)
                          : String(input.days) === v &&
                            !(v === "1" && input.start === addDays(today(), 1))
                      )
                        ? "selected"
                        : ""
                    }
                    key={v}
                    onClick={() => {
                      if (v === "custom") {
                        patch("days", 10);
                        return;
                      }
                      patch("days", v === "tomorrow" ? 1 : Number(v));
                      if (v === "tomorrow") patch("start", addDays(today(), 1));
                      else if (v === "1") patch("start", today());
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="form-grid four">
              <Field label="Days (1–31)">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={input.days}
                  onChange={(e) => patch("days", Number(e.target.value))}
                />
              </Field>
              <Field label="Weekday minutes">
                <input
                  type="number"
                  min="15"
                  max="480"
                  value={input.weekday}
                  onChange={(e) => patch("weekday", Number(e.target.value))}
                />
              </Field>
              <Field label="Weekend minutes">
                <input
                  type="number"
                  min="15"
                  max="480"
                  value={input.weekend}
                  onChange={(e) => patch("weekend", Number(e.target.value))}
                />
              </Field>
              <Field label="Session minutes">
                <input
                  type="number"
                  min="15"
                  max="120"
                  value={input.session}
                  onChange={(e) => patch("session", Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Preferred start time (India)">
                <Choice
                  value={input.startTime}
                  onChange={(value) => patch("startTime", value)}
                  options={startTimeOptions}
                  label="Preferred start time"
                />
              </Field>
              <div className="toggle-field">
                <div>
                  <b>Adapt to my study pace</b>
                  <span>Uses logged sessions after 5 sessions.</span>
                </div>
                <Switch
                  checked={input.adaptive}
                  onCheckedChange={(v) => patch("adaptive", v)}
                />
              </div>
            </div>
            <div className="section-title">
              <h3>What are you learning?</h3>
              <button
                className="text-link"
                onClick={() =>
                  patch("subjects", [
                    ...input.subjects,
                    {
                      name: "",
                      topics: "",
                      priority: "medium",
                      difficulty: "medium",
                      deadline: "",
                      weak: false,
                    },
                  ])
                }
              >
                <Plus size={15} /> Add subject
              </button>
            </div>
            {input.subjects.map((s, i) => (
              <div className="subject-form" key={i}>
                <div className="subject-number">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="subject-fields">
                  <div className="form-grid">
                    <Field label="Subject">
                      <input
                        value={s.name}
                        onChange={(e) =>
                          patch(
                            "subjects",
                            input.subjects.map((v, j) =>
                              j === i ? { ...v, name: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Topics, separated by commas">
                      <input
                        value={s.topics}
                        onChange={(e) =>
                          patch(
                            "subjects",
                            input.subjects.map((v, j) =>
                              j === i ? { ...v, topics: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <div className="form-grid three">
                    <Field label="Priority">
                      <Choice
                        value={s.priority}
                        onChange={(v) =>
                          patch(
                            "subjects",
                            input.subjects.map((a, j) =>
                              j === i ? { ...a, priority: v } : a,
                            ),
                          )
                        }
                        options={["high", "medium", "low"]}
                        label="Priority"
                      />
                    </Field>
                    <Field label="Difficulty">
                      <Choice
                        value={s.difficulty}
                        onChange={(v) =>
                          patch(
                            "subjects",
                            input.subjects.map((a, j) =>
                              j === i ? { ...a, difficulty: v } : a,
                            ),
                          )
                        }
                        options={["easy", "medium", "hard"]}
                        label="Difficulty"
                      />
                    </Field>
                    <Field label="Deadline (optional)">
                      <input
                        type="date"
                        min={input.start}
                        value={s.deadline}
                        onChange={(e) =>
                          patch(
                            "subjects",
                            input.subjects.map((a, j) =>
                              j === i ? { ...a, deadline: e.target.value } : a,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <label className="check-label">
                    <Checkbox
                      checked={s.weak}
                      onCheckedChange={(v) =>
                        patch(
                          "subjects",
                          input.subjects.map((a, j) =>
                            j === i ? { ...a, weak: v === true } : a,
                          ),
                        )
                      }
                    />{" "}
                    I need more revision here
                  </label>
                </div>
                {input.subjects.length > 1 && (
                  <button
                    className="icon-button"
                    title="Remove subject"
                    onClick={() =>
                      patch(
                        "subjects",
                        input.subjects.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <p className="help">
              <Info size={14} /> Gemini AI prioritizes your topics when
              connected. Every generated plan is still checked for deadlines,
              available time and conflicts.
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="primary" disabled={busy} onClick={generate}>
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}{" "}
                Generate plan preview
              </button>
            </div>
          </div>
        ) : (
          <div className="builder-body">
            <div className="notice">
              <Info size={17} />
              <span>{preview?.note}</span>
            </div>
            <div className="preview-summary">
              <b>{preview?.tasks.length} sessions</b>
              <span>{input.days} days</span>
              <span>
                {fmt(
                  preview?.tasks.reduce(
                    (a: number, t: Task) => a + t.duration,
                    0,
                  ) || 0,
                )}{" "}
                total
              </span>
              <span className="pill">NOT SAVED YET</span>
            </div>
            {preview?.tasks.map((t: Task, i: number) => (
              <div key={t.id} className="preview-task">
                <span className="subject-chip tone-0">
                  {t.subject} · {t.kind}
                </span>
                <div className="form-grid preview-fields">
                  <input
                    aria-label="Task topic"
                    value={t.topic}
                    onChange={(e) => updateTask(i, "topic", e.target.value)}
                  />
                  <input
                    aria-label="Task date"
                    type="date"
                    value={t.date}
                    onChange={(e) => updateTask(i, "date", e.target.value)}
                  />
                  <input
                    aria-label="Task time"
                    type="time"
                    value={t.time}
                    onChange={(e) => updateTask(i, "time", e.target.value)}
                  />
                  <input
                    aria-label="Task minutes"
                    type="number"
                    value={t.duration}
                    onChange={(e) =>
                      updateTask(i, "duration", Number(e.target.value))
                    }
                  />
                  <button
                    className="icon-button"
                    title="Remove from preview"
                    onClick={() =>
                      setPreview({
                        ...preview,
                        tasks: preview.tasks.filter(
                          (_: any, j: number) => j !== i,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {previewErrors.length > 0 && (
              <div className="notice amber">
                <Info size={17} />
                <span>
                  {previewErrors.join(" ")} Edit the date, time or available
                  minutes before saving.
                </span>
              </div>
            )}
            {state?.plans?.length > 0 && (
              <p className="help">
                This plan will be added to your calendar. Your saved plans and
                completed work stay available.
              </p>
            )}
            <div className="modal-actions">
              <button className="secondary" onClick={() => setStep("setup")}>
                Edit inputs
              </button>
              <button className="secondary" disabled={busy} onClick={generate}>
                <RotateCcw size={15} /> Regenerate preview
              </button>
              <button
                className="primary"
                disabled={
                  busy || !preview?.tasks.length || previewErrors.length > 0
                }
                onClick={async () => {
                  if (
                    await act(
                      "savePlan",
                      { input, tasks: preview.tasks },
                      "Plan added to your calendar",
                    )
                  ) {
                    setStep("setup");
                    setPreview(null);
                    onSaved(input.start);
                  }
                }}
              >
                <Check size={17} /> Save plan
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
function Assistant({ state, act, busy }: any) {
  const [question, setQuestion] = useState(""),
    [resourceId, setResourceId] = useState("none");
  const history = state?.history || [];
  const send = async (q = question) => {
    if (!q.trim()) return;
    if (
      await act(
        "tutor",
        { question: q, resourceId: resourceId === "none" ? null : resourceId },
        "",
      )
    )
      setQuestion("");
  };
  return (
    <>
      <PageHeading
        eyebrow="MAKE ROOM FOR UNDERSTANDING"
        title="Your study assistant"
        subtitle="Explore a concept, find a passage, or work through your notes."
      />
      <div className="notice">
        <Sparkles size={18} />
        <span>
          <b>Reference mode</b> · Built-in study notes and text-file search are
          available. Live AI conversation needs a connected provider.
        </span>
      </div>
      <section className="assistant-panel panel">
        <div className="chat-history">
          {!history.length ? (
            <div className="assistant-welcome">
              <span className="assistant-mark">
                <Sparkles size={34} />
              </span>
              <h2>What are we learning today?</h2>
              <p>A good question is a great place to start.</p>
              <div className="suggested-prompts">
                {[
                  "Explain graph traversal",
                  "Help me understand normalization",
                  "How do SQL joins work?",
                  "Explain dynamic programming",
                ].map((q) => (
                  <button key={q} onClick={() => send(q)}>
                    {q}
                    <Plus size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            history.map((m: any) => (
              <div key={m.id} className={"chat-message " + m.role}>
                <span className="message-avatar">
                  {m.role === "assistant" ? (
                    <Sparkles size={17} />
                  ) : (
                    initials(state?.profile?.name || "You")
                  )}
                </span>
                <div>
                  <b>
                    {m.role === "assistant"
                      ? "Nexovia · Reference notes"
                      : "You"}
                  </b>
                  <p>{m.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="composer">
          <Choice
            label="Study context"
            value={resourceId}
            onChange={setResourceId}
            options={[
              "none",
              ...(state?.resources || [])
                .filter((r: any) => r.content)
                .map((r: any) => [r.id, r.title]),
            ].map((v: any) =>
              v === "none" ? ["none", "Built-in study notes"] : v,
            )}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              aria-label="Ask a study question"
              placeholder="Ask about a concept or search your notes…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button
              className="primary"
              aria-label="Send question"
              disabled={busy || !question.trim()}
            >
              <Send size={17} />
            </button>
          </form>
          <p className="help">
            Check important facts against your course material.
          </p>
        </div>
      </section>
    </>
  );
}
function Resources({ state, act, load, busy }: any) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [url, setUrl] = useState(""),
    [topic, setTopic] = useState(""),
    [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = (state?.resources || []).filter((r: any) =>
    (r.title + " " + r.topic).toLowerCase().includes(query.toLowerCase()),
  );
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("topic", topic);
      const r = await fetch("/api/files", { method: "POST", body: form });
      const data: any = await r.json();
      if (data.error) throw Error(data.error);
      toast.success(data.note);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="GOOD MATERIAL. DEEPER UNDERSTANDING."
        title="Your resource shelf"
        subtitle="Keep useful links and notes close to the topics you’re studying."
      >
        <button className="primary" onClick={() => setOpen(true)}>
          <Plus size={17} /> Add resource
        </button>
      </PageHeading>
      <div className="resource-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search resources"
            placeholder="Find a resource or topic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="muted">{list.length} saved resources</span>
      </div>
      <div className="resource-layout">
        <section>
          {list.length ? (
            <div className="resource-grid">
              {list.map((r: any) => (
                <article key={r.id} className="resource-card">
                  <div className="resource-type">
                    <span className="resource-icon">
                      {r.kind === "link" ? <Link2 /> : <FileText />}
                    </span>
                    <span>{r.kind.toUpperCase()}</span>
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.topic || "General study material"}</p>
                  <div className="resource-card-footer">
                    <a
                      className="text-link"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.kind === "link" ? "Open resource" : "Download file"}
                      <ExternalLink size={14} />
                    </a>
                    {r.kind === "link" && (
                      <button
                        className="icon-button"
                        title="Remove saved link"
                        onClick={() =>
                          act("deleteResource", { id: r.id }, "Link removed")
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Empty
                title={
                  query
                    ? "No matching resources"
                    : "Build your personal bookshelf"
                }
                body={
                  query
                    ? "Try a different topic or title."
                    : "Save a lecture, add a useful article, or upload your notes. Matching topics connect resources to your plan."
                }
              >
                <button
                  className="secondary"
                  onClick={() => {
                    setTitle("");
                    setNotes("");
                    setOpen(true);
                  }}
                >
                  <Plus size={16} /> Add your first resource
                </button>
              </Empty>
            </section>
          )}
        </section>
        <aside className="panel discovery">
          <span className="eyebrow">EXPLORE & LEARN</span>
          <h2>Find your next explanation.</h2>
          <p>Search trusted learning destinations for your topic.</p>
          <input
            value={topic}
            aria-label="Resource discovery topic"
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Graph traversal"
          />
          {[
            [
              "Video lessons",
              "YouTube",
              "https://www.youtube.com/results?search_query=",
            ],
            [
              "Courses & explanations",
              "Khan Academy",
              "https://www.khanacademy.org/search?page_search_query=",
            ],
            [
              "Reference & documentation",
              "Web search",
              "https://www.google.com/search?q=",
            ],
          ].map(([label, site, base]) => (
            <a
              key={site}
              className="discovery-link"
              href={base + encodeURIComponent(topic || "computer science")}
              target="_blank"
              rel="noreferrer"
            >
              <div>
                <b>{label}</b>
                <span>{site}</span>
              </div>
              <ExternalLink size={16} />
            </a>
          ))}
          <p className="help">
            Opens a search on the selected site. Save useful links to your
            shelf.
          </p>
        </aside>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>A new addition to your shelf</DialogTitle>
            <DialogDescription>
              Match the topic to your planner to keep related material together.
            </DialogDescription>
          </DialogHeader>
          <Field label="Topic / subject">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Normalization"
            />
          </Field>
          <Tabs defaultValue="link">
            <TabsList>
              <TabsTrigger value="link">Save a link</TabsTrigger>
              <TabsTrigger value="file">Upload notes</TabsTrigger>
            </TabsList>
            <TabsContent value="link">
              <Field label="Resource title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. A visual guide to normal forms"
                />
              </Field>
              <Field label="URL">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                  placeholder="https://…"
                />
              </Field>
              <button
                className="primary"
                disabled={busy || !url}
                onClick={async () => {
                  if (
                    await act(
                      "resource",
                      { title, url, topic },
                      "Resource saved",
                    )
                  ) {
                    setTitle("");
                    setUrl("");
                    setOpen(false);
                  }
                }}
              >
                Save resource
              </button>
            </TabsContent>
            <TabsContent value="file">
              <button
                className="upload-zone"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={28} />
                <b>{uploading ? "Uploading your notes…" : "Choose a file"}</b>
                <span>PDF, TXT or Markdown · Up to 10 MB</span>
              </button>
              <input
                ref={fileRef}
                hidden
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <p className="help">
                PDF, TXT and Markdown notes can be searched in the assistant.
                Text-based PDFs are extracted automatically; scanned/image-only
                PDFs need OCR first.
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Practice({ state, act, busy, go }: any) {
  const [tab, setTab] = useState("flashcards"),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [notes, setNotes] = useState(""),
    [deck, setDeck] = useState<any>(null),
    [card, setCard] = useState(0),
    [flipped, setFlipped] = useState(false),
    [topic, setTopic] = useState(""),
    [count, setCount] = useState(5),
    [quiz, setQuiz] = useState<any>(null),
    [answers, setAnswers] = useState<number[]>([]),
    [result, setResult] = useState<any>(null);
  const rate = async (rating: string) => {
    if (await act("review", { id: deck.id, card, rating }, "")) {
      if (card < deck.cards.length - 1) {
        setCard(card + 1);
        setFlipped(false);
      } else {
        toast.success("Deck reviewed. Well done!");
        setDeck(null);
      }
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="TURN UNDERSTANDING INTO CONFIDENCE"
        title="Practice makes progress"
        subtitle="Recall it. Test it. Make it yours."
      >
        <button
          className="primary"
          onClick={() => {
            setTitle("");
            setNotes("");
            setOpen(true);
          }}
        >
          <Plus size={17} /> Create flashcards
        </button>
      </PageHeading>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="large-tabs">
          <TabsTrigger value="flashcards">
            <Layers size={16} /> Flashcards
          </TabsTrigger>
          <TabsTrigger value="quizzes">
            <Brain size={16} /> Quizzes
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock size={16} /> Recent practice
          </TabsTrigger>
        </TabsList>
        <TabsContent value="flashcards">
          <div className="section-title below">
            <h2>Your flashcard decks</h2>
            <span className="muted">{state?.decks?.length || 0} decks</span>
          </div>
          {state?.decks?.length ? (
            <div className="deck-grid">
              {state.decks.map((d: any, i: number) => (
                <button
                  className="deck-card"
                  key={d.id}
                  onClick={() => {
                    setDeck(d);
                    setCard(0);
                    setFlipped(false);
                  }}
                >
                  <div className={"deck-art tone-" + (i % 3)}>
                    <Layers size={40} />
                    <span>{d.cards.length} cards</span>
                  </div>
                  <h3>{d.title}</h3>
                  <p>
                    Active recall ·{" "}
                    {
                      state.reviews.filter((r: any) => r.deck_id === d.id)
                        .length
                    }{" "}
                    reviews
                  </p>
                  <span className="text-link">
                    Start reviewing <ChevronRight size={15} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Empty
                icon={Layers}
                title="Make knowledge stick"
                body="Create a deck from the built-in study bank, or add your own question-and-answer notes."
              >
                <button className="secondary" onClick={() => setOpen(true)}>
                  Create your first deck
                </button>
              </Empty>
            </section>
          )}
        </TabsContent>
        <TabsContent value="quizzes">
          <div className="quiz-layout below">
            <section className="panel quiz-config">
              <span className="eyebrow">A LITTLE CHALLENGE</span>
              <h2>Check your understanding.</h2>
              <p>Choose a topic and see what’s sticking.</p>
              <Field label="Topic">
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="e.g. Graph traversal, Python or DBMS"
                />
              </Field>
              <Field label="Number of questions">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </Field>
              <button
                className="primary"
                disabled={busy || !topic}
                onClick={async () => {
                  const q = await act("practice", { topic, count }, "");
                  if (q) {
                    setQuiz(q);
                    setAnswers(Array(q.questions.length).fill(-1));
                    setResult(null);
                    if (q.note) toast.info(q.note);
                  }
                }}
              >
                <Play size={16} /> Start practice quiz
              </button>
              <p className="help">
                Uses Gemini when configured, with the built-in question bank as
                a safe fallback.
              </p>
            </section>
            <section className="panel">
              <span className="eyebrow">YOUR LEARNING LOOP</span>
              <h2>Find the gaps. Close the gaps.</h2>
              <p className="spaced">
                Quiz results are saved to your progress. A low score flags a
                topic for revision, so you know where to focus next.
              </p>
              <div className="practice-loop">
                <span>
                  <BookOpen /> Learn
                </span>
                <span>
                  <Brain /> Practice
                </span>
                <span>
                  <RotateCcw /> Review
                </span>
              </div>
              <button
                className="text-link"
                onClick={() => go("Progress & insights")}
              >
                View learning progress <ChevronRight size={16} />
              </button>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <section className="panel below">
            {state?.attempts?.length ? (
              state.attempts.map((a: any) => (
                <div className="history-row" key={a.id}>
                  <span className="empty-icon">
                    <Brain size={20} />
                  </span>
                  <div>
                    <h3>{a.topic}</h3>
                    <p>
                      {new Date(a.created).toLocaleDateString("en-IN")} ·{" "}
                      {a.total} questions
                    </p>
                  </div>
                  <b
                    className={
                      a.score / a.total >= 0.7 ? "success-text" : "amber-text"
                    }
                  >
                    {a.score}/{a.total}
                  </b>
                </div>
              ))
            ) : (
              <Empty
                icon={Brain}
                title="A little practice goes a long way"
                body="Complete a quiz to begin your learning history."
              />
            )}
          </section>
        </TabsContent>
      </Tabs>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setTitle("");
            setNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a flashcard deck</DialogTitle>
            <DialogDescription>
              Use your own notes, or leave them blank to generate cards with
              Gemini when configured.
            </DialogDescription>
          </DialogHeader>
          <Field label="Deck title / topic">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Your cards (optional)">
            <textarea
              rows={7}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                "What does BFS use? :: A queue\nWhat does DFS use? :: A stack or recursion"
              }
            />
          </Field>
          <p className="help">
            One Question :: Answer per line. Up to 50 cards.
          </p>
          <button
            className="primary"
            disabled={busy || !title.trim()}
            onClick={async () => {
              if (
                await act("deck", { title, notes }, "Flashcard deck created")
              ) {
                setOpen(false);
                setNotes("");
              }
            }}
          >
            Create deck
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deck} onOpenChange={(v) => !v && setDeck(null)}>
        <DialogContent className="review-modal">
          <DialogHeader>
            <DialogTitle>{deck?.title}</DialogTitle>
            <DialogDescription>
              Card {card + 1} of {deck?.cards?.length} · Try recalling the
              answer before flipping.
            </DialogDescription>
          </DialogHeader>
          <button
            className={"flashcard " + (flipped ? "flipped" : "")}
            onClick={() => setFlipped(!flipped)}
          >
            <span className="eyebrow">
              {flipped ? "THE ANSWER" : "YOUR QUESTION"}
            </span>
            <h2>{flipped ? deck?.cards[card]?.a : deck?.cards[card]?.q}</h2>
            <span className="help">
              <RotateCcw size={14} /> Click to{" "}
              {flipped ? "see question" : "reveal answer"}
            </span>
          </button>
          {flipped ? (
            <div className="rating-row">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => rate("again")}
              >
                Study again
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => rate("good")}
              >
                Got it
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => rate("easy")}
              >
                Easy
              </button>
            </div>
          ) : (
            <button className="primary" onClick={() => setFlipped(true)}>
              Reveal answer
            </button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!quiz} onOpenChange={(v) => !v && setQuiz(null)}>
        <DialogContent className="quiz-modal">
          <DialogHeader>
            <DialogTitle>
              {result
                ? "Here’s how you did."
                : quiz?.topic + " · Practice quiz"}
            </DialogTitle>
            <DialogDescription>
              {result
                ? `${result.score} of ${result.total} correct. Review the explanations to strengthen your understanding.`
                : "Choose one answer for each question. Your result will be saved."}
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="score-banner">
              <strong>
                {Math.round((result.score / result.total) * 100)}%
              </strong>
              <span>
                {result.score / result.total >= 0.7
                  ? "Keep the momentum going."
                  : "Every gap is a place to grow."}
              </span>
            </div>
          )}
          <div className="quiz-questions">
            {(result?.questions || quiz?.questions || []).map(
              (q: any, i: number) => (
                <div className="question" key={i}>
                  <span className="eyebrow">QUESTION {i + 1}</span>
                  <h3>{q.q}</h3>
                  <div
                    className="answer-options"
                    role="radiogroup"
                    aria-label={"Question " + (i + 1)}
                  >
                    {q.options.map((o: string, j: number) => (
                      <button
                        role="radio"
                        aria-checked={answers[i] === j}
                        disabled={!!result}
                        className={
                          (answers[i] === j ? "chosen " : "") +
                          (result
                            ? q.answer === j
                              ? "correct"
                              : answers[i] === j
                                ? "incorrect"
                                : ""
                            : "")
                        }
                        key={j}
                        onClick={() =>
                          setAnswers((a) => a.map((v, k) => (k === i ? j : v)))
                        }
                      >
                        <span>{String.fromCharCode(65 + j)}</span>
                        {o}
                        {result && q.answer === j && <CheckCircle2 size={17} />}
                      </button>
                    ))}
                  </div>
                  {result && <p className="explanation">{q.explanation}</p>}
                </div>
              ),
            )}
          </div>
          {!result ? (
            <button
              className="primary"
              disabled={busy || answers.some((a) => a < 0)}
              onClick={async () => {
                const r = await act(
                  "submitQuiz",
                  { id: quiz.id, answers },
                  "Quiz result saved",
                );
                if (r) setResult(r);
              }}
            >
              Submit answers
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => {
                setQuiz(null);
                go("Progress & insights");
              }}
            >
              View my progress
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function Analytics({ state, onPlan }: any) {
  const [range, setRange] = useState("7");
  const n = Number(range),
    dates = Array.from({ length: n }, (_, i) => addDays(today(), -n + i + 1));
  const sessions = (state?.sessions || []).filter(
      (s: any) => s.date >= dates[0],
    ),
    tasks = (state?.tasks || []).filter(
      (t: Task) => t.date >= dates[0] && t.date <= today(),
    );
  const planned = dates.map((date) =>
      tasks
        .filter((t: Task) => t.date === date)
        .reduce((a: number, t: Task) => a + t.duration, 0),
    ),
    actual = dates.map((date) =>
      sessions
        .filter((s: any) => s.date === date)
        .reduce((a: number, s: any) => a + s.minutes, 0),
    );
  const actualTotal = actual.reduce((a, b) => a + b, 0),
    plannedTotal = planned.reduce((a, b) => a + b, 0),
    max = Math.max(...planned, ...actual, 60),
    average = sessions.length ? Math.round(actualTotal / sessions.length) : 0;
  const subjects = [
    ...new Set([
      ...tasks.map((t: Task) => t.subject),
      ...sessions.map((s: any) => s.subject),
    ]),
  ] as string[];
  const weak = (state?.attempts || [])
    .filter((a: any) => a.score / a.total < 0.7)
    .slice(0, 3);
  return (
    <>
      <PageHeading
        eyebrow="EVERY SMALL STEP COUNTS"
        title="Your progress, in perspective"
        subtitle="See what you planned, what you did, and where to go next."
      >
        <Choice
          value={range}
          onChange={setRange}
          options={[
            ["7", "Last 7 days"],
            ["30", "Last 30 days"],
          ]}
          label="Progress period"
        />
      </PageHeading>
      <div className="stats">
        {[
          [Clock, "Actual study time", fmt(actualTotal)],
          [CalendarDays, "Planned study time", fmt(plannedTotal)],
          [
            CheckCircle2,
            "Completed sessions",
            String(tasks.filter((t: Task) => t.status === "completed").length),
          ],
          [Activity, "Average session", fmt(average)],
        ].map(([Icon, title, value]: any) => (
          <div className="stat" key={title}>
            <span className="icon-tile">
              <Icon size={19} />
            </span>
            <p>{title}</p>
            <strong>{value}</strong>
            <small>Over the last {n} days</small>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Intent meets effort</h2>
            <p>Planned vs actual study minutes</p>
          </div>
          <div className="chart-legend">
            <span>
              <i /> Planned
            </span>
            <span>
              <i /> Actual
            </span>
          </div>
        </div>
        <div
          className="bar-chart"
          role="img"
          aria-label={`Over the last ${n} days: ${plannedTotal} minutes planned, ${actualTotal} actual minutes.`}
        >
          {dates.map((date, i) => (
            <div className="chart-column" key={date}>
              <div
                className="chart-bars"
                title={`${date}: ${planned[i]} planned minutes, ${actual[i]} actual minutes`}
              >
                <span
                  className="planned-bar"
                  style={{
                    height: Math.max(2, (planned[i] / max) * 160) + "px",
                  }}
                />
                <span
                  className="actual-bar"
                  style={{
                    height: Math.max(2, (actual[i] / max) * 160) + "px",
                  }}
                />
              </div>
              <span>
                {n === 7
                  ? dateLabel(date, { weekday: "short" })
                  : i % 5 === 0
                    ? date.slice(8)
                    : ""}
              </span>
            </div>
          ))}
        </div>
        {!actualTotal && !plannedTotal && (
          <p className="chart-note">
            Your chart will grow as you plan and log study sessions.
          </p>
        )}
      </section>
      <div className="dashboard-grid below">
        <section className="panel">
          <div className="section-title">
            <h2>Subject by subject</h2>
            <BookOpen size={19} />
          </div>
          {subjects.length ? (
            subjects.map((s, i) => {
              const minutes = sessions
                .filter((r: any) => r.subject === s)
                .reduce((a: number, r: any) => a + r.minutes, 0);
              return (
                <div className="subject-progress" key={s}>
                  <div>
                    <span className={"subject-dot tone-" + (i % 3)} />
                    <b>{s}</b>
                    <span>{fmt(minutes)}</span>
                  </div>
                  <Progress
                    value={actualTotal ? (minutes / actualTotal) * 100 : 0}
                  />
                </div>
              );
            })
          ) : (
            <Empty
              title="Your subjects belong here"
              body="Log a study session to see how you divide your time."
            />
          )}
        </section>
        <section className="panel insight">
          <span className="eyebrow">
            <Sparkles size={15} /> NEXT SMALL STEPS
          </span>
          <h2>
            {sessions.length >= 5
              ? "Your rhythm is taking shape."
              : "Let your habits tell the story."}
          </h2>
          <p>
            {sessions.length >= 5
              ? `Your average session is ${average} minutes. Try planning close to that duration, with space for breaks and recovery.`
              : "Log at least 5 sessions to get a useful estimate of your sustainable study length."}
          </p>
          {weak.length > 0 && (
            <div className="weak-topics">
              <b>Make time for revision</b>
              {weak.map((a: any) => (
                <span key={a.id}>
                  {a.topic} · {Math.round((a.score / a.total) * 100)}%
                </span>
              ))}
            </div>
          )}
          <button className="text-link" onClick={onPlan}>
            Shape your next plan <ChevronRight size={15} />
          </button>
          <p className="help">
            Insights come from recorded activity. They are suggestions, not
            fixed judgments about you.
          </p>
        </section>
      </div>
    </>
  );
}
function Community({ state, act, go, busy }: any) {
  const [query, setQuery] = useState(""),
    [nearby, setNearby] = useState(false),
    [peer, setPeer] = useState<any>(null),
    [message, setMessage] = useState("");
  const profile = state?.profile;
  const connection = (id: string) =>
    (state?.connections || []).find(
      (c: any) => c.sender === id || c.recipient === id,
    );
  const distance = (p: any) => {
    if (profile?.latitude == null || p.latitude == null) return null;
    const rad = (n: number) => (n * Math.PI) / 180;
    const a =
      Math.sin(rad(p.latitude - profile.latitude) / 2) ** 2 +
      Math.cos(rad(profile.latitude)) *
        Math.cos(rad(p.latitude)) *
        Math.sin(rad(p.longitude - profile.longitude) / 2) ** 2;
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };
  const peers = (state?.peers || [])
    .filter((p: any) =>
      (p.name + " " + p.subjects).toLowerCase().includes(query.toLowerCase()),
    )
    .filter(
      (p: any) =>
        !nearby || (distance(p) != null && Number(distance(p)) <= 100),
    );
  const chat = (state?.messages || []).filter(
    (m: any) => m.sender === peer?.id || m.recipient === peer?.id,
  );
  return (
    <>
      <PageHeading
        eyebrow="GROW TOGETHER"
        title="Find your study people"
        subtitle="Shared goals. Different perspectives. Better learning."
      >
        <button className="secondary" onClick={() => go("Settings")}>
          <Pencil size={16} /> Edit learning profile
        </button>
      </PageHeading>
      <div className="community-banner">
        <span className="community-icon">
          <Users size={34} />
        </span>
        <div>
          <h2>Learning is better with a little company.</h2>
          <p>
            Find learners with shared interests. Connect before starting a
            conversation.
          </p>
        </div>
        <span className="pill">PEER LEARNING</span>
      </div>
      {!profile?.discoverable && (
        <div className="notice">
          <ShieldCheck size={18} />
          <span>
            Your profile is private. Turn on community visibility in Settings to
            help others find you.
          </span>
          <button className="secondary" onClick={() => go("Settings")}>
            Privacy settings
          </button>
        </div>
      )}
      <div className="resource-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search learners"
            placeholder="Search names or subjects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className={"secondary " + (nearby ? "active" : "")}
          onClick={() => {
            if (profile?.latitude == null) {
              toast.info(
                "Enable approximate location sharing in Settings to discover nearby learners.",
              );
              go("Settings");
              return;
            }
            setNearby(!nearby);
          }}
        >
          <MapPin size={16} /> {nearby ? "Within ~100 km" : "Nearby learners"}
        </button>
      </div>
      {peers.length ? (
        <div className="peer-grid">
          {peers.map((p: any) => {
            const c = connection(p.id);
            return (
              <div className="peer-card" key={p.id}>
                <span className="avatar large">{initials(p.name)}</span>
                <h3>{p.name}</h3>
                <p>{p.bio || "Here to learn and grow."}</p>
                <div className="peer-subjects">
                  {p.subjects
                    .split(",")
                    .filter(Boolean)
                    .map((s: string) => (
                      <span className="subject-chip tone-0" key={s}>
                        {s.trim()}
                      </span>
                    ))}
                </div>
                {distance(p) != null && (
                  <small className="muted">
                    Approximately {distance(p)} km away
                  </small>
                )}
                <div className="peer-actions">
                  {c?.status === "accepted" ? (
                    <button className="primary" onClick={() => setPeer(p)}>
                      <MessageCircle size={16} /> Chat
                    </button>
                  ) : c?.recipient === state?.user?.id ? (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        act("accept", { id: c.id }, "Connection accepted")
                      }
                    >
                      Accept connection
                    </button>
                  ) : c ? (
                    <button className="secondary" disabled>
                      Request sent
                    </button>
                  ) : (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        act("connect", { id: p.id }, "Connection requested")
                      }
                    >
                      <Plus size={16} /> Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <Empty
            icon={Users}
            title={
              query || nearby
                ? "No learners found yet"
                : "Your learning circle starts here"
            }
            body="Real learners appear when they join this app and choose to make their profiles visible. Try changing your filters or inviting people after sharing access."
          />
        </section>
      )}
      <p className="help below">
        Nearby discovery uses an approximate area and list view. An interactive
        map and built-in video calling are not connected. Connected learners can
        open a meeting link from a shared profile.
      </p>
      <Dialog open={!!peer} onOpenChange={(v) => !v && setPeer(null)}>
        <DialogContent className="chat-modal">
          <DialogHeader>
            <DialogTitle>{peer?.name}</DialogTitle>
            <DialogDescription>
              Connected learner · Messages refresh once a minute.
            </DialogDescription>
          </DialogHeader>
          {peer?.video && (
            <a
              href={peer.video}
              target="_blank"
              rel="noreferrer"
              className="secondary"
            >
              <Video size={16} /> Open shared meeting link
            </a>
          )}
          <div className="peer-chat">
            {chat.length ? (
              chat.map((m: any) => (
                <div
                  className={m.sender === state.user.id ? "mine" : ""}
                  key={m.id}
                >
                  <p>{m.body}</p>
                  <small>
                    {new Date(m.created).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              ))
            ) : (
              <p className="help">
                Say hello and share what you’d like to study together.
              </p>
            )}
          </div>
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act("message", { id: peer.id, body: message }, ""))
                setMessage("");
            }}
          >
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a message…"
              aria-label="Message"
            />
            <button className="primary" disabled={busy || !message.trim()}>
              <Send size={17} />
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
function SettingsView({ state, act, busy, googleEnabled }: any) {
  const dirty = useRef(false);
  const [p, setP] = useState<any>(
    state?.profile || {
      name: "",
      bio: "",
      subjects: "",
      goal: 600,
      discoverable: 0,
      adaptive: 1,
      reminders: 1,
      recovery: "suggest",
      video: "",
    },
  );
  useEffect(() => {
    // Workspace data refreshes in the background. Do not let that refresh
    // overwrite a preference the learner is currently editing.
    if (state?.profile && !dirty.current) setP(state.profile);
  }, [state?.profile]);
  const patch = (k: string, v: any) => {
    dirty.current = true;
    setP((current: any) => ({ ...current, [k]: v }));
  };
  const save = async () => {
    const result = await act(
      "profile",
      { profile: p },
      "Profile and preferences saved",
    );
    if (result?.profile) {
      dirty.current = false;
      setP(result.profile);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch("latitude", Math.round(pos.coords.latitude * 10) / 10);
        patch("longitude", Math.round(pos.coords.longitude * 10) / 10);
        patch("discoverable", 1);
        toast.info("Approximate area selected. Save preferences to share it.");
      },
      () =>
        toast.error(
          "Location was not shared. You can keep using Nexovia without it.",
        ),
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="MAKE NEXOVIA YOURS"
        title="Your learning profile"
        subtitle="A little context helps shape a workspace that fits you."
      >
        <button
          className="primary"
          disabled={busy || !state?.profile}
          onClick={save}
        >
          <Check size={17} /> Save preferences
        </button>
      </PageHeading>
      <div className="settings-grid">
        <section className="panel">
          <div className="profile-summary">
            <span className="avatar large">{initials(p.name)}</span>
            <div>
              <h2>{p.name || "Your profile"}</h2>
              <p>{state?.user?.email || "Sign in to create your profile"}</p>
            </div>
          </div>
          <Field label="Display name">
            <input
              value={p.name}
              onChange={(e) => patch("name", e.target.value)}
            />
          </Field>
          <Field label="A little about you">
            <textarea
              rows={3}
              value={p.bio}
              onChange={(e) => patch("bio", e.target.value)}
              placeholder="What are you learning? What would you like to share?"
            />
          </Field>
          <Field label="Subjects and interests, separated by commas">
            <input
              value={p.subjects}
              onChange={(e) => patch("subjects", e.target.value)}
              placeholder="Data Structures, DBMS, Python"
            />
          </Field>
          <Field label="Weekly study goal (minutes)">
            <input
              type="number"
              min="30"
              max="3360"
              value={p.goal}
              onChange={(e) => patch("goal", Number(e.target.value))}
            />
          </Field>
          <Field label="Study meeting link (optional)">
            <input
              type="url"
              value={p.video}
              onChange={(e) => patch("video", e.target.value)}
              placeholder="https://meet…"
            />
          </Field>
          <p className="help">
            A shared meeting link is visible with your community profile.
            Built-in video hosting is not enabled.
          </p>
        </section>
        <div>
          <section className="panel">
            <h2>Study preferences</h2>
            {[
              [
                "adaptive",
                "Adaptive planning",
                "Use at least 5 logged sessions to suggest a realistic session length.",
              ],
              [
                "reminders",
                "In-app reminders",
                "Show reminders for upcoming and unfinished work while the app is open.",
              ],
            ].map(([key, label, desc]) => (
              <div className="setting-row" key={key}>
                <div>
                  <b>{label}</b>
                  <p>{desc}</p>
                </div>
                <Switch
                  checked={!!p[key]}
                  onCheckedChange={(v) => patch(key, v ? 1 : 0)}
                />
              </div>
            ))}
            <Field label="Missed-task recovery">
              <Choice
                value={p.recovery}
                onChange={(v) => patch("recovery", v)}
                options={[
                  ["manual", "Manual changes"],
                  ["suggest", "Smart suggestions"],
                ]}
                label="Recovery mode"
              />
            </Field>
            <p className="help">
              Suggestions always wait for your approval. Automatic background
              rescheduling is not enabled.
            </p>
          </section>
          <section className="panel below">
            <h2>Community & privacy</h2>
            <div className="setting-row">
              <div>
                <b>Make my profile discoverable</b>
                <p>
                  Share your name, bio and subjects. Your private plans, files
                  and scores stay private.
                </p>
              </div>
              <Switch
                checked={!!p.discoverable}
                onCheckedChange={(v) => {
                  patch("discoverable", v ? 1 : 0);
                  if (!v) {
                    patch("latitude", null);
                    patch("longitude", null);
                  }
                }}
              />
            </div>
            <div className="setting-row">
              <div>
                <b>Approximate location</b>
                <p>
                  {p.latitude != null
                    ? "An approximate area is selected. Precise coordinates are not stored."
                    : "Optional. Help nearby learners find you."}
                </p>
              </div>
            </div>
            {p.latitude != null ? (
              <button
                className="secondary"
                onClick={() => {
                  patch("latitude", null);
                  patch("longitude", null);
                }}
              >
                Stop sharing location
              </button>
            ) : (
              <button className="secondary" onClick={locate}>
                <MapPin size={16} /> Share approximate area
              </button>
            )}
          </section>
          <AccountSecurity
            email={state?.user?.email}
            hasPassword={state?.user?.hasPassword}
          />
          {googleEnabled && !state?.user?.googleLinked && (
            <section className="panel below">
              <h2>Google sign-in</h2>
              <p>
                Link your Google account to sign in with your email next time.
              </p>
              <a
                className="secondary spaced"
                href="/api/auth/google/start?intent=link"
              >
                Connect Google
              </a>
            </section>
          )}
          <form method="post" action="/api/auth">
            <input type="hidden" name="action" value="logout" />
            <button className="signout" type="submit">
              <LogOut size={16} /> Log out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
