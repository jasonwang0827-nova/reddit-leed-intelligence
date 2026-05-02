import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnalyzedLead,
  ClientConfig,
  CommentMonitorRecord,
  ComplianceResult,
  KeywordTopic,
  MatrixConfig,
  PublishRecord,
  PublishTask,
  RawRedditResult,
  RedditAccount,
  RedditContent,
  SubredditConfig
} from "./redditTypes.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const paths = {
  root: projectRoot,
  matrixConfig: join(projectRoot, "config/reddit-matrix.config.json"),
  client: (clientId: string) => join(projectRoot, `data/clients/${clientId}.json`),
  accounts: join(projectRoot, "data/reddit/accounts.json"),
  subreddits: join(projectRoot, "data/reddit/subreddits.json"),
  topics: join(projectRoot, "data/reddit/keyword-topics.json"),
  rawResults: join(projectRoot, "data/reddit/raw-search-results.json"),
  analyzedLeads: join(projectRoot, "data/reddit/analyzed-leads.json"),
  contentPool: join(projectRoot, "data/reddit/content-pool.json"),
  complianceResults: join(projectRoot, "data/reddit/compliance-results.json"),
  publishQueue: join(projectRoot, "data/reddit/publish-queue.json"),
  publishRecords: join(projectRoot, "data/reddit/publish-records.json"),
  commentMonitor: join(projectRoot, "data/reddit/comment-monitor.json"),
  dailyReport: join(projectRoot, "data/reddit/daily-report.md")
};

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

export function parseArgs(argv = process.argv.slice(2)): Record<string, string> {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? next : "true";
  }
  return args;
}

export const nowIso = () => new Date().toISOString();

export async function loadMatrixConfig(): Promise<MatrixConfig> {
  return readJson<MatrixConfig>(paths.matrixConfig, {
    client_id: "study_immigration",
    reddit_search: {
      sort: "new",
      time: "year",
      default_limit: 30,
      user_agent: "reddit-community-intelligence-v0.1"
    },
    compliance: {
      max_risk_score_for_review: 0.55,
      max_similarity_to_recent_posts: 0.72,
      require_manual_review: true,
      allow_approved_auto_publish: false
    },
    publishing: {
      default_publish_mode: "browser_assist",
      auto_click_post: false,
      require_human_final_click: true
    }
  });
}

export const loadClient = (clientId: string) => readJson<ClientConfig>(paths.client(clientId), {} as ClientConfig);
export const loadAccounts = () => readJson<RedditAccount[]>(paths.accounts, []);
export const loadSubreddits = () => readJson<SubredditConfig[]>(paths.subreddits, []);
export const loadTopics = () => readJson<KeywordTopic[]>(paths.topics, []);
export const loadRawResults = () => readJson<RawRedditResult[]>(paths.rawResults, []);
export const saveRawResults = (rows: RawRedditResult[]) => writeJson(paths.rawResults, rows);
export const loadAnalyzedLeads = () => readJson<AnalyzedLead[]>(paths.analyzedLeads, []);
export const saveAnalyzedLeads = (rows: AnalyzedLead[]) => writeJson(paths.analyzedLeads, rows);
export const loadContentPool = () => readJson<RedditContent[]>(paths.contentPool, []);
export const saveContentPool = (rows: RedditContent[]) => writeJson(paths.contentPool, rows);
export const loadComplianceResults = () => readJson<ComplianceResult[]>(paths.complianceResults, []);
export const saveComplianceResults = (rows: ComplianceResult[]) => writeJson(paths.complianceResults, rows);
export const loadPublishQueue = () => readJson<PublishTask[]>(paths.publishQueue, []);
export const savePublishQueue = (rows: PublishTask[]) => writeJson(paths.publishQueue, rows);
export const loadPublishRecords = () => readJson<PublishRecord[]>(paths.publishRecords, []);
export const savePublishRecords = (rows: PublishRecord[]) => writeJson(paths.publishRecords, rows);
export const loadCommentMonitor = () => readJson<CommentMonitorRecord[]>(paths.commentMonitor, []);
export const saveCommentMonitor = (rows: CommentMonitorRecord[]) => writeJson(paths.commentMonitor, rows);

export function upsertBy<T>(rows: T[], nextRows: T[], getKey: (row: T) => string): T[] {
  const map = new Map(rows.map((row) => [getKey(row), row]));
  for (const row of nextRows) map.set(getKey(row), row);
  return [...map.values()];
}
