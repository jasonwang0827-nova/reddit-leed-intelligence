import { runComplianceForDrafts } from "../server/reddit/redditComplianceGuard.js";
import { parseArgs } from "../server/reddit/redditConfigLoader.js";

const args = parseArgs();
const clientId = args.client_id ?? "study_immigration";
const results = await runComplianceForDrafts(clientId);
console.log(`Checked ${results.length} draft(s).`);
for (const result of results) {
  console.log(`- ${result.content_id}: ${result.decision}, risk=${result.risk_score}`);
}
