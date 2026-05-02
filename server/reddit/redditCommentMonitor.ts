import {
  loadAnalyzedLeads,
  loadCommentMonitor,
  loadPublishRecords,
  nowIso,
  saveCommentMonitor,
  upsertBy
} from "./redditConfigLoader.js";
import type { CommentMonitorRecord, LeadSignal, MonitoredComment } from "./redditTypes.js";

interface RedditCommentsResponse {
  data?: {
    children?: Array<{
      kind?: string;
      data?: {
        id?: string;
        body?: string;
      };
    }>;
  };
}

function jsonUrl(url: string): string {
  const clean = url.replace(/\/?$/, "");
  return `${clean}.json?raw_json=1`;
}

function signalFor(text: string): LeadSignal {
  const lowered = text.toLowerCase();
  if (/refus|reject|urgent|deadline|funds|purpose of visit|second/.test(lowered)) return "high";
  if (/pgwp|college|university|program|cost|study plan/.test(lowered)) return "medium";
  if (text.trim().length > 20) return "low";
  return "none";
}

function replyDraft(text: string): string {
  const lowered = text.toLowerCase();
  if (/funds|financial/.test(lowered)) {
    return "A second refusal involving funds usually means the full financial logic should be reviewed before resubmitting. It is not only the amount, but also source, consistency, sponsor relationship, and whether the documents support the study plan.";
  }
  if (/purpose of visit|study plan/.test(lowered)) {
    return "Purpose of visit concerns often connect to program logic, background, career path, finances, and ties. A stronger reapplication usually explains how those pieces fit together instead of only adding documents.";
  }
  return "It may help to separate the issue into the refusal reason, the supporting documents, and the overall application logic. This is general information, not legal advice for a specific case.";
}

export async function monitorRedditComments(): Promise<CommentMonitorRecord[]> {
  const [records, existing] = await Promise.all([loadPublishRecords(), loadCommentMonitor()]);
  const monitored: CommentMonitorRecord[] = [];

  for (const record of records) {
    const response = await fetch(jsonUrl(record.published_url), {
      headers: { "user-agent": "reddit-community-intelligence-v0.1", accept: "application/json" }
    });
    if (!response.ok) continue;
    const payload = (await response.json()) as RedditCommentsResponse[];
    const commentListing = payload[1];
    const comments: MonitoredComment[] = (commentListing?.data?.children ?? [])
      .filter((child) => child.kind === "t1" && child.data?.body)
      .map((child) => {
        const text = child.data?.body ?? "";
        return {
          comment_id: child.data?.id ?? `comment_${Date.now()}`,
          text,
          lead_signal: signalFor(text),
          user_problem: text.slice(0, 140),
          recommended_reply_draft: replyDraft(text)
        };
      })
      .filter((comment) => comment.lead_signal !== "none")
      .slice(0, 20);

    monitored.push({
      published_url: record.published_url,
      content_id: record.content_id,
      comments_checked_at: nowIso(),
      comments
    });
  }

  await saveCommentMonitor(upsertBy(existing, monitored, (row) => row.published_url));
  return monitored;
}

export async function commentIdeasFromLeads(): Promise<string[]> {
  const leads = await loadAnalyzedLeads();
  return [...new Set(leads.filter((lead) => lead.lead_signal === "high").map((lead) => lead.content_angle))].slice(0, 8);
}
