"use client";

import { useState } from "react";

function splitDateTime(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function EventDateTimeFields({ defaultStart = "", defaultEnd = "" }: { defaultStart?: string; defaultEnd?: string }) {
  const initialStart = splitDateTime(defaultStart);
  const initialEnd = splitDateTime(defaultEnd);
  const [startDate, setStartDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endDate, setEndDate] = useState(initialEnd.date);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const startsAt = startDate && startTime ? `${startDate}T${startTime}` : "";
  const endsAt = endDate && endTime ? `${endDate}T${endTime}` : "";

  function updateStartDate(nextDate: string) {
    setStartDate(nextDate);
    setEndDate(nextDate);
  }

  function updateStartTime(nextTime: string) {
    setStartTime(nextTime);
    setEndTime(nextTime);
  }

  return <>
    <input type="hidden" name="startsAt" value={startsAt}/>
    <input type="hidden" name="endsAt" value={endsAt}/>
    <fieldset className="rounded-2xl border border-[#e1e8e3] p-3"><legend className="px-1 text-xs font-semibold">Starts</legend><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-[10px] font-semibold text-[#67776e]">Date</span><input type="date" required value={startDate} onInput={(event) => updateStartDate(event.currentTarget.value)} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label><label><span className="mb-1.5 block text-[10px] font-semibold text-[#67776e]">Time</span><input type="time" required value={startTime} onInput={(event) => updateStartTime(event.currentTarget.value)} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label></div></fieldset>
    <fieldset className="rounded-2xl border border-[#e1e8e3] p-3"><legend className="px-1 text-xs font-semibold">Ends</legend><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-[10px] font-semibold text-[#67776e]">Date</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label><label><span className="mb-1.5 block text-[10px] font-semibold text-[#67776e]">Time</span><input type="time" value={endTime} min={endDate === startDate ? startTime || undefined : undefined} onChange={(event) => setEndTime(event.target.value)} className="h-11 w-full rounded-xl border border-[#dce5df] px-3 text-sm"/></label></div><span className="mt-2 block text-[10px] text-[#819087]">Both fields refresh from Starts and can be adjusted afterward.</span></fieldset>
  </>;
}
