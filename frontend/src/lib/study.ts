export type Task = {
  id: string;
  planId?: string;
  subject: string;
  topic: string;
  date: string;
  time: string;
  duration: number;
  priority: string;
  difficulty: string;
  deadline: string;
  status: string;
  kind: string;
  manual?: number;
  snoozeUntil?: string | null;
};
export type Subject = {
  name: string;
  topics: string;
  priority: string;
  difficulty: string;
  deadline: string;
  weak: boolean;
};
export type PlanInput = {
  title: string;
  start: string;
  days: number;
  weekday: number;
  weekend: number;
  session: number;
  startTime: string;
  subjects: Subject[];
  adaptive: boolean;
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const addDays = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const validDate = (v: any) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
export const timeMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const defaultInput = (): PlanInput => ({
  title: "",
  start: today(),
  days: 7,
  weekday: 120,
  weekend: 180,
  session: 40,
  startTime: "18:00",
  adaptive: true,
  subjects: [
    {
      name: "",
      topics: "",
      priority: "medium",
      difficulty: "medium",
      deadline: "",
      weak: false,
    },
  ],
});
export function validateInput(x: PlanInput) {
  if (!x || !validDate(x.start) || x.start < today())
    throw Error("Choose today or a future start date.");
  if (!Number.isInteger(x.days) || x.days < 1 || x.days > 31)
    throw Error("Choose a plan from 1 to 31 days.");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x.startTime))
    throw Error("Choose a valid start time.");
  for (const n of [x.weekday, x.weekend])
    if (!Number.isInteger(n) || n < 15 || n > 480)
      throw Error("Daily study time must be 15–480 minutes.");
  if (!Number.isInteger(x.session) || x.session < 15 || x.session > 120)
    throw Error("Sessions must be 15–120 minutes.");
  if (!x.subjects?.length || x.subjects.length > 10)
    throw Error("Add 1–10 subjects.");
  for (const s of x.subjects) {
    if (
      !["high", "medium", "low"].includes(s.priority) ||
      !["easy", "medium", "hard"].includes(s.difficulty)
    )
      throw Error("Choose a valid priority and difficulty.");
    if (!s.name?.trim() || !s.topics?.trim() || s.topics.length > 2000)
      throw Error("Each subject needs a name and topics.");
    if (s.deadline && (!validDate(s.deadline) || s.deadline < x.start))
      throw Error("A subject deadline cannot be before the plan starts.");
  }
  return x;
}
export function schedule(
  input: PlanInput,
  actualSession?: number,
  existing: Task[] = [],
) {
  const x = validateInput(input);
  const duration =
    x.adaptive && actualSession
      ? Math.max(15, Math.min(x.session, Math.round(actualSession / 5) * 5))
      : x.session;
  const work = x.subjects.flatMap((s) =>
    s.topics
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .flatMap((topic) => [
        { s, topic, kind: "Learn" },
        { s, topic, kind: s.weak ? "Review" : "Practice" },
      ]),
  );
  work.sort(
    (a, b) =>
      (a.s.deadline || "9999").localeCompare(b.s.deadline || "9999") +
      (({ high: 0, medium: 1, low: 2 }[a.s.priority as "high"] ?? 1) -
        ({ high: 0, medium: 1, low: 2 }[b.s.priority as "high"] ?? 1)) *
        0.1,
  );
  const tasks: Task[] = [];
  for (let i = 0; i < x.days; i++) {
    const date = addDays(x.start, i);
    const weekend = [0, 6].includes(new Date(date + "T12:00:00Z").getUTCDay());
    const occupied = existing
      .filter((t) => t.date === date && t.status !== "completed")
      .sort((a, b) => a.time.localeCompare(b.time));
    let left =
      (weekend ? x.weekend : x.weekday) -
      occupied.reduce((n, t) => n + t.duration, 0);
    let time = timeMinutes(x.startTime);
    if (date === today()) {
      const current = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      time = Math.max(time, Math.ceil((timeMinutes(current) + 5) / 5) * 5);
    }
    let hard = 0;
    for (let j = 0; j < work.length; ) {
      const w = work[j];
      if (
        (w.s.deadline && date > w.s.deadline) ||
        (hard >= 2 && w.s.difficulty === "hard") ||
        (w.kind !== "Learn" &&
          !tasks.some(
            (t) =>
              t.subject === w.s.name &&
              t.topic === w.topic &&
              t.kind === "Learn" &&
              t.date < date,
          ))
      ) {
        j++;
        continue;
      }
      const len = Math.min(duration, left);
      if (len < 15) break;
      for (const old of occupied) {
        const start = timeMinutes(old.time);
        if (time < start + old.duration && time + len > start)
          time = start + old.duration + 10;
      }
      if (time + len > 1440) break;
      tasks.push({
        id: crypto.randomUUID(),
        subject: w.s.name,
        topic: w.topic,
        date,
        time: clock(time),
        duration: len,
        priority: w.s.priority,
        difficulty: w.s.difficulty,
        deadline: w.s.deadline || "",
        status: "pending",
        kind: w.kind,
        manual: 0,
      });
      work.splice(j, 1);
      left -= len;
      time += len + 10;
      if (w.s.difficulty === "hard") hard++;
    }
  }
  return {
    tasks,
    remaining: work.length,
    mode: "Smart scheduler",
    note: work.length
      ? `${work.length} learning blocks do not fit before the selected dates or deadlines. Extend the range, add time or reduce topics.`
      : "Learning and practice fit within your available time. Ten-minute breaks separate sessions.",
  };
}
export function validateTasks(tasks: Task[], input: PlanInput) {
  validateInput(input);
  if (!Array.isArray(tasks) || !tasks.length || tasks.length > 300)
    throw Error("A plan needs 1–300 tasks.");
  const ids = new Set();
  for (const t of tasks) {
    if (ids.has(t.id)) throw Error("Duplicate task.");
    ids.add(t.id);
    if (
      !t.topic?.trim() ||
      !t.subject?.trim() ||
      !validDate(t.date) ||
      t.date < input.start ||
      t.date > addDays(input.start, input.days - 1)
    )
      throw Error("Every task needs a topic and a date inside your plan.");
    if (t.deadline && (!validDate(t.deadline) || t.date > t.deadline))
      throw Error("A task is scheduled after its deadline.");
    if (
      !Number.isInteger(t.duration) ||
      t.duration < 5 ||
      t.duration > 240 ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.time) ||
      timeMinutes(t.time) + t.duration > 1440
    )
      throw Error("Check task duration and start time.");
  }
  for (const date of new Set(tasks.map((t) => t.date))) {
    const d = tasks
      .filter((t) => t.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
    const cap = [0, 6].includes(new Date(date + "T12:00:00Z").getUTCDay())
      ? input.weekend
      : input.weekday;
    if (d.reduce((a, t) => a + t.duration, 0) > cap)
      throw Error(`${date} exceeds your available study time.`);
    for (let i = 1; i < d.length; i++)
      if (
        timeMinutes(d[i].time) <
        timeMinutes(d[i - 1].time) + d[i - 1].duration
      )
        throw Error(`Two sessions overlap on ${date}.`);
  }
  return tasks;
}
export function planConflicts(
  proposed: Task[],
  existing: Task[],
  input: PlanInput,
) {
  const errors: string[] = [];
  for (const date of new Set(proposed.map((t) => t.date))) {
    const current = existing.filter(
      (t) => t.date === date && t.status !== "completed",
    );
    if (!current.length) continue;
    const added = proposed.filter((t) => t.date === date);
    const cap = [0, 6].includes(new Date(date + "T12:00:00Z").getUTCDay())
      ? input.weekend
      : input.weekday;
    if ([...current, ...added].reduce((n, t) => n + t.duration, 0) > cap)
      errors.push(`${date} exceeds your daily study time across saved plans.`);
    for (const t of added)
      if (
        current.some(
          (c) =>
            timeMinutes(t.time) < timeMinutes(c.time) + c.duration &&
            timeMinutes(c.time) < timeMinutes(t.time) + t.duration,
        )
      )
        errors.push(`${date} at ${t.time} overlaps a session in another plan.`);
  }
  return [...new Set(errors)];
}
