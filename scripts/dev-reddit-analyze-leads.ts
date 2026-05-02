import { analyzeRedditLeads } from "../server/reddit/redditLeadAnalyzer.js";
import { parseArgs } from "../server/reddit/redditConfigLoader.js";

parseArgs();
const rows = await analyzeRedditLeads();
const high = rows.filter((row) => row.lead_signal === "high").length;
const medium = rows.filter((row) => row.lead_signal === "medium").length;
console.log(`Analyzed ${rows.length} Reddit items. High: ${high}, medium: ${medium}.`);
