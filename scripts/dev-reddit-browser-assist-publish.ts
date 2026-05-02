import { browserAssistPublish } from "../server/reddit/redditBrowserPublisher.js";
import { parseArgs } from "../server/reddit/redditConfigLoader.js";

const args = parseArgs();
const taskId = args.task_id;
if (!taskId) throw new Error("Missing --task_id");
await browserAssistPublish(taskId);
