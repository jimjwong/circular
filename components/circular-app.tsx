"use client";

import {
  Activity, BarChart3, Bell, BookOpen, Bot, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleDollarSign, Compass, CreditCard,
  ExternalLink, FileText, Filter, Flame, Gauge, Gift, Globe2, GraduationCap,
  Hash, Heart, Home, Inbox, LayoutDashboard, LockKeyhole,
  LogOut, Mail, Menu, MessageCircle, MoreHorizontal, PanelLeftClose, Play, Plus, Radio,
  Search, Send, Settings, ShieldCheck, Sparkles, Tag, Trophy, UserRoundPlus, Users, WandSparkles,
  Workflow, X, Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import type { CurrentUser, OrganizationSummary } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

type View =
  | "overview" | "spaces" | "posts" | "members" | "events" | "courses" | "live"
  | "audience" | "email" | "workflows" | "agents" | "website" | "payments"
  | "analytics" | "settings";

type NavItem = { id: View; label: string; icon: LucideIcon; badge?: string };

const navGroups: { label?: string; items: NavItem[] }[] = [
  { items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }] },
  { label: "Community", items: [
    { id: "spaces", label: "Spaces", icon: Hash },
    { id: "posts", label: "Posts & media", icon: FileText, badge: "12" },
    { id: "members", label: "Members", icon: Users },
    { id: "events", label: "Events", icon: CalendarDays },
    { id: "courses", label: "Courses", icon: GraduationCap },
    { id: "live", label: "Live", icon: Radio },
  ]},
  { label: "Grow", items: [
    { id: "audience", label: "Audience CRM", icon: Compass },
    { id: "email", label: "Email hub", icon: Mail },
    { id: "workflows", label: "Workflows", icon: Workflow },
    { id: "agents", label: "AI agents", icon: Bot, badge: "New" },
    { id: "website", label: "Website", icon: Globe2 },
  ]},
  { label: "Business", items: [
    { id: "payments", label: "Payments", icon: CircleDollarSign },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ]},
];

const validViews = new Set<View>(navGroups.flatMap((group) => group.items.map((item) => item.id)));

function navigationHref(view: View) {
  if (view === "spaces") return "/spaces" as const;
  if (view === "posts") return "/community" as const;
  if (view === "events") return "/events" as const;
  if (view === "courses") return "/courses" as const;
  if (view === "members") return "/team" as const;
  if (view === "overview") return "/dashboard" as const;
  return { pathname: "/dashboard" as const, query: { view } };
}

const viewMeta: Record<View, { title: string; eyebrow: string; action: string }> = {
  overview: { title: "Good morning, Jamie", eyebrow: "Community overview", action: "Create" },
  spaces: { title: "Spaces", eyebrow: "Community", action: "New space" },
  posts: { title: "Posts & media", eyebrow: "Content", action: "New post" },
  members: { title: "Members", eyebrow: "Community", action: "Invite members" },
  events: { title: "Events", eyebrow: "Community", action: "New event" },
  courses: { title: "Courses", eyebrow: "Learning", action: "New course" },
  live: { title: "Live studio", eyebrow: "Broadcasting", action: "Go live" },
  audience: { title: "Audience CRM", eyebrow: "Grow", action: "Add contact" },
  email: { title: "Email hub", eyebrow: "Grow", action: "New broadcast" },
  workflows: { title: "Workflows", eyebrow: "Automation", action: "New workflow" },
  agents: { title: "AI agents", eyebrow: "Intelligence", action: "Create agent" },
  website: { title: "Website builder", eyebrow: "Grow", action: "New page" },
  payments: { title: "Payments", eyebrow: "Business", action: "New offer" },
  analytics: { title: "Analytics", eyebrow: "Insights", action: "Export" },
  settings: { title: "Settings", eyebrow: "Workspace", action: "Edit settings" },
};

const members = [
  { initials: "AK", name: "Aisha Khan", email: "aisha@northstar.io", role: "Champion", score: 92, joined: "Today", color: "bg-[#d9efe5] text-[#176b4d]" },
  { initials: "MR", name: "Mateo Ruiz", email: "mateo@studio.co", role: "Member", score: 78, joined: "Yesterday", color: "bg-[#ece6fa] text-[#6b4fb4]" },
  { initials: "SL", name: "Sophie Lee", email: "sophie@fieldnote.dev", role: "Mentor", score: 86, joined: "Aug 29", color: "bg-[#ffead8] text-[#a85a1d]" },
  { initials: "DC", name: "Daniel Chen", email: "daniel@radius.ai", role: "Member", score: 64, joined: "Aug 27", color: "bg-[#dceafa] text-[#3866a6]" },
  { initials: "NO", name: "Nadia Okafor", email: "nadia@playbook.com", role: "Member", score: 71, joined: "Aug 26", color: "bg-[#f7e0e6] text-[#a84161]" },
];

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="grid size-9 place-items-center rounded-xl border border-[#e1e7e2] bg-white text-[#64746b] transition hover:border-[#bdcbc2] hover:text-[#1f362a]">{children}</button>;
}

