import {
  loadComplianceResults,
  loadContentPool,
  loadMatrixConfig,
  loadPublishRecords,
  loadSubreddits,
  nowIso,
  saveComplianceResults,
  saveContentPool,
  upsertBy
} from "./redditConfigLoader.js";
import type { ComplianceResult, RedditContent } from "./redditTypes.js";

const blockedPhrases = [
  "dm me",
  "message me",
  "add my wechat",
  "book a consultation",
  "free assessment",
  "i can help you apply",
  "contact us",
  "call me",
  "whatsapp me",
  "guaranteed approval",
  "100% success"
];

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3));
}

function jaccard(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function toneRisk(text: string): "low" | "medium" | "high" {
  const markers = ["as an ai", "delve", "unlock", "game-changer", "in today's world"];
  const count = markers.filter((marker) => text.toLowerCase().includes(marker)).length;
  return count > 1 ? "high" : count === 1 ? "medium" : "low";
}

export async function checkRedditCompliance(content: RedditContent, duplicateBaseline?: RedditContent[]): Promise<ComplianceResult> {
  const [pool, subreddits, records] = await Promise.all([loadContentPool(), loadSubreddits(), loadPublishRecords()]);
  const text = `${content.title}\n${content.body}`;
  const lowered = text.toLowerCase();
  const subreddit = subreddits.find((item) => item.subreddit === content.target_subreddit);
  const activeDuplicateBaseline = (duplicateBaseline ?? pool.filter((item) =>
    ["published", "approved", "scheduled", "browser_assist_ready"].includes(item.status) ||
    (item.publish_status === "queued" && !["compliance_failed", "rejected", "archived"].includes(item.status))
  )).filter((item) => item.content_id !== content.content_id);
  const similarities = activeDuplicateBaseline
    .map((item) => jaccard(text, `${item.title}\n${item.body}`));
  const maxSimilarity = similarities.length ? Math.max(...similarities) : 0;
  const containsEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
  const containsPhone = /(?:\+?\d[\s().-]*){8,}/.test(text);
  const containsWechat = /wechat|weixin|微信/i.test(text);
  const containsDirectCta = blockedPhrases.some((phrase) => lowered.includes(phrase));
  const legalAdviceRisk = /guarantee|will be approved|must submit|legal advice/i.test(text)
    ? "high"
    : /visa|permit|immigration|reapply|refusal/i.test(text)
      ? "medium"
      : "low";
  const subredditRuleConflict = Boolean(subreddit && (!subreddit.allow_consultant_posts || !subreddit.allow_self_promotion) && containsDirectCta);
  const recentSameSubredditPosts = records.filter((record) => record.subreddit === content.target_subreddit).length;
  const postingFrequencyRisk = recentSameSubredditPosts >= (subreddit?.weekly_post_limit ?? 3) ? "high" : recentSameSubredditPosts > 0 ? "medium" : "low";

  const checks: ComplianceResult["checks"] = {
    duplicate_content: maxSimilarity > 0.92,
    too_promotional: containsDirectCta || /consultation|service|agency|client/i.test(text),
    contains_contact_info: containsEmail || containsPhone || containsWechat,
    contains_wechat: containsWechat,
    contains_phone_number: containsPhone,
    contains_email: containsEmail,
    contains_direct_sales_cta: containsDirectCta,
    subreddit_rule_conflict: subredditRuleConflict,
    legal_advice_risk: legalAdviceRisk,
    ai_generated_tone_risk: toneRisk(text),
    cross_subreddit_duplicate_risk: maxSimilarity > 0.72,
    similarity_to_recent_posts: Number(maxSimilarity.toFixed(2)),
    posting_frequency_risk: postingFrequencyRisk
  };

  let riskScore = 0;
  if (checks.duplicate_content) riskScore += 0.35;
  if (checks.too_promotional) riskScore += 0.25;
  if (checks.contains_contact_info) riskScore += 0.25;
  if (checks.subreddit_rule_conflict) riskScore += 0.2;
  if (checks.legal_advice_risk === "high") riskScore += 0.2;
  if (checks.legal_advice_risk === "medium") riskScore += 0.08;
  if (checks.ai_generated_tone_risk === "high") riskScore += 0.12;
  if (checks.cross_subreddit_duplicate_risk) riskScore += 0.15;
  if (checks.posting_frequency_risk === "high") riskScore += 0.2;
  riskScore = Math.min(1, Number(riskScore.toFixed(2)));

  const hardFail = checks.contains_direct_sales_cta || checks.contains_contact_info || checks.duplicate_content || checks.subreddit_rule_conflict;
  const result: ComplianceResult = {
    content_id: content.content_id,
    checks,
    risk_score: riskScore,
    decision: hardFail || riskScore > 0.75 ? "compliance_failed" : "ready_for_review",
    notes: [
      checks.contains_direct_sales_cta ? "Direct promotional CTA detected" : "No direct promotion detected",
      checks.contains_contact_info ? "Contact information detected" : "No contact information included",
      lowered.includes("not legal advice") ? "Soft disclaimer included" : "Soft disclaimer missing"
    ],
    checked_at: nowIso()
  };
  return result;
}

export async function runComplianceForDrafts(clientId: string): Promise<ComplianceResult[]> {
  const [pool, existingResults, matrixConfig] = await Promise.all([loadContentPool(), loadComplianceResults(), loadMatrixConfig()]);
  const drafts = pool
    .filter((item) => item.client_id === clientId && ["draft", "ready_for_review"].includes(item.status))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const acceptedBaseline = pool.filter((item) =>
    item.client_id === clientId &&
    (
      ["published", "approved", "scheduled", "browser_assist_ready"].includes(item.status) ||
      (item.publish_status === "queued" && !["compliance_failed", "rejected", "archived"].includes(item.status))
    )
  );
  const results: ComplianceResult[] = [];
  for (const draft of drafts) {
    const result = await checkRedditCompliance(draft, acceptedBaseline);
    results.push(result);
    if (result.decision === "ready_for_review" && result.risk_score <= matrixConfig.compliance.max_risk_score_for_review) {
      acceptedBaseline.push(draft);
    }
  }
  const resultById = new Map(results.map((result) => [result.content_id, result]));
  const updatedPool = pool.map((item) => {
    const result = resultById.get(item.content_id);
    if (!result) return item;
    const reviewReady = result.decision === "ready_for_review" && result.risk_score <= matrixConfig.compliance.max_risk_score_for_review;
    return {
      ...item,
      status: reviewReady ? "ready_for_review" as const : "compliance_failed" as const,
      publish_status: reviewReady ? item.publish_status : "not_published" as const,
      risk_score: result.risk_score,
      updated_at: nowIso()
    };
  });
  await Promise.all([
    saveContentPool(updatedPool),
    saveComplianceResults(upsertBy(existingResults, results, (row) => row.content_id))
  ]);
  return results;
}
