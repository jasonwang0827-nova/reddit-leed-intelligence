import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  loadAnalyzedLeads,
  loadComplianceResults,
  loadContentPool,
  loadPublishQueue,
  loadRawResults,
  loadSubreddits,
  loadTopics,
  parseArgs,
  paths
} from "./reddit/redditConfigLoader.js";
import { collectRedditTopic } from "./reddit/redditCollector.js";
import { analyzeRedditLeads } from "./reddit/redditLeadAnalyzer.js";
import { generateRedditDrafts } from "./reddit/redditPostDraftGenerator.js";
import { runComplianceForDrafts } from "./reddit/redditComplianceGuard.js";
import { approvePublishTask, buildPublishQueue } from "./reddit/redditPublishQueue.js";
import { generateDailyReport } from "./reddit/redditReportGenerator.js";
import { createAccountProfile, getAccountMatrixStatus, openAccountLogin, updateAccountProfile } from "./reddit/redditAccountMatrix.js";

type Json = unknown;

const publicDir = join(paths.root, "public");
const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res: ServerResponse, value: Json, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function sendError(res: ServerResponse, error: unknown, status = 500) {
  sendJson(res, { error: error instanceof Error ? error.message : String(error) }, status);
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

async function getState() {
  const [accounts, subreddits, topics, raw, leads, content, compliance, queue] = await Promise.all([
    getAccountMatrixStatus(),
    loadSubreddits(),
    loadTopics(),
    loadRawResults(),
    loadAnalyzedLeads(),
    loadContentPool(),
    loadComplianceResults(),
    loadPublishQueue()
  ]);
  return {
    accounts,
    subreddits,
    topics,
    raw_count: raw.length,
    lead_count: leads.length,
    high_signal_count: leads.filter((lead) => lead.lead_signal === "high").length,
    content,
    compliance,
    queue,
    summary: {
      drafts: content.filter((item) => item.status === "draft").length,
      ready_for_review: content.filter((item) => item.status === "ready_for_review").length,
      browser_assist_ready: content.filter((item) => item.status === "browser_assist_ready").length,
      published: content.filter((item) => item.status === "published").length,
      pending_queue: queue.filter((item) => item.status === "pending_review").length
    }
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string) {
  if (req.method === "GET" && pathname === "/api/state") return sendJson(res, await getState());

  if (req.method === "POST" && pathname === "/api/accounts") {
    return sendJson(res, await createAccountProfile(await readBody(req)));
  }

  const accountUpdateMatch = pathname.match(/^\/api\/accounts\/([^/]+)$/);
  if (req.method === "PATCH" && accountUpdateMatch) {
    return sendJson(res, await updateAccountProfile(accountUpdateMatch[1], await readBody(req)));
  }

  const accountLoginMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/open-login$/);
  if (req.method === "POST" && accountLoginMatch) {
    return sendJson(res, await openAccountLogin(accountLoginMatch[1]));
  }

  if (req.method === "POST" && pathname === "/api/pipeline") {
    const body = await readBody(req);
    const clientId = String(body.client_id || "study_immigration");
    const topicId = String(body.topic_id || "");
    const limit = Number(body.limit || 30);
    if (!topicId) return sendError(res, new Error("topic_id is required"), 400);
    const collected = await collectRedditTopic(topicId, limit);
    const analyzed = await analyzeRedditLeads();
    const drafts = await generateRedditDrafts(clientId, topicId);
    const results = await runComplianceForDrafts(clientId);
    const tasks = await buildPublishQueue(clientId);
    await generateDailyReport(clientId);
    return sendJson(res, { collected: collected.length, analyzed: analyzed.length, drafts: drafts.length, compliance_results: results.length, queue_tasks: tasks.length });
  }

  const approveMatch = pathname.match(/^\/api\/queue\/([^/]+)\/approve$/);
  if (req.method === "POST" && approveMatch) {
    const body = await readBody(req);
    return sendJson(res, await approvePublishTask(approveMatch[1], String(body.approved_by || "human")));
  }

  return sendError(res, new Error("Not found"), 404);
}

async function serveStatic(res: ServerResponse, pathname: string) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(publicDir, safePath.replace(/^\/+/, ""));
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const args = parseArgs();
const port = Number(args.port || process.env.PORT || 4310);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${port}`}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);
    return await serveStatic(res, url.pathname);
  } catch (error) {
    return sendError(res, error);
  }
});

server.listen(port, () => {
  console.log(`Reddit Matrix UI running at http://localhost:${port}`);
});