function Badge({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "gray" | "purple" }) {
  const tones = { green: "bg-[#e8f4ee] text-[#176b4d]", amber: "bg-[#fff3df] text-[#995b09]", gray: "bg-[#f0f3f1] text-[#607067]", purple: "bg-[#efeafb] text-[#7155b5]" };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0 rounded-[20px] border border-[#e3e9e5] bg-white shadow-[0_1px_1px_rgba(24,37,31,.02)]", className)}>{children}</div>;
}

function Button({ children, secondary = false, onClick, className = "" }: { children: React.ReactNode; secondary?: boolean; onClick?: () => void; className?: string }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98]", secondary ? "border border-[#dce4de] bg-white text-[#31483b] hover:bg-[#f6f8f6]" : "bg-[#183f30] text-white shadow-[0_5px_14px_rgba(24,63,48,.18)] hover:bg-[#245841]", className)}>{children}</button>;
}

function Metric({ label, value, delta, icon: Icon }: { label: string; value: string; delta: string; icon: LucideIcon }) {
  return <Card className="p-5">
    <div className="flex items-start justify-between"><span className="text-sm text-[#718078]">{label}</span><span className="grid size-9 place-items-center rounded-xl bg-[#f0f5f2] text-[#276349]"><Icon size={17}/></span></div>
    <div className="mt-5 flex items-end justify-between"><strong className="font-display text-[28px] tracking-[-.04em]">{value}</strong><span className="mb-1 text-xs font-semibold text-[#23855f]">↗ {delta}</span></div>
  </Card>;
}

function Sparkline() {
  return <svg viewBox="0 0 520 150" className="h-[150px] w-full overflow-visible" preserveAspectRatio="none" aria-label="Member activity chart">
    <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5ba581" stopOpacity=".28"/><stop offset="1" stopColor="#5ba581" stopOpacity="0"/></linearGradient></defs>
    {[25,65,105,145].map(y => <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="#edf1ee" strokeWidth="1" />)}
    <path d="M0 126 C38 120,53 80,90 92 S146 108,174 77 S227 86,260 52 S310 61,340 38 S398 64,430 28 S481 42,520 14 L520 150 L0 150Z" fill="url(#chartFill)"/>
    <path d="M0 126 C38 120,53 80,90 92 S146 108,174 77 S227 86,260 52 S310 61,340 38 S398 64,430 28 S481 42,520 14" fill="none" stroke="#2f8060" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="430" cy="28" r="5" fill="white" stroke="#2f8060" strokeWidth="3"/>
  </svg>;
}

function Overview({ navigate }: { navigate: (v: View) => void }) {
  const [range, setRange] = useState("Last 30 days");
  return <div className="space-y-5 animate-enter">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Active members" value="2,847" delta="12.4%" icon={Users}/>
      <Metric label="Monthly revenue" value="$48,290" delta="8.1%" icon={CircleDollarSign}/>
      <Metric label="Engagement rate" value="68.2%" delta="5.6%" icon={Activity}/>
      <Metric label="Course progress" value="74.8%" delta="3.2%" icon={GraduationCap}/>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div><h2 className="font-display text-lg font-bold">Community momentum</h2><p className="mt-1 text-sm text-[#78857e]">Active members over the last 30 days</p></div>
          <button type="button" onClick={()=>setRange(current=>current==="Last 30 days"?"Last 90 days":"Last 30 days")} className="rounded-lg border border-[#e2e8e4] px-3 py-1.5 text-xs font-semibold text-[#637269]">{range} <ChevronDown className="ml-1 inline" size={13}/></button>
        </div>
        <div className="mt-5"><Sparkline/></div>
        <div className="mt-3 flex justify-between text-[11px] text-[#95a099]"><span>Aug 4</span><span>Aug 11</span><span>Aug 18</span><span>Aug 25</span><span>Sep 2</span></div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[#edf0ee] p-5"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Next up</h2><button onClick={() => navigate("events")} className="text-xs font-semibold text-[#267556]">View calendar</button></div></div>
        <div className="space-y-1 p-3">
          {[
            ["04", "SEP", "Creator roundtable", "10:00 AM · 128 going", "bg-[#edf5f1] text-[#267556]"],
            ["06", "SEP", "Live onboarding clinic", "2:30 PM · Live room", "bg-[#fff3e3] text-[#9b640d]"],
            ["11", "SEP", "Build in public workshop", "9:00 AM · 84 going", "bg-[#f0ebfa] text-[#7053b4]"],
          ].map(([day, month, title, meta, color]) => <button key={title} onClick={() => navigate("events")} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#f7f9f7]">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", color)}><span className="text-center"><b className="block text-sm leading-3">{day}</b><small className="text-[9px] font-bold">{month}</small></span></span>
            <span className="min-w-0"><b className="block truncate text-sm">{title}</b><small className="mt-1 block text-[#849087]">{meta}</small></span><ChevronRight className="ml-auto text-[#b4beb8]" size={16}/>
          </button>)}
        </div>
      </Card>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
      <Card>
        <div className="flex items-center justify-between border-b border-[#edf0ee] p-5"><div><h2 className="font-display font-bold">Trending conversations</h2><p className="mt-1 text-xs text-[#819087]">Posts with momentum right now</p></div><button onClick={() => navigate("posts")} className="text-xs font-semibold text-[#267556]">See all</button></div>
        <div className="divide-y divide-[#edf0ee] px-5">
          {[
            ["What changed when we stopped chasing growth hacks", "Aisha Khan", "Strategy Lab", "32", "86"],
            ["September build challenge — share your goal", "Mateo Ruiz", "Build in Public", "46", "124"],
            ["My 3-step member onboarding playbook", "Sophie Lee", "Community Ops", "18", "61"],
          ].map(([title, author, space, comments, likes]) => <div key={title} className="flex items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-[#869189]">{author} · {space}</p></div><span className="flex items-center gap-1 text-xs text-[#8a968f]"><MessageCircle size={14}/>{comments}</span><span className="flex items-center gap-1 text-xs text-[#8a968f]"><Heart size={14}/>{likes}</span></div>)}
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-display font-bold">Quick actions</h2><p className="mt-1 text-xs text-[#819087]">Keep your community moving</p></div><Zap size={18} className="text-[#cf8e2d]"/></div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[[FileText,"Write a post","posts"],[CalendarDays,"Host an event","events"],[Mail,"Send an email","email"],[Users,"Invite members","members"]].map(([I,label,id]) => { const Icon = I as LucideIcon; return <button key={label as string} onClick={() => navigate(id as View)} className="group rounded-2xl border border-[#e5eae6] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b9d2c3] hover:bg-[#f7fbf9]"><Icon size={19} className="text-[#39765c]"/><span className="mt-3 block text-xs font-semibold">{label as string}</span></button> })}
        </div>
      </Card>
    </div>
  </div>;
}

const spaces = [
  { icon: "👋", name: "Start here", desc: "Introductions, guidelines, and community orientation", type: "Basic", members: "2.8k", activity: "18m" },
  { icon: "⚡", name: "Build in public", desc: "Share your work, progress, lessons, and launches", type: "Post", members: "2.1k", activity: "4m" },
  { icon: "🧠", name: "Strategy lab", desc: "Tactical discussions for growing sustainable businesses", type: "Post", members: "1.6k", activity: "1h" },
  { icon: "🎓", name: "Creator OS course", desc: "The complete system, from idea to recurring revenue", type: "Course", members: "924", activity: "3h" },
  { icon: "🎙️", name: "Live studio", desc: "Workshops, AMAs, and member-led sessions", type: "Event", members: "1.2k", activity: "Tomorrow" },
];

function SpacesScreen({ openCommunity, openTeam, notify }: { openCommunity: () => void; openTeam: () => void; notify: (message: string) => void }) {
  return <div className="grid gap-5 xl:grid-cols-[1fr_300px] animate-enter">
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e8ece9] p-5"><div><h2 className="font-display font-bold">Community structure</h2><p className="mt-1 text-xs text-[#7a887f]">5 spaces across 3 space groups</p></div><Button secondary onClick={openCommunity}><PanelLeftClose size={15}/> Organize</Button></div>
      <div className="divide-y divide-[#edf0ee]">
        {spaces.map(s => <button type="button" onClick={openCommunity} key={s.name} className="group flex w-full items-center gap-4 p-4 text-left transition hover:bg-[#fafcfb]"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f0f4f1] text-xl">{s.icon}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-sm font-semibold">{s.name}</span><Badge tone="gray">{s.type}</Badge></span><span className="mt-1 block truncate text-xs text-[#7b8981]">{s.desc}</span></span><span className="hidden text-right sm:block"><b className="block text-sm">{s.members}</b><span className="text-[11px] text-[#8c9790]">members</span></span><span className="hidden w-20 text-right md:block"><b className="block text-xs font-medium text-[#4b6255]">{s.activity}</b><span className="text-[11px] text-[#8c9790]">activity</span></span><MoreHorizontal className="text-[#9aa49e]" size={18}/></button>)}
      </div>
    </Card>
    <div className="space-y-5">
      <Card className="p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e8f4ee] text-[#207051]"><ShieldCheck size={19}/></span><div><h3 className="text-sm font-bold">Access groups</h3><p className="text-xs text-[#7e8b83]">4 active groups</p></div></div><div className="mt-4 space-y-3">{[["All members",2847],["Pro members",826],["Cohort 12",184]].map(([n,c])=><div key={n as string} className="flex justify-between text-xs"><span className="text-[#5f6f66]">{n as string}</span><b>{c}</b></div>)}</div><Button secondary onClick={openTeam} className="mt-5 w-full">Manage access</Button></Card>
      <Card className="overflow-hidden bg-[#183f30] p-5 text-white"><Sparkles size={20} className="text-[#f3c477]"/><h3 className="font-display mt-4 font-bold">Design with AI</h3><p className="mt-2 text-xs leading-5 text-[#c7d8cf]">Describe your community and Circular will suggest spaces, access rules, and an onboarding flow.</p><button type="button" onClick={()=>notify("AI space builder will be added in a later phase")} className="mt-5 text-xs font-bold text-[#f3c477]">Open builder →</button></Card>
    </div>
  </div>;
}

function MembersScreen({ audience = false, notify }: { audience?: boolean; notify: (message: string) => void }) {
  const [segment, setSegment] = useState("All contacts");
  const [query, setQuery] = useState("");
  const filteredMembers = members.filter(member=>`${member.name} ${member.email} ${member.role}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-5 animate-enter">
    <div className="grid gap-4 sm:grid-cols-3"><Metric label={audience ? "Total contacts" : "Total members"} value={audience ? "8,429" : "2,847"} delta="12.4%" icon={Users}/><Metric label="Active this week" value="1,938" delta="7.8%" icon={Activity}/><Metric label={audience ? "Converted" : "New this month"} value={audience ? "34.2%" : "286"} delta="4.1%" icon={Sparkles}/></div>
    {audience && <div className="flex gap-2 overflow-x-auto scrollbar-none">{["All contacts","Highly engaged","At risk","Newsletter only","Customers","Course alumni"].map(x=><button type="button" onClick={()=>setSegment(x)} key={x} className={cn("whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold",segment===x?"bg-[#183f30] text-white":"border border-[#dfe6e1] bg-white text-[#607168]")}>{x}</button>)}</div>}
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8ece9] p-4"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 text-[#9aa59e]" size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} className="h-9 w-full rounded-xl bg-[#f5f7f5] pl-9 pr-3 text-xs outline-none ring-[#acd0bd] focus:ring-2" placeholder="Search people..."/></div><Button secondary onClick={()=>notify("Member filters opened for the current list")}><Filter size={14}/> Filter</Button><Button secondary onClick={()=>notify("Select members before applying a tag")}><Tag size={14}/> Tag</Button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-b border-[#edf0ee] bg-[#fafbfa] text-[10px] uppercase tracking-[.08em] text-[#87938c]"><th className="px-5 py-3 font-semibold">Person</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Activity score</th><th className="px-4 py-3 font-semibold">Joined</th><th className="px-4 py-3"></th></tr></thead><tbody>{filteredMembers.map(m=><tr key={m.email} className="border-b border-[#edf0ee] last:border-0 hover:bg-[#fbfcfb]"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className={cn("grid size-9 place-items-center rounded-full text-xs font-bold",m.color)}>{m.initials}</span><span><b className="block text-sm">{m.name}</b><small className="text-[#8a968f]">{m.email}</small></span></div></td><td className="px-4 py-3"><Badge tone={m.role==="Champion"?"green":m.role==="Mentor"?"purple":"gray"}>{m.role}</Badge></td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e9eeeb]"><div className="h-full rounded-full bg-[#4a9874]" style={{width:`${m.score}%`}}/></div><span className="text-xs font-semibold">{m.score}</span></div></td><td className="px-4 py-3 text-xs text-[#6f7d75]">{m.joined}</td><td className="px-4 py-3"><button type="button" aria-label={`Actions for ${m.name}`} onClick={()=>notify(`${m.name} selected`)}><MoreHorizontal size={17} className="text-[#9ba59f]"/></button></td></tr>)}</tbody></table></div>
    </Card>
  </div>;
}

function ContentScreen({ kind, notify }: { kind: "posts" | "events" | "courses" | "live"; notify: (message: string) => void }) {
  const config = {
    posts: { icon: FileText, stat: ["Published", "148"], tabs: ["All posts", "Drafts", "Scheduled", "Media library"], items: [["The quiet systems behind our fastest-growing community", "Strategy Lab · Aisha Khan", "Published", "4.8k views"],["September build challenge", "Build in Public · Mateo Ruiz", "Pinned", "2.1k views"],["Member onboarding: the first 7 days", "Community Ops · Sophie Lee", "Scheduled", "Sep 5"]] },
    events: { icon: CalendarDays, stat: ["Registrations", "1,284"], tabs: ["Upcoming", "Past", "Calendar", "Event series"], items: [["Creator roundtable", "Sep 4 · 10:00 AM", "128 going", "Live room"],["Live onboarding clinic", "Sep 6 · 2:30 PM", "84 going", "Live room"],["Build in public workshop", "Sep 11 · 9:00 AM", "164 going", "Stream"]] },
    courses: { icon: GraduationCap, stat: ["Completions", "734"], tabs: ["Courses", "Lessons", "Cohorts", "Certificates"], items: [["Creator OS", "8 sections · 42 lessons", "Published", "924 enrolled"],["Community Flywheel", "5 sections · 24 lessons", "Published", "618 enrolled"],["Launch Week", "3 sections · 18 lessons", "Draft", "0 enrolled"]] },
    live: { icon: Radio, stat: ["Minutes watched", "92k"], tabs: ["Studio", "Rooms", "Streams", "Recordings"], items: [["Weekly office hours", "Tomorrow · 10:00 AM", "Scheduled", "128 registered"],["Member AMA with Kai", "Sep 8 · 5:00 PM", "Scheduled", "96 registered"],["August community town hall", "54 min recording", "Published", "842 views"]] },
  }[kind];
  const Icon = config.icon;
  const [activeTab, setActiveTab] = useState(config.tabs[0]);
  return <div className="space-y-5 animate-enter">
    <div className="grid gap-4 sm:grid-cols-3"><Metric label={config.stat[0]} value={config.stat[1]} delta="8.2%" icon={Icon}/><Metric label="Engaged members" value="1,629" delta="6.7%" icon={Users}/><Metric label="Avg. completion" value="76.4%" delta="4.3%" icon={Gauge}/></div>
    <div className="flex gap-2 overflow-auto scrollbar-none">{config.tabs.map(tab=><button type="button" onClick={()=>setActiveTab(tab)} key={tab} className={cn("rounded-full px-4 py-2 text-xs font-semibold",activeTab===tab?"bg-[#183f30] text-white":"border border-[#dfe6e1] bg-white text-[#607168]")}>{tab}</button>)}</div>
    <Card className="overflow-hidden"><div className="border-b border-[#e8ece9] p-5"><h2 className="font-display font-bold">{activeTab}</h2></div><div className="divide-y divide-[#edf0ee]">{config.items.map(([title,meta,status,reach],index)=><button type="button" onClick={()=>notify(`${title} selected`)} key={title} className="flex w-full items-center gap-4 p-4 text-left hover:bg-[#fafcfb]"><span className="relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#dcece4] via-[#f1e8d8] to-[#d9e4f0]"><Icon size={22} className="text-[#2c6b50]"/>{kind==="live"&&index===2&&<span className="absolute inset-0 grid place-items-center bg-black/10"><Play size={20} fill="white" className="text-white"/></span>}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-[#7c8a82]">{meta}</span></span><Badge tone={status==="Published"||status==="Pinned"?"green":status==="Draft"?"gray":"amber"}>{status}</Badge><span className="hidden w-24 text-right text-xs text-[#78867e] sm:block">{reach}</span><MoreHorizontal size={18} className="text-[#9aa59e]"/></button>)}</div></Card>
  </div>;
}

function EmailScreen({ notify }: { notify: (message: string) => void }) {
  return <div className="space-y-5 animate-enter"><div className="grid gap-4 sm:grid-cols-3"><Metric label="Subscribers" value="8,429" delta="10.2%" icon={Users}/><Metric label="Avg. open rate" value="52.8%" delta="6.1%" icon={Mail}/><Metric label="Click rate" value="8.4%" delta="1.9%" icon={Activity}/></div><Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="font-display font-bold">Broadcasts</h2><p className="mt-1 text-xs text-[#7f8c84]">Newsletters and audience campaigns</p></div><Button secondary onClick={()=>notify("Email forms selected")}><FileText size={15}/> Forms</Button></div><div className="mt-5 grid gap-4 lg:grid-cols-3">{[["September dispatch","Sent Sep 1","58.2% opened","bg-[#e8f4ee] text-[#267255]"],["The member flywheel","Sent Aug 25","51.7% opened","bg-[#edeafa] text-[#6f55af]"],["Cohort 12 kickoff","Scheduled Sep 5","8,429 recipients","bg-[#fff2df] text-[#9e630d]"]].map(([title,date,metric,color])=><button type="button" onClick={()=>notify(`${title} selected`)} key={title} className="rounded-2xl border border-[#e5eae6] p-4 text-left hover:bg-[#fafcfb]"><span className={cn("grid size-9 place-items-center rounded-xl",color)}><Mail size={16}/></span><span className="mt-4 block text-sm font-bold">{title}</span><span className="mt-1 block text-xs text-[#8b968f]">{date}</span><span className="mt-4 block border-t border-[#edf0ee] pt-3 text-xs font-semibold text-[#456051]">{metric}</span></button>)}</div></Card></div>;
}

function WorkflowsScreen({ notify }: { notify: (message: string) => void }) {
  const [enabled, setEnabled] = useState([true,true,true,false]);
  const toggle=(index:number)=>setEnabled(values=>values.map((value,itemIndex)=>itemIndex===index?!value:value));
  return <div className="grid gap-5 xl:grid-cols-[1fr_330px] animate-enter"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-[#e8ece9] p-5"><div><h2 className="font-display font-bold">Active automations</h2><p className="mt-1 text-xs text-[#7f8c84]">2,842 tasks completed this month</p></div><Badge>All systems healthy</Badge></div><div className="divide-y divide-[#edf0ee]">{[["Welcome new members","Member joins","Send email + add tag","1,284 runs"],["Re-engage at-risk members","Activity drops","Send DM + notify admin","428 runs"],["Celebrate course completion","Course completed","Award badge + email","316 runs"],["Payment recovery","Payment failed","Retry + send email","74 runs"]].map(([name,trigger,action,runs],i)=><div key={name} className="flex items-center gap-4 p-4"><span className="grid size-10 place-items-center rounded-xl bg-[#edf5f1] text-[#2a7657]"><Workflow size={18}/></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{name}</h3><p className="mt-1 truncate text-xs text-[#819087]">{trigger} <ChevronRight className="inline" size={11}/> {action}</p></div><span className="hidden text-xs font-semibold text-[#66766d] sm:block">{runs}</span><button type="button" aria-label={`${enabled[i]?"Disable":"Enable"} ${name}`} aria-pressed={enabled[i]} onClick={()=>toggle(i)} className={cn("h-5 w-9 rounded-full p-0.5",enabled[i]?"bg-[#2e7b5c]":"bg-[#dbe2dd]")}><span className={cn("block size-4 rounded-full bg-white transition",enabled[i]&&"translate-x-4")}/></button></div>)}</div></Card><Card className="h-fit bg-[#183f30] p-6 text-white"><WandSparkles className="text-[#efc477]"/><h2 className="font-display mt-5 text-xl font-bold">Build a workflow with AI</h2><p className="mt-2 text-sm leading-6 text-[#c4d5cc]">Tell us what should happen and we’ll create the trigger, audience rules, and actions.</p><div className="mt-5 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#dce8e1]">“When someone finishes Creator OS, award a badge and invite them to the alumni space.”</div><button type="button" onClick={()=>notify("AI workflow builder will be added in a later phase")} className="mt-5 flex items-center gap-2 text-xs font-bold text-[#f2ca84]">Try AI builder <ChevronRight size={14}/></button></Card></div>;
}

function AgentsScreen({ notify }: { notify: (message: string) => void }) {
  return <div className="space-y-5 animate-enter"><Card className="overflow-hidden bg-gradient-to-br from-[#183f30] to-[#245d46] p-6 text-white sm:p-8"><div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-xl"><Badge tone="amber">Circular intelligence</Badge><h2 className="font-display mt-4 text-2xl font-bold sm:text-3xl">A team that knows your community.</h2><p className="mt-3 text-sm leading-6 text-[#cadbd2]">Train agents on your content, voice, and operating playbooks. Let them support members, moderate conversations, and surface insights around the clock.</p></div><Button onClick={()=>notify("Knowledge training selected")} className="bg-white text-[#183f30] hover:bg-[#f1f6f3]"><Sparkles size={16}/> Train knowledge</Button></div></Card><div className="grid gap-4 lg:grid-cols-3">{[["Community concierge","Answers member questions","842 conversations","green"],["Safety moderator","Reviews content and flags risk","1,204 checks","amber"],["Growth analyst","Finds patterns and opportunities","24 insights","purple"]].map(([name,desc,metric,tone],i)=><button type="button" onClick={()=>notify(`${name} selected`)} key={name} className="rounded-[20px] border border-[#e3e9e5] bg-white p-5 text-left"><div className="flex items-start justify-between"><span className={cn("grid size-11 place-items-center rounded-2xl",i===0?"bg-[#e8f4ee] text-[#267255]":i===1?"bg-[#fff2df] text-[#9e630d]":"bg-[#edeafa] text-[#6f55af]")}><Bot size={20}/></span><Badge tone={tone as "green"|"amber"|"purple"}>Active</Badge></div><span className="font-display mt-5 block font-bold">{name}</span><span className="mt-2 block text-xs leading-5 text-[#7b8981]">{desc}</span><span className="mt-5 flex items-center justify-between border-t border-[#edf0ee] pt-4"><span className="text-xs font-semibold">{metric}</span><ChevronRight size={15} className="text-[#9aa59e]"/></span></button>)}</div></div>;
}

function WebsiteScreen({ notify }: { notify: (message: string) => void }) {
  return <div className="grid gap-5 xl:grid-cols-[1fr_340px] animate-enter"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-[#e8ece9] p-4"><div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#ed6a5e]"/><span className="size-2.5 rounded-full bg-[#f4bd4f]"/><span className="size-2.5 rounded-full bg-[#61c454]"/></div><span className="rounded-lg bg-[#f2f5f3] px-5 py-1.5 text-[10px] text-[#75837b]">thecollective.circular.site</span><ExternalLink size={15} className="text-[#849088]"/></div><div className="min-h-[430px] bg-[#f2eee5] p-5 sm:p-10"><div className="mx-auto max-w-2xl rounded-[24px] bg-[#173f31] px-6 py-10 text-center text-white shadow-xl sm:px-12 sm:py-14"><span className="text-xs font-semibold uppercase tracking-[.2em] text-[#edc17d]">The Collective</span><h2 className="font-display mx-auto mt-5 max-w-lg text-3xl font-bold tracking-[-.04em] sm:text-5xl">Build meaningful work, together.</h2><p className="mx-auto mt-5 max-w-md text-sm leading-6 text-[#c8d8d0]">A private community for independent creators turning ideas into enduring businesses.</p><button type="button" onClick={()=>notify("Public signup preview selected")} className="mt-7 rounded-full bg-[#f1c983] px-6 py-3 text-xs font-bold text-[#183f30]">Join the community</button></div><div className="mx-auto mt-4 grid max-w-2xl grid-cols-3 gap-3">{["Weekly workshops","Peer circles","Creator OS"].map(x=><div key={x} className="rounded-xl bg-white p-4 text-center text-[10px] font-semibold text-[#52655a]">{x}</div>)}</div></div></Card><div className="space-y-5"><Card className="p-5"><h3 className="font-display font-bold">Site pages</h3><div className="mt-4 space-y-1">{[[Home,"Home","Published"],[FileText,"About","Published"],[CreditCard,"Membership","Published"],[BookOpen,"Resources","Draft"]].map(([I,n,s])=>{const Icon=I as LucideIcon;return <button type="button" onClick={()=>notify(`${String(n)} page selected`)} key={n as string} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[#f5f8f6]"><Icon size={16} className="text-[#668076]"/><span className="flex-1 text-xs font-semibold">{n as string}</span><span className="text-[10px] text-[#87938c]">{s as string}</span></button>})}</div></Card><Card className="p-5"><h3 className="text-sm font-bold">Brand kit</h3><div className="mt-4 flex gap-2"><button type="button" aria-label="Use forest brand color" onClick={()=>notify("Forest brand color selected")} className="size-8 rounded-full bg-[#173f31] ring-2 ring-white shadow"/><button type="button" aria-label="Use gold brand color" onClick={()=>notify("Gold brand color selected")} className="size-8 rounded-full bg-[#f1c983] ring-2 ring-white shadow"/><button type="button" aria-label="Use cream brand color" onClick={()=>notify("Cream brand color selected")} className="size-8 rounded-full bg-[#f2eee5] ring-2 ring-white shadow"/><button type="button" aria-label="Add brand color" onClick={()=>notify("Add brand color selected")} className="grid size-8 place-items-center rounded-full border border-dashed border-[#aab6af] text-[#87938c]"><Plus size={13}/></button></div><p className="mt-4 text-xs text-[#7d8a82]">Manrope headings · Inter body</p></Card></div></div>;
}

function PaymentsScreen({ notify }: { notify: (message: string) => void }) {
  return <div className="space-y-5 animate-enter"><div className="grid gap-4 sm:grid-cols-3"><Metric label="Monthly recurring revenue" value="$48,290" delta="8.1%" icon={CircleDollarSign}/><Metric label="Active subscriptions" value="826" delta="6.4%" icon={CreditCard}/><Metric label="Customer LTV" value="$684" delta="11.3%" icon={Trophy}/></div><div className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-[#e8ece9] p-5"><div><h2 className="font-display font-bold">Offers & paywalls</h2><p className="mt-1 text-xs text-[#7f8c84]">Subscriptions, one-time purchases, and trials</p></div><Button secondary onClick={()=>notify("Coupons selected")}><Gift size={15}/> Coupons</Button></div><div className="divide-y divide-[#edf0ee]">{[["Collective Pro","$59 / month","612 members","$36,108 MRR"],["Creator OS","$349 one-time","184 sales","$64,216 revenue"],["Community Starter","$19 / month","214 members","$4,066 MRR"]].map(([name,price,people,revenue])=><button type="button" onClick={()=>notify(`${name} offer selected`)} key={name} className="flex w-full items-center gap-4 p-4 text-left hover:bg-[#fafcfb]"><span className="grid size-10 place-items-center rounded-xl bg-[#e8f4ee] text-[#267255]"><LockKeyhole size={17}/></span><span className="flex-1"><span className="block text-sm font-semibold">{name}</span><span className="mt-1 block text-xs text-[#819087]">{price}</span></span><span className="hidden text-xs text-[#6d7d74] sm:block">{people}</span><b className="text-xs">{revenue}</b><MoreHorizontal size={17} className="text-[#9ba59f]"/></button>)}</div></Card><Card className="p-5"><h2 className="font-display font-bold">Revenue mix</h2><div className="mt-6 grid place-items-center"><div className="relative grid size-40 place-items-center rounded-full" style={{background:"conic-gradient(#267255 0 68%, #e3ab56 68% 87%, #8169bd 87% 100%)"}}><div className="grid size-28 place-items-center rounded-full bg-white text-center"><span><b className="font-display block text-2xl">$58.4k</b><small className="text-[#829087]">this month</small></span></div></div></div><div className="mt-6 grid grid-cols-3 gap-2 text-center text-[10px]"><span><i className="mx-auto mb-1 block size-2 rounded-full bg-[#267255]"/>Memberships</span><span><i className="mx-auto mb-1 block size-2 rounded-full bg-[#e3ab56]"/>Courses</span><span><i className="mx-auto mb-1 block size-2 rounded-full bg-[#8169bd]"/>Events</span></div></Card></div></div>;
}

function AnalyticsScreen() {
  const [section, setSection] = useState("Overview");
  return <div className="space-y-5 animate-enter"><div className="flex gap-2 overflow-auto scrollbar-none">{["Overview","Engagement","Growth","Revenue","Courses","Events"].map(x=><button type="button" onClick={()=>setSection(x)} key={x} className={cn("rounded-full px-4 py-2 text-xs font-semibold",section===x?"bg-[#183f30] text-white":"border border-[#dfe6e1] bg-white text-[#607168]")}>{x}</button>)}</div><div className="grid gap-4 sm:grid-cols-3"><Metric label="Daily active members" value="1,184" delta="9.3%" icon={Activity}/><Metric label="DAU / MAU" value="41.6%" delta="3.7%" icon={Gauge}/><Metric label="30-day retention" value="84.2%" delta="2.8%" icon={Flame}/></div><Card className="p-6"><div className="flex items-start justify-between"><div><h2 className="font-display text-lg font-bold">{section} trend</h2><p className="mt-1 text-xs text-[#819087]">Posts, comments, reactions, and attendance</p></div><Badge>Healthy</Badge></div><div className="mt-7"><Sparkline/></div></Card><div className="grid gap-5 lg:grid-cols-2"><Card className="p-5"><h3 className="font-display font-bold">Top spaces</h3><div className="mt-5 space-y-4">{[["Build in public",88],["Strategy lab",74],["Creator OS",63],["Start here",42]].map(([n,v])=><div key={n as string}><div className="mb-2 flex justify-between text-xs"><span>{n as string}</span><b>{v}%</b></div><div className="h-1.5 rounded-full bg-[#ecf0ed]"><div className="h-full rounded-full bg-[#3f8d6a]" style={{width:`${v}%`}}/></div></div>)}</div></Card><Card className="p-5"><h3 className="font-display font-bold">Member health</h3><div className="mt-6 grid grid-cols-3 gap-3">{[["Champions","428","green"],["Growing","1,846","amber"],["At risk","573","gray"]].map(([n,v,t])=><div key={n} className="rounded-2xl bg-[#f6f8f6] p-4 text-center"><Badge tone={t as "green"|"amber"|"gray"}>{n}</Badge><b className="font-display mt-3 block text-xl">{v}</b></div>)}</div></Card></div></div>;
}

function SettingsScreen({ tenant, notify }: { tenant: string; notify: (message: string) => void }) {
  const router = useRouter();
  const sections = ["General","Branding","Domains","Authentication","Roles & permissions","Notifications","Integrations","API & webhooks","Billing"];
  const [section, setSection] = useState("General");
  const [discoverable, setDiscoverable] = useState(true);
  const selectSection=(next:string)=>{ if(next==="Roles & permissions") return router.push("/team"); setSection(next); };
  return <div className="grid gap-5 xl:grid-cols-[230px_1fr] animate-enter"><Card className="h-fit p-3">{sections.map(x=><button type="button" key={x} onClick={()=>selectSection(x)} className={cn("w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold",section===x?"bg-[#eaf3ee] text-[#22694d]":"text-[#66766d] hover:bg-[#f5f7f5]")}>{x}</button>)}</Card><div className="space-y-5"><Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className="grid size-11 place-items-center rounded-2xl bg-[#e8f4ee] text-[#286f53]"><ShieldCheck size={20}/></span><div className="flex-1"><h2 className="font-display font-bold">Team access is now live</h2><p className="mt-1 text-xs text-[#7d8a82]">Invite teammates, assign roles, suspend access, and review audit events.</p></div><Button secondary onClick={()=>router.push("/team")}>Manage team <ChevronRight size={14}/></Button></Card>{section==="General"?<Card className="p-6"><h2 className="font-display text-lg font-bold">General settings</h2><p className="mt-1 text-xs text-[#7d8a82]">Workspace identity and defaults</p><div className="mt-7 max-w-2xl space-y-5"><label className="block"><span className="mb-2 block text-xs font-semibold">Community name</span><input defaultValue={tenant} className="h-11 w-full rounded-xl border border-[#dce4de] px-3 text-sm outline-none focus:ring-2 focus:ring-[#b9d8c8]"/></label><label className="block"><span className="mb-2 block text-xs font-semibold">Community URL</span><div className="flex h-11 overflow-hidden rounded-xl border border-[#dce4de]"><span className="grid place-items-center bg-[#f2f5f3] px-3 text-xs text-[#7d8a82]">circular.so/</span><input defaultValue="workspace" className="min-w-0 flex-1 px-3 text-sm outline-none"/></div></label><label className="block"><span className="mb-2 block text-xs font-semibold">Description</span><textarea defaultValue="A private community for people learning and building together." className="min-h-28 w-full resize-none rounded-xl border border-[#dce4de] p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-[#b9d8c8]"/></label><div className="flex items-center justify-between rounded-2xl border border-[#e2e8e4] p-4"><div><h3 className="text-sm font-semibold">Discoverability</h3><p className="mt-1 text-xs text-[#839087]">Allow this community to appear in search</p></div><button type="button" aria-pressed={discoverable} onClick={()=>setDiscoverable(value=>!value)} className={cn("h-6 w-11 rounded-full p-1 transition",discoverable?"bg-[#2b7959]":"bg-[#cfd8d2]")}><span className={cn("block size-4 rounded-full bg-white transition",discoverable&&"translate-x-5")}/></button></div><Button onClick={()=>notify("General settings saved locally")}>Save changes</Button></div></Card>:<Card className="p-8"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#347457]">{section}</p><h2 className="font-display mt-2 text-xl font-bold">{section} settings</h2><p className="mt-3 text-sm text-[#7d8a82]">This section is interactive and queued for its full product implementation.</p><Button onClick={()=>notify(`${section} settings noted`)} className="mt-6">Continue setup</Button></Card>}</div></div>;
}

function MemberPreview({ onExit }: { onExit: () => void }) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  return <div className="min-h-screen bg-[#f5f3ee] text-[#1d2c25]">
    <header className="sticky top-0 z-20 border-b border-[#e4e2dc] bg-[#f5f3ee]/90 px-4 backdrop-blur-xl sm:px-8"><div className="mx-auto flex h-16 max-w-6xl items-center gap-5"><div className="grid size-9 place-items-center rounded-xl bg-[#183f30] text-sm font-bold text-white">C</div><b className="font-display">The Collective</b><nav className="ml-5 hidden gap-5 text-xs font-semibold text-[#637168] md:flex"><button type="button" onClick={()=>router.push("/community")}>Home</button><button type="button" onClick={()=>router.push("/community")}>Spaces</button><button type="button" onClick={onExit}>Events</button><button type="button" onClick={onExit}>Courses</button><button type="button" onClick={()=>router.push("/team")}>Members</button></nav><div className="ml-auto flex gap-2"><IconButton label="Search" onClick={onExit}><Search size={16}/></IconButton><IconButton label="Notifications" onClick={()=>router.push("/notifications")}><Bell size={16}/></IconButton><Button secondary onClick={onExit}>Admin <ExternalLink size={13}/></Button></div></div></header>
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5"><section className="overflow-hidden rounded-[26px] bg-[#183f30] p-7 text-white sm:p-10"><span className="text-xs font-bold uppercase tracking-[.16em] text-[#efc77e]">Wednesday, September 2</span><h1 className="font-display mt-4 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Make something worth sharing.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#c4d6cd]">A focused space to learn, build, and grow alongside independent creators who care about the work.</p><div className="mt-7 flex -space-x-2">{members.slice(0,4).map(m=><span key={m.name} className={cn("grid size-8 place-items-center rounded-full border-2 border-[#183f30] text-[9px] font-bold",m.color)}>{m.initials}</span>)}<span className="grid size-8 place-items-center rounded-full border-2 border-[#183f30] bg-white text-[9px] font-bold text-[#183f30]">+2.8k</span></div></section>
        <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Latest conversations</h2><Button secondary onClick={()=>router.push("/community")}><Plus size={14}/> New post</Button></div>
        {[{author:"Aisha Khan",tag:"Strategy Lab",title:"The quiet systems behind our fastest-growing month",body:"We spent August simplifying—not adding. Here are the three operating rhythms that created more space and better results.",likes:86,comments:32},{author:"Mateo Ruiz",tag:"Build in Public",title:"September build challenge: name the one thing",body:"What is the single project you’ll move from almost-ready to shipped this month? Drop it below so we can keep each other honest.",likes:124,comments:46}].map((p,i)=><Card key={p.title} className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className={cn("grid size-10 place-items-center rounded-full text-xs font-bold",members[i].color)}>{members[i].initials}</span><div><b className="block text-sm">{p.author}</b><span className="text-xs text-[#849087]">{p.tag} · {i?"2h":"48m"}</span></div><MoreHorizontal className="ml-auto text-[#98a29c]" size={18}/></div><h3 className="font-display mt-5 text-lg font-bold">{p.title}</h3><p className="mt-2 text-sm leading-6 text-[#5f6f66]">{p.body}</p><div className="mt-5 flex gap-5 border-t border-[#edf0ee] pt-4 text-xs text-[#6d7b73]"><button onClick={()=>i===0&&setLiked(!liked)} className={cn("flex items-center gap-1.5",i===0&&liked&&"font-bold text-[#b1485e]")}><Heart size={15} fill={i===0&&liked?"currentColor":"none"}/>{p.likes+(i===0&&liked?1:0)}</button><span className="flex items-center gap-1.5"><MessageCircle size={15}/>{p.comments}</span><span className="ml-auto flex items-center gap-1.5"><Send size={14}/> Share</span></div></Card>)}
      </div>
      <aside className="space-y-5"><Card className="p-5"><div className="flex items-center justify-between"><h3 className="font-display font-bold">Upcoming</h3><CalendarDays size={17} className="text-[#38795c]"/></div><div className="mt-4 space-y-4">{[["04","Creator roundtable","10:00 AM"],["06","Onboarding clinic","2:30 PM"],["11","Build workshop","9:00 AM"]].map(([day,title,time])=><button type="button" onClick={onExit} key={day} className="flex w-full items-center gap-3 text-left"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3ef] text-sm font-bold text-[#2d6e52]">{day}</span><span><b className="block text-xs">{title}</b><small className="text-[#87928b]">Sep · {time}</small></span></button>)}</div></Card><Card className="p-5"><div className="flex items-center justify-between"><h3 className="font-display font-bold">Your progress</h3><Trophy size={17} className="text-[#d99b3e]"/></div><div className="mt-5 flex items-center gap-4"><div className="grid size-14 place-items-center rounded-full bg-[#e7f2ec] text-sm font-bold text-[#267052]">74%</div><div><b className="block text-sm">Creator OS</b><span className="text-xs text-[#859087]">31 of 42 lessons</span></div></div><Button onClick={onExit} className="mt-5 w-full">Continue learning <Play size={13}/></Button></Card></aside>
    </main>
  </div>;
}

function CreateModal({ view, onClose, notify }: { view: View; onClose: () => void; notify: (text: string) => void }) {
  const title = viewMeta[view].action;
  const [name, setName] = useState("");
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#10271e]/35 p-4 backdrop-blur-sm" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="w-full max-w-md animate-enter rounded-[24px] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#347457]">Quick create</span><h2 className="font-display mt-1 text-xl font-bold">{title}</h2></div><IconButton label="Close" onClick={onClose}><X size={16}/></IconButton></div><label className="mt-6 block"><span className="mb-2 block text-xs font-semibold">Name or title</span><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Give it a clear name" className="h-11 w-full rounded-xl border border-[#dbe4de] px-3 text-sm outline-none focus:ring-2 focus:ring-[#b4d6c4]"/></label><label className="mt-4 block"><span className="mb-2 block text-xs font-semibold">Description</span><textarea placeholder="Add a little context..." className="h-24 w-full resize-none rounded-xl border border-[#dbe4de] p-3 text-sm outline-none focus:ring-2 focus:ring-[#b4d6c4]"/></label><div className="mt-6 flex justify-end gap-2"><Button secondary onClick={onClose}>Cancel</Button><Button onClick={()=>{notify(`${name||title.replace("New ","")} created in local demo`);onClose()}}><Check size={15}/> Create</Button></div></div></div>;
}

const demoOrganizations: OrganizationSummary[] = [
  { id: "demo-collective", name: "The Collective", slug: "the-collective", role: "owner", status: "active", plan: "pro" },
  { id: "demo-founder", name: "Founder House", slug: "founder-house", role: "admin", status: "trial", plan: "pro" },
  { id: "demo-design", name: "Design Circle", slug: "design-circle", role: "member", status: "active", plan: "pro" },
];

const demoUser: CurrentUser = { id: "demo", email: "jamie@example.com", displayName: "Jamie Chen", initials: "JC" };

export function CircularApp({ organizations = demoOrganizations, activeOrganizationId, currentUser = demoUser, initialView = "overview", onSwitchOrganization }: { organizations?: OrganizationSummary[]; activeOrganizationId?: string; currentUser?: CurrentUser; initialView?: string; onSwitchOrganization?: (tenantId: string) => Promise<void> }) {
  const router = useRouter();
  const resolvedInitialView = validViews.has(initialView as View) ? initialView as View : "overview";
  const [view, setView] = useState<View>(resolvedInitialView);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const initialOrganization = organizations.find(org=>org.id===activeOrganizationId) ?? organizations[0] ?? demoOrganizations[0];
  const [tenant, setTenant] = useState(initialOrganization.name);
  const [tenantMenu, setTenantMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const current = viewMeta[view];

  useEffect(() => { if (!toast) return; const t=setTimeout(()=>setToast(""),2800); return()=>clearTimeout(t); }, [toast]);
  useEffect(() => { const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearchOpen(true)} if(e.key==="Escape")setSearchOpen(false)}; window.addEventListener("keydown",onKey); return()=>window.removeEventListener("keydown",onKey); },[]);
  const allNav = useMemo(()=>navGroups.flatMap(g=>g.items),[]);
  const searchResults = allNav.filter(item=>item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const closeMobileSidebar=()=>setMobileSidebarOpen(false);
  const navigate=(next:View)=>{
    closeMobileSidebar();
    if (next === "spaces") {
      router.push("/spaces");
      return;
    }
    if (next === "posts") {
      router.push("/community");
      return;
    }
    if (next === "events") {
      router.push("/events");
      return;
    }
    if (next === "courses") {
      router.push("/courses");
      return;
    }
    if (next === "members") {
      router.push("/team");
      return;
    }
    setView(next);setSearchOpen(false);setSearchQuery("");
    router.push(`/dashboard?view=${next}`);
  };
  const switchTenant=async(organization:OrganizationSummary)=>{setTenant(organization.name);setTenantMenu(false);setToast(`Switched to ${organization.name}`);await onSwitchOrganization?.(organization.id)};
  const runPrimaryAction=()=>{
    if (view === "spaces") return router.push("/spaces#new-space");
    if (view === "posts") return router.push("/community");
    if (view === "events") return router.push("/events");
    if (view === "courses") return router.push("/admin/courses");
    if (view === "members") return router.push("/team");
    if (view === "settings") return setToast("Settings are ready to edit below");
    setCreateOpen(true);
  };

  if (preview) return <MemberPreview onExit={()=>setPreview(false)}/>;

  return <div className="min-h-screen lg:pl-[246px]">
    {mobileSidebarOpen && <button type="button" aria-label="Close navigation menu" onClick={closeMobileSidebar} className="fixed inset-0 z-30 bg-black/20 lg:hidden"/>}
    <aside aria-label="Workspace navigation" className={cn("fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col border-r border-[#dde5df] bg-[#f9faf9] transition-transform lg:translate-x-0", mobileSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="relative border-b border-[#e5eae6] p-3">
        <button onClick={()=>setTenantMenu(!tenantMenu)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[#f0f4f1]"><span className="grid size-9 place-items-center rounded-xl bg-[#183f30] font-display text-sm font-bold text-white">C</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{tenant}</b><small className="block text-[10px] text-[#849188]">Pro workspace</small></span><ChevronDown size={15} className="text-[#819087]"/></button>
        {tenantMenu && <Card className="absolute left-3 right-3 top-[62px] z-50 p-2 shadow-xl">{organizations.map(organization=><button key={organization.id} onClick={()=>switchTenant(organization)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-[#f2f5f3]"><span className="grid size-6 place-items-center rounded-lg bg-[#e8f1ec] text-[9px] text-[#286b50]">{organization.name[0]}</span><span className="min-w-0 flex-1 truncate">{organization.name}</span>{tenant===organization.name&&<Check size={13}/>}</button>)}<div className="my-1 border-t border-[#e8ece9]"/><Link href="/onboarding?new=1" onClick={closeMobileSidebar} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[#53675b] hover:bg-[#f2f5f3]"><Plus size={13}/> Create workspace</Link></Card>}
      </div>
      <nav className="scrollbar-none flex-1 overflow-y-auto px-3 py-3">{navGroups.map((group,index)=><div key={group.label||index} className={cn(index>0&&"mt-5")}>
        {group.label&&<p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#a0aaa4]">{group.label}</p>}
        <div className="space-y-0.5">{group.items.map(item=><Link key={item.id} href={navigationHref(item.id)} onClick={()=>{closeMobileSidebar();setView(item.id)}} aria-current={view===item.id?"page":undefined} className={cn("flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-xs font-medium transition",view===item.id?"bg-[#e6f0ea] font-semibold text-[#1f664a]":"text-[#66766d] hover:bg-[#f0f4f1] hover:text-[#273c30]")}><item.icon size={16}/><span className="flex-1 text-left">{item.label}</span>{item.badge&&<span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-bold",item.badge==="New"?"bg-[#f8e6c8] text-[#996010]":"bg-white text-[#708078]")}>{item.badge}</span>}</Link>)}</div>
      </div>)}</nav>
      <div className="border-t border-[#e1e7e3] p-3"><Link href="/community" onClick={closeMobileSidebar} className="flex w-full items-center gap-2 rounded-xl border border-[#dce4df] bg-white px-3 py-2.5 text-xs font-semibold text-[#405649] shadow-sm hover:bg-[#f5f8f6]"><ExternalLink size={15}/> View community<span className="ml-auto rounded bg-[#edf2ef] px-1.5 py-0.5 text-[8px] text-[#7c8981]">Open</span></Link><Link href="/community/introduce" onClick={closeMobileSidebar} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-[#183f30] px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#245841]"><UserRoundPlus size={15}/> Create my introduction</Link><div className="mt-3 flex items-center gap-2 px-1"><span className="grid size-8 place-items-center rounded-full bg-[#ffead8] text-[10px] font-bold text-[#9b5c26]">{currentUser.initials}</span><div className="min-w-0 flex-1"><b className="block truncate text-xs">{currentUser.displayName}</b><small className="text-[10px] capitalize text-[#8b968f]">{organizations.find(org=>org.name===tenant)?.role??"member"}</small></div><form action={signOut}><button aria-label="Sign out" title="Sign out" className="grid size-7 place-items-center rounded-lg text-[#8b968f] hover:bg-[#f0f3f1] hover:text-[#994f3c]"><LogOut size={14}/></button></form></div></div>
    </aside>
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#e2e8e4] bg-[#f6f8f6]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8"><div className="flex h-[70px] items-center gap-3"><button type="button" aria-label="Open navigation menu" aria-expanded={mobileSidebarOpen} onClick={()=>setMobileSidebarOpen(true)} className="grid size-9 place-items-center rounded-xl border border-[#dfe6e1] bg-white lg:hidden"><Menu size={17}/></button><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#8a968f]">{current.eyebrow}</p><h1 className="font-display truncate text-lg font-bold tracking-[-.025em] sm:text-xl">{current.title}</h1></div><div className="ml-auto flex items-center gap-2"><button type="button" onClick={()=>setSearchOpen(true)} className="hidden h-9 w-48 items-center gap-2 rounded-xl border border-[#dfe6e1] bg-white px-3 text-left text-xs text-[#89958d] md:flex"><Search size={14}/> Search anything <span className="ml-auto rounded bg-[#f1f4f2] px-1.5 py-0.5 text-[9px]">⌘K</span></button><IconButton label="Inbox" onClick={()=>router.push("/notifications")}><Inbox size={16}/></IconButton><div className="relative"><IconButton label="Notifications" onClick={()=>router.push("/notifications")}><Bell size={16}/><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#da694e] ring-2 ring-white"/></IconButton></div><Button onClick={runPrimaryAction} className="px-3 sm:px-4"><Plus size={15}/><span className="hidden sm:inline">{current.action}</span></Button></div></div></header>
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        {view==="overview"&&<Overview navigate={navigate}/>} {view==="spaces"&&<SpacesScreen openCommunity={()=>router.push("/community")} openTeam={()=>router.push("/team")} notify={setToast}/>} {view==="members"&&<MembersScreen notify={setToast}/>} {view==="audience"&&<MembersScreen audience notify={setToast}/>} 
        {(view==="posts"||view==="events"||view==="courses"||view==="live")&&<ContentScreen key={view} kind={view} notify={setToast}/>} {view==="email"&&<EmailScreen notify={setToast}/>} {view==="workflows"&&<WorkflowsScreen notify={setToast}/>} {view==="agents"&&<AgentsScreen notify={setToast}/>} {view==="website"&&<WebsiteScreen notify={setToast}/>} {view==="payments"&&<PaymentsScreen notify={setToast}/>} {view==="analytics"&&<AnalyticsScreen/>} {view==="settings"&&<SettingsScreen tenant={tenant} notify={setToast}/>} 
      </div>
    </main>
    {createOpen&&<CreateModal view={view} onClose={()=>setCreateOpen(false)} notify={setToast}/>} 
    {searchOpen&&<div className="fixed inset-0 z-50 flex justify-center bg-[#10271e]/30 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={e=>e.target===e.currentTarget&&setSearchOpen(false)}><Card className="h-fit w-full max-w-xl overflow-hidden shadow-2xl"><div className="flex items-center gap-3 border-b border-[#e7ece8] p-4"><Search size={18} className="text-[#668076]"/><input autoFocus value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} placeholder="Search features, members, and content..." className="flex-1 text-sm outline-none"/><button type="button" onClick={()=>{setSearchOpen(false);setSearchQuery("")}} className="rounded-md bg-[#f1f4f2] px-2 py-1 text-[10px] text-[#7b8981]">ESC</button></div><div className="max-h-[55vh] overflow-y-auto p-2"><p className="px-2 py-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#98a29c]">Jump to</p>{searchResults.map(item=><button type="button" onClick={()=>navigate(item.id)} key={item.id} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold hover:bg-[#f2f6f3]"><item.icon size={15} className="text-[#507061]"/>{item.label}<ChevronRight size={13} className="ml-auto text-[#a2aba6]"/></button>)}{!searchResults.length&&<p className="px-3 py-6 text-center text-xs text-[#839087]">No matching features.</p>}</div></Card></div>}
    {toast&&<div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#183f30] px-4 py-2.5 text-xs font-semibold text-white shadow-xl"><span className="grid size-5 place-items-center rounded-full bg-white/15"><Check size={12}/></span>{toast}</div>}
  </div>;
}
