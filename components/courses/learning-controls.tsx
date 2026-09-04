"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { completeLearningItem, recordLearningHeartbeat, startLearningItem, submitQuizAnswer } from "@/app/actions/courses";
import { createClientUuid } from "@/lib/client-uuid";

export function LearningControls({ itemId, itemType, completionRequirement, watchThreshold, scoreThreshold, quizOptions, completed, nextHref }: { itemId: string; itemType: string; completionRequirement: string; watchThreshold: number; scoreThreshold: number | null; quizOptions: string[]; completed: boolean; nextHref: string | null }) {
  const router = useRouter();
  const sessionKey = useRef<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");

  useEffect(() => {
    sessionKey.current = createClientUuid();
    void startLearningItem(itemId).then((result) => { if (!result.ok) setError(result.error); }).catch(() => setError("Unable to start this lesson. Please reload and try again."));
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void recordLearningHeartbeat(itemId, sessionKey.current, createClientUuid(), 30).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [itemId]);

  const finish = () => startTransition(async () => {
    try {
      setError("");
      const result = completionRequirement === "score_threshold" ? await submitQuizAnswer(itemId, answer) : await completeLearningItem(itemId, itemType === "video" ? 100 : undefined, undefined, completionRequirement === "must_submit" ? submissionUrl : undefined);
      if (!result.ok) return setError(result.error);
      if (nextHref) router.push(nextHref as never);
      else router.refresh();
    } catch {
      setError("Unable to save your progress. Please try again.");
    }
  });

  if (completed) return <div className="mt-6 flex items-center gap-2 rounded-xl bg-[#e8f3ed] px-4 py-3 text-xs font-bold text-[#246749]"><CheckCircle2 size={16}/> Lesson completed</div>;
  return <section className="mt-6 rounded-[20px] border border-[#dce5df] bg-white p-5"><h2 className="font-display font-bold">Complete this lesson</h2>{itemType === "video" && <p className="mt-2 text-xs text-[#718078]">Watch at least {watchThreshold}% while this tab is active. Completion is checked against the server-side time ledger.</p>}{completionRequirement === "score_threshold" && <fieldset className="mt-4"><legend className="text-xs font-semibold">Choose your answer <span className="font-normal text-[#7b8981]">({scoreThreshold}% required)</span></legend><div className="mt-2 space-y-2">{quizOptions.map((option) => <label key={option} className="flex items-center gap-3 rounded-xl border border-[#dce5df] p-3 text-xs"><input type="radio" name={`answer-${itemId}`} value={option} checked={answer === option} onChange={(event) => setAnswer(event.target.value)}/>{option}</label>)}</div></fieldset>}{completionRequirement === "must_submit" && <label className="mt-4 block text-xs font-semibold">Submission link<input type="url" value={submissionUrl} onChange={(event) => setSubmissionUrl(event.target.value)} placeholder="https://…" className="mt-2 h-10 w-full rounded-xl border border-[#dce5df] px-3 outline-none focus:ring-2 focus:ring-[#acd0bd]"/></label>}<button type="button" disabled={pending} onClick={finish} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#183f30] px-4 text-xs font-bold text-white disabled:opacity-60">{pending ? <LoaderCircle size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} {pending ? "Saving…" : completionRequirement === "score_threshold" ? "Submit answer" : nextHref ? "Complete and continue" : "Complete lesson"}</button>{error && <p role="alert" className="mt-3 text-xs font-semibold text-[#a54435]">{error}</p>}</section>;
}
