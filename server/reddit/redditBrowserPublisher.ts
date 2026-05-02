import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "@playwright/test";
import {
  loadAccounts,
  loadContentPool,
  loadMatrixConfig,
  loadPublishQueue,
  loadPublishRecords,
  nowIso,
  paths,
  saveContentPool,
  savePublishQueue,
  savePublishRecords
} from "./redditConfigLoader.js";
import type { PublishRecord } from "./redditTypes.js";

async function firstVisibleLocator(page: Page, selectors: string[], timeoutMs = 2500): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "visible", timeout: timeoutMs });
      return locator;
    } catch {
      // Try the next known Reddit composer selector.
    }
  }
  return null;
}

async function waitForComposerOrLogin(page: Page): Promise<void> {
  const title = await firstVisibleLocator(page, titleSelectors, 4000);
  if (title) return;

  console.log("\nReddit composer is not visible yet.");
  console.log("If Reddit is asking you to log in, please finish login in the opened browser window.");
  const rl = createInterface({ input, output });
  await rl.question("Press Enter here after the submit page is ready...\n> ");
  rl.close();
}

const titleSelectors = [
  'textarea[name="title"]',
  'input[name="title"]',
  'textarea[placeholder*="Title" i]',
  'input[placeholder*="Title" i]',
  '[aria-label*="Title" i]',
  '[data-testid*="title" i] textarea',
  '[data-testid*="title" i] input',
  'shreddit-composer [slot="title"] textarea',
  'shreddit-composer [slot="title"] input'
];

const bodySelectors = [
  '.ProseMirror[contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  'textarea[name="text"]',
  'textarea[placeholder*="body" i]',
  'textarea[placeholder*="text" i]',
  '[aria-label*="Body" i]',
  '[aria-label*="Text" i]',
  'shreddit-composer [slot="body"] [contenteditable="true"]'
];

async function fillTitle(page: Page, title: string): Promise<void> {
  const titleInput = await firstVisibleLocator(page, titleSelectors);
  if (!titleInput) {
    throw new Error("Could not find Reddit title field. The browser remains open for manual fill.");
  }
  await titleInput.click();
  await titleInput.fill("").catch(async () => {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.press("Backspace");
  });
  await titleInput.fill(title).catch(async () => {
    await page.keyboard.insertText(title);
  });
}

async function fillBody(page: Page, body: string): Promise<void> {
  const bodyInput = await firstVisibleLocator(page, bodySelectors);
  if (!bodyInput) {
    throw new Error("Could not find Reddit body field. The browser remains open for manual fill.");
  }
  await bodyInput.click();
  await bodyInput.fill("").catch(async () => {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.press("Backspace");
  });
  await bodyInput.fill(body).catch(async () => {
    await page.keyboard.insertText(body);
  });
}

export async function browserAssistPublish(taskId: string): Promise<void> {
  const [queue, pool, accounts, matrixConfig, records] = await Promise.all([
    loadPublishQueue(),
    loadContentPool(),
    loadAccounts(),
    loadMatrixConfig(),
    loadPublishRecords()
  ]);
  const task = queue.find((item) => item.task_id === taskId);
  if (!task) throw new Error(`Publish task not found: ${taskId}`);
  if (task.status !== "browser_assist_ready") {
    throw new Error(`Task must be manually approved before browser assist. Current status: ${task.status}`);
  }
  if (!task.compliance_checked || task.risk_score > matrixConfig.compliance.max_risk_score_for_review) {
    throw new Error("Task failed compliance or risk threshold checks.");
  }
  if (task.auto_click_post || matrixConfig.publishing.auto_click_post) {
    throw new Error("auto_click_post is disabled in v0.1.");
  }
  const content = pool.find((item) => item.content_id === task.content_id);
  if (!content) throw new Error(`Content not found: ${task.content_id}`);
  const account = accounts.find((item) => item.account_id === task.account_id);
  if (!account) throw new Error(`Account not found: ${task.account_id}`);

  const profilePath = join(paths.root, account.browser_profile_path);
  await mkdir(profilePath, { recursive: true });
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1280, height: 900 }
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(`https://www.reddit.com/r/${task.target_subreddit}/submit`, { waitUntil: "domcontentloaded" });

  await waitForComposerOrLogin(page);
  await fillTitle(page, content.title);
  await fillBody(page, content.body);

  console.log("\nOpening Reddit browser-assisted publishing...\n");
  console.log(`Account: ${task.account_id}`);
  console.log(`Subreddit: ${task.target_subreddit}`);
  console.log(`Title: ${content.title}`);
  console.log(`Risk Score: ${task.risk_score}`);
  console.log(`Mode: ${task.publish_mode}`);
  console.log("Auto Click Post: false\n");
  console.log("Manual Approval:");
  console.log(`Approved By: ${task.approval.approved_by ?? "unknown"}`);
  console.log(`Approved At: ${task.approval.approved_at ?? "unknown"}\n`);
  console.log("The post form has been filled.");
  console.log("Please review manually in the browser.");
  console.log("If everything looks good, click Post yourself.\n");

  const rl = createInterface({ input, output });
  const publishedUrl = (await rl.question("After publishing, paste the Reddit URL here (or press Enter to skip):\n> ")).trim();
  rl.close();

  if (publishedUrl) {
    const record: PublishRecord = {
      task_id: task.task_id,
      content_id: content.content_id,
      account_id: task.account_id,
      subreddit: task.target_subreddit,
      title: content.title,
      published_url: publishedUrl,
      publish_mode: "browser_assist",
      published_by: "human",
      published_at: nowIso(),
      status: "published"
    };
    await Promise.all([
      savePublishRecords([...records.filter((item) => item.task_id !== task.task_id), record]),
      savePublishQueue(queue.map((item) => item.task_id === task.task_id ? { ...item, status: "published" as const } : item)),
      saveContentPool(pool.map((item) => item.content_id === content.content_id ? { ...item, status: "published" as const, publish_status: "published" as const, published_url: publishedUrl, updated_at: nowIso() } : item))
    ]);
  }
}
