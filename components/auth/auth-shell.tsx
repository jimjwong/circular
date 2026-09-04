import { Sparkles, ShieldCheck, Users } from "lucide-react";

export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="grid min-h-screen bg-[#f5f7f5] lg:grid-cols-[1.08fr_.92fr]">
    <section className="relative hidden overflow-hidden bg-[#173f31] p-12 text-white lg:flex lg:flex-col">
      <div className="absolute -right-24 -top-24 size-80 rounded-full bg-[#3c8062]/30 blur-3xl"/><div className="absolute -bottom-28 left-10 size-80 rounded-full bg-[#ddb05f]/15 blur-3xl"/>
      <div className="relative flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white font-display font-bold text-[#173f31]">C</span><span><b className="font-display block">Circular</b><small className="text-[#b9cec4]">Community operating system</small></span></div>
      <div className="relative my-auto max-w-xl"><span className="text-xs font-bold uppercase tracking-[.18em] text-[#efc77f]">Built for belonging</span><h2 className="font-display mt-5 text-5xl font-bold leading-[1.06] tracking-[-.05em]">Bring your people, knowledge, and business together.</h2><p className="mt-6 max-w-lg text-sm leading-7 text-[#c3d5cc]">A secure multi-tenant home for communities, learning, events, memberships, and the teams behind them.</p><div className="mt-10 grid grid-cols-3 gap-3">{[[Users,"Multi-tenant"],[ShieldCheck,"Role-secure"],[Sparkles,"Built to scale"]].map(([I,text])=>{const Icon=I as typeof Users;return <div key={text as string} className="rounded-2xl border border-white/10 bg-white/5 p-4"><Icon size={18} className="text-[#efc77f]"/><span className="mt-3 block text-xs font-semibold">{text as string}</span></div>})}</div></div>
      <p className="relative text-xs text-[#8eaea0]">Local-first development · Supabase-backed security</p>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-[420px]"><div className="mb-8 flex items-center gap-3 lg:hidden"><span className="grid size-9 place-items-center rounded-xl bg-[#173f31] font-display text-sm font-bold text-white">C</span><b className="font-display">Circular</b></div><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#347457]">{eyebrow}</span><h1 className="font-display mt-2 text-3xl font-bold tracking-[-.04em] text-[#1b2e24]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#718078]">{description}</p>{children}</div></section>
  </main>;
}
