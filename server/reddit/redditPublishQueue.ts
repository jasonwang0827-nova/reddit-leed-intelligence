import {
  loadAccounts,
  loadContentPool,
  loadMatrixConfig,
  loadPublishQueue,
  nowIso,
  saveContentPool,
  savePublishQueue,
  upsertBy
} from "./redditConfigLoader.js";
import type { PublishTask } from "./redditTypes.js";

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function safeIdSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 70);
}

export async function buildPublishQueue(clientId: string): Promise<PublishTask[]> {
  const [pool, queue, accounts, matrixConfig] = await Promise.all([
    loadContentPool(),
    loadPublishQueue(),
    loadAccounts(),
    loadMatrixConfig()
  ]);
  const account = accounts.find((item) => item.status === "active");
  if (!account) throw new Error("No active Reddit account configured.");

  const eligible = pool.filter((item) => item.client_id === clientId && item.status === "ready_for_review" && item.risk_score !== null);
  const tasks = eligible.map((content, index): PublishTask => ({
    task_id: `reddit_publish_${dateStamp()}_${safeIdSegment(content.content_id)}`,
    content_id: content.content_id,
    account_id: account.account_id,
    target_subreddit: content.target_subreddit,
    publish_mode: matrixConfig.publishing.default_publish_mode,
    scheduled_time: null,
    status: "pending_review",
    requires_manual_approval: true,
    auto_click_post: false,
    approval: {
      approved_by: null,
      approved_at: null
    },
    cooldown_checked: false,
    compliance_checked: true,
    risk_score: content.risk_score ?? 1,
    publish_attempts: 0,
    last_error: null
  }));

  const eligibleIds = new Set(eligible.map((content) => content.content_id));
  const prunedQueue = queue.filter((task) => task.status === "published" || eligibleIds.has(task.content_id));
  const mergedQueue = upsertBy(prunedQueue, tasks, (row) => row.content_id);
  const queuedIds = new Set(tasks.map((task) => task.content_id));
  const updatedPool = pool.map((item) => queuedIds.has(item.content_id) ? { ...item, publish_status: "queued" as const, updated_at: nowIso() } : item);
  await Promise.all([savePublishQueue(mergedQueue), saveContentPool(updatedPool)]);
  return tasks;
}

export async function approvePublishTask(taskId: string, approvedBy = "human"): Promise<PublishTask> {
  const [queue, pool] = await Promise.all([loadPublishQueue(), loadContentPool()]);
  const task = queue.find((item) => item.task_id === taskId);
  if (!task) throw new Error(`Publish task not found: ${taskId}`);
  if (!task.compliance_checked) throw new Error(`Task has not passed compliance check: ${taskId}`);
  if (task.auto_click_post) throw new Error("auto_click_post must remain false for v0.1.");

  const approvedTask: PublishTask = {
    ...task,
    status: "browser_assist_ready",
    approval: {
      approved_by: approvedBy,
      approved_at: nowIso()
    }
  };

  await Promise.all([
    savePublishQueue(queue.map((item) => item.task_id === taskId ? approvedTask : item)),
    saveContentPool(pool.map((item) => item.content_id === task.content_id ? {
      ...item,
      status: "browser_assist_ready" as const,
      updated_at: nowIso()
    } : item))
  ]);

  return approvedTask;
}
