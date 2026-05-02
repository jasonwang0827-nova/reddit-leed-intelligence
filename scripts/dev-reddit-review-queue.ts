import { approvePublishTask, buildPublishQueue } from "../server/reddit/redditPublishQueue.js";
import { parseArgs } from "../server/reddit/redditConfigLoader.js";

const args = parseArgs();
const clientId = args.client_id ?? "study_immigration";
if (args.approve_task) {
  const task = await approvePublishTask(args.approve_task, args.approved_by ?? "human");
  console.log(`Approved ${task.task_id}. Status: ${task.status}, auto_click_post=${task.auto_click_post}`);
  process.exit(0);
}

const tasks = await buildPublishQueue(clientId);
console.log(`Added/updated ${tasks.length} publish queue task(s).`);
for (const task of tasks) {
  console.log(`- ${task.task_id}: ${task.content_id}, ${task.status}, auto_click_post=${task.auto_click_post}`);
}
