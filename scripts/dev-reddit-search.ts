import { collectRedditTopic } from "../server/reddit/redditCollector.js";
import { loadMatrixConfig, parseArgs } from "../server/reddit/redditConfigLoader.js";

const args = parseArgs();
const config = await loadMatrixConfig();
const topicId = args.topic;
if (!topicId) throw new Error("Missing --topic");
const limit = Number(args.limit ?? config.reddit_search.default_limit);
const rows = await collectRedditTopic(topicId, limit);
console.log(`Collected ${rows.length} Reddit posts for topic ${topicId}.`);
