"use client";

import { useMemo, useState } from "react";

// Pre-resolved on the server: the href already carries the site's mount prefix, and
// memberType is derived once from custom_values rather than re-parsed on every render.
export type PublicMemberCard = {
  id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  href: string;
  categories: string[];
  memberTypes: string[];
};

const inputClass = "h-10 rounded-xl border border-[#dce5df] bg-white px-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]";

/**
 * The interactive counterpart to EventList/CourseList: those stay server-rendered
 * because a static list needs no client JS, but a searchable, filterable directory
 * does. The server resolves and pre-sorts the member list; this component only ever
 * filters what it was handed, so no member data crosses the client/server boundary
 * more than once.
 */
export function MemberDirectory({ members, accent, limit, showFilters = true }: {
  members: PublicMemberCard[];
  accent: string;
  /** Caps the grid without touching the filters — used for a compact homepage preview. */
  limit?: number;
  showFilters?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [memberType, setMemberType] = useState("All");
  const [category, setCategory] = useState("All");

  const memberTypes = useMemo(
    () => ["All", ...[...new Set(members.flatMap((member) => member.memberTypes))].sort()],
    [members],
  );
  const categories = useMemo(
    () => ["All", ...[...new Set(members.flatMap((member) => member.categories))].sort()],
    [members],
  );

  let filtered = members;
  if (showFilters) {
    filtered = members.filter((member) => {
      if (memberType !== "All" && !member.memberTypes.includes(memberType)) return false;
      if (category !== "All" && !member.categories.includes(category)) return false;
      if (search.trim() && !member.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }
  if (limit) filtered = filtered.slice(0, limit);

  return (
    <div>
      {showFilters && (
        <div className="mb-6 grid gap-2.5 sm:grid-cols-[1fr_1fr_1.4fr]">
          <select className={inputClass} value={memberType} onChange={(event) => setMemberType(event.target.value)} aria-label="Filter by member type">
            {memberTypes.map((type) => <option key={type} value={type}>{type === "All" ? "All member types" : type}</option>)}
          </select>
          <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by topic">
            {categories.map((cat) => <option key={cat} value={cat}>{cat === "All" ? "All topics" : cat}</option>)}
          </select>
          <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" aria-label="Search by name" />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#77867d]">No speakers match those filters.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <a
              key={member.id}
              href={member.href}
              className="flex flex-col overflow-hidden rounded-[10px] border border-[#d8d8d8] bg-white text-inherit no-underline"
            >
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt="" loading="lazy" className="h-[200px] w-full object-cover" />
              ) : (
                <div className="h-[200px] w-full bg-[#f0f0f0]" aria-hidden />
              )}
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                {member.memberTypes.length > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>{member.memberTypes.join(" · ")}</span>
                )}
                <b className="text-[15px] text-[#202020]">{member.name}</b>
                {member.categories.length > 0 && <span className="text-xs leading-5 text-[#707070]">{member.categories.slice(0, 4).join(", ")}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
