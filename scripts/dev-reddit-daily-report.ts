import { generateDailyReport } from "../server/reddit/redditReportGenerator.js";
import { parseArgs, paths } from "../server/reddit/redditConfigLoader.js";

const args = parseArgs();
const clientId = args.client_id ?? "study_immigration";
await generateDailyReport(clientId);
console.log(`Daily report written to ${paths.dailyReport}`);
