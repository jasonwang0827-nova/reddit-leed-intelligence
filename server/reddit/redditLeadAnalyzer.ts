import {
  loadAnalyzedLeads,
  loadRawResults,
  loadTopics,
  nowIso,
  saveAnalyzedLeads,
  upsertBy
} from "./redditConfigLoader.js";
import type { AnalyzedLead, KeywordTopic, LeadSignal, RawRedditResult } from "./redditTypes.js";

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term.toLowerCase()));

function getLeadSignal(text: string, topic: KeywordTopic): LeadSignal {
  const lowered = text.toLowerCase();
  if (includesAny(lowered, topic.lead_signal_rules.high)) return "high";
  if (includesAny(lowered, topic.lead_signal_rules.medium)) return "medium";
  if (includesAny(lowered, topic.lead_signal_rules.low)) return "low";
  return "none";
}

function getPainPoints(text: string): string[] {
  const lowered = text.toLowerCase();
  const points = new Set<string>();
  if (/refus|reject|denied/.test(lowered)) points.add("visa refusal anxiety");
  if (/financial|funds|bank|money|proof of funds/.test(lowered)) points.add("financial proof concern");
  if (/purpose of visit|study plan|sop/.test(lowered)) points.add("study plan and purpose of visit concern");
  if (/pgwp|work permit/.test(lowered)) points.add("PGWP eligibility concern");
  if (/urgent|deadline|soon|asap/.test(lowered)) points.add("time pressure");
  if (/spouse|children|family/.test(lowered)) points.add("family application concern");
  if (points.size === 0) points.add("unclear next step");
  return [...points].slice(0, 5);
}

function summarizeProblem(row: RawRedditResult, signal: LeadSignal): string {
  const title = row.title.replace(/\s+/g, " ").trim();
  if (signal === "high") return `${title || "Applicant has a specific immigration or study problem"} and needs a safer next step`;
  if (signal === "medium") return `${title || "User is comparing education or immigration options"} and is evaluating risk`;
  if (signal === "low") return `${title || "General policy or community discussion"}`;
  return title || "No clear lead problem detected";
}

function getCaseContext(text: string): AnalyzedLead["case_context"] {
  const lowered = text.toLowerCase();
  const ageMatch = lowered.match(/\b([3-5][0-9])\s*(years old|yo|year old)?\b/);
  const countryMatch = lowered.match(/\b(from|in)\s+([a-z][a-z\s]{2,24})\b/);
  return {
    age: ageMatch ? Number(ageMatch[1]) : null,
    country: countryMatch ? countryMatch[2].trim() : null,
    application_stage: lowered.includes("second refusal") || lowered.includes("refused twice")
      ? "refused twice"
      : lowered.includes("refused") || lowered.includes("rejected")
        ? "refused"
        : lowered.includes("applied")
          ? "applied"
          : null,
    main_concern: lowered.includes("purpose of visit")
      ? "purpose of visit"
      : lowered.includes("financial") || lowered.includes("funds")
        ? "financial proof"
        : lowered.includes("pgwp")
          ? "PGWP eligibility"
          : null,
    budget_issue: /financial|funds|bank|money|proof of funds/.test(lowered),
    school_or_program: lowered.includes("college") ? "college" : lowered.includes("university") ? "university" : null
  };
}

function contentAngle(row: RawRedditResult, signal: LeadSignal): string {
  const text = `${row.title} ${row.text}`.toLowerCase();
  if (text.includes("purpose of visit")) return "加拿大留学签证被拒：purpose of visit 到底在看什么？";
  if (text.includes("financial") || text.includes("funds")) return "资金证明不是钱越多越好，关键是解释逻辑";
  if (text.includes("pgwp")) return "选加拿大项目之前，先确认 PGWP 风险";
  if (text.includes("refused") || text.includes("rejected")) return "被拒签后不要马上重递，先检查这几个风险点";
  return signal === "medium" ? "留学移民决策前需要先问清楚的问题" : "Reddit 高频讨论带来的内容选题";
}

export function analyzeLead(row: RawRedditResult, topic: KeywordTopic): AnalyzedLead {
  const combined = `${row.title}\n${row.text}`;
  const signal = getLeadSignal(combined, topic);
  return {
    reddit_id: row.reddit_id,
    topic_id: row.topic_id,
    subreddit: row.subreddit,
    url: row.url,
    title: row.title,
    user_problem: summarizeProblem(row, signal),
    case_context: getCaseContext(combined),
    pain_points: getPainPoints(combined),
    urgency: signal === "high" ? "high" : signal === "medium" ? "medium" : "low",
    lead_signal: signal,
    content_angle: contentAngle(row, signal),
    analyzed_at: nowIso()
  };
}

export async function analyzeRedditLeads(): Promise<AnalyzedLead[]> {
  const [rawRows, topics, existing] = await Promise.all([loadRawResults(), loadTopics(), loadAnalyzedLeads()]);
  const analyzed = rawRows.map((row) => {
    const topic = topics.find((item) => item.topic_id === row.topic_id);
    if (!topic) throw new Error(`Missing topic config: ${row.topic_id}`);
    return analyzeLead(row, topic);
  });
  const merged = upsertBy(existing, analyzed, (row) => row.reddit_id);
  await saveAnalyzedLeads(merged);
  return analyzed;
}
