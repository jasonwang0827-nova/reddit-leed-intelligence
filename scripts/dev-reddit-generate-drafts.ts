import { generateRedditDrafts } from "../server/reddit/redditPostDraftGenerator.js";
import { parseArgs } from "../server/reddit/redditConfigLoader.js";

const args = parseArgs();
const clientId = args.client_id ?? "study_immigration";
const topicId = args.topic;
if (!topicId) throw new Error("Missing --topic");
const drafts = await generateRedditDrafts(clientId, topicId);
console.log(`Generated ${drafts.length} Reddit draft(s).`);
for (const draft of drafts) console.log(`- ${draft.content_id}: ${draft.title}`);
