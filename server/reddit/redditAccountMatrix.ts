import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type BrowserContext } from "@playwright/test";
import {
  loadAccounts,
  loadPublishQueue,
  loadPublishRecords,
  nowIso,
  paths,
  writeJson
} from "./redditConfigLoader.js";
import type { RedditAccount } from "./redditTypes.js";

const openContexts = new Map<string, BrowserContext>();

export interface AccountMatrixStatus extends RedditAccount {
  profile_exists: boolean;
  queued_tasks: number;
  ready_tasks: number;
  published_count: number;
  last_published_at: string | null;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeAccountId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
}

export async function getAccountMatrixStatus(): Promise<AccountMatrixStatus[]> {
  const [accounts, queue, records] = await Promise.all([loadAccounts(), loadPublishQueue(), loadPublishRecords()]);
  return Promise.all(accounts.map(async (account) => {
    const accountRecords = records.filter((record) => record.account_id === account.account_id);
    const lastRecord = accountRecords.sort((left, right) => right.published_at.localeCompare(left.published_at))[0];
    return {
      ...account,
      profile_exists: await pathExists(join(paths.root, account.browser_profile_path)),
      queued_tasks: queue.filter((task) => task.account_id === account.account_id && task.status === "pending_review").length,
      ready_tasks: queue.filter((task) => task.account_id === account.account_id && task.status === "browser_assist_ready").length,
      published_count: accountRecords.length,
      last_published_at: lastRecord?.published_at ?? null
    };
  }));
}

export async function createAccountProfile(input: Partial<RedditAccount> & { account_id?: string }): Promise<RedditAccount> {
  const accounts = await loadAccounts();
  const accountId = normalizeAccountId(input.account_id || input.username || `reddit_account_${accounts.length + 1}`);
  if (!accountId) throw new Error("account_id or username is required.");
  if (accounts.some((account) => account.account_id === accountId)) {
    throw new Error(`Account already exists: ${accountId}`);
  }
  const account: RedditAccount = {
    account_id: accountId,
    username: input.username || "UNSET_REDDIT_USERNAME",
    role: input.role || "matrix_account",
    status: input.status || "paused",
    browser_profile_path: input.browser_profile_path || `data/reddit/browser-profiles/${accountId}`,
    allowed_actions: input.allowed_actions || ["search", "draft", "browser_assist_publish", "comment_monitor"],
    forbidden_actions: input.forbidden_actions || [
      "auto_dm",
      "auto_vote",
      "mass_post",
      "captcha_bypass",
      "fingerprint_evasion",
      "automatic_account_creation"
    ],
    daily_post_limit: input.daily_post_limit ?? 1,
    weekly_post_limit: input.weekly_post_limit ?? 2,
    cooldown_hours: input.cooldown_hours ?? 48,
    manual_review_required: true,
    auto_click_post: false
  };
  await mkdir(join(paths.root, account.browser_profile_path), { recursive: true });
  await writeJson(paths.accounts, [...accounts, account]);
  return account;
}

export async function updateAccountProfile(accountId: string, patch: Partial<RedditAccount>): Promise<RedditAccount> {
  const accounts = await loadAccounts();
  const existing = accounts.find((account) => account.account_id === accountId);
  if (!existing) throw new Error(`Account not found: ${accountId}`);
  const updated: RedditAccount = {
    ...existing,
    ...patch,
    account_id: existing.account_id,
    manual_review_required: true,
    auto_click_post: false,
    forbidden_actions: [...new Set([...(patch.forbidden_actions ?? existing.forbidden_actions), "captcha_bypass", "fingerprint_evasion", "automatic_account_creation"])]
  };
  await writeJson(paths.accounts, accounts.map((account) => account.account_id === accountId ? updated : account));
  return updated;
}

export async function openAccountLogin(accountId: string): Promise<{ account_id: string; opened_at: string }> {
  const accounts = await loadAccounts();
  const account = accounts.find((item) => item.account_id === accountId);
  if (!account) throw new Error(`Account not found: ${accountId}`);
  const profilePath = join(paths.root, account.browser_profile_path);
  await mkdir(profilePath, { recursive: true });
  const existing = openContexts.get(accountId);
  if (existing) {
    const page = existing.pages()[0] ?? await existing.newPage();
    await page.goto("https://www.reddit.com/login/", { waitUntil: "domcontentloaded" });
    return { account_id: accountId, opened_at: nowIso() };
  }
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1280, height: 900 }
  });
  openContexts.set(accountId, context);
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("https://www.reddit.com/login/", { waitUntil: "domcontentloaded" });
  return { account_id: accountId, opened_at: nowIso() };
}
