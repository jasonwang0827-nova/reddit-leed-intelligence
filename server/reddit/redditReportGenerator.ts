import {
  loadAnalyzedLeads,
  loadCommentMonitor,
  loadContentPool,
  loadPublishQueue,
  loadPublishRecords,
  paths,
  writeText
} from "./redditConfigLoader.js";

export async function generateDailyReport(clientId: string): Promise<string> {
  const [leads, pool, queue, records, comments] = await Promise.all([
    loadAnalyzedLeads(),
    loadContentPool(),
    loadPublishQueue(),
    loadPublishRecords(),
    loadCommentMonitor()
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const highProblems = leads.filter((lead) => lead.lead_signal === "high").slice(0, 8);
  const drafts = pool.filter((item) => item.client_id === clientId).slice(0, 8);
  const pendingReview = queue.filter((item) => item.status === "pending_review").length;
  const browserReady = queue.filter((item) => item.status === "browser_assist_ready").length;
  const publishedToday = records.filter((item) => item.published_at.startsWith(today)).length;
  const highSignalComments = comments.flatMap((item) => item.comments).filter((comment) => comment.lead_signal === "high");
  const angles = [...new Set([
    ...highProblems.map((lead) => lead.content_angle),
    "被拒签后不要马上重递，先检查这3个问题",
    "35岁申请加拿大College，签证官最担心什么？",
    "资金证明不是钱越多越好，关键是逻辑"
  ])].slice(0, 8);

  const markdown = `# Reddit Daily Intelligence Report

Date: ${today}
Client: ${clientId}

## 1. High-Signal Reddit Problems
${highProblems.length ? highProblems.map((lead) => `- ${lead.user_problem}`).join("\n") : "- No high-signal problems found yet"}

## 2. Recommended Reddit Drafts
${drafts.length ? drafts.map((draft) => `- ${draft.title}`).join("\n") : "- No drafts generated yet"}

## 3. Publishing Queue
- Pending review: ${pendingReview}
- Browser-assist ready: ${browserReady}
- Published today: ${publishedToday}

## 4. Comment Feedback
- New high-signal comments: ${highSignalComments.length}
- New FAQ ideas: ${highSignalComments.length + highProblems.length}

## 5. Xiaohongshu / Douyin Content Angles
${angles.map((angle) => `- ${angle}`).join("\n")}
`;

  await writeText(paths.dailyReport, markdown);
  return markdown;
}
