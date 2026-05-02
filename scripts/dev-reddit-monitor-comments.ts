import { monitorRedditComments } from "../server/reddit/redditCommentMonitor.js";
import { parseArgs } from "../server/reddit/redditConfigLoader.js";

parseArgs();
const rows = await monitorRedditComments();
const comments = rows.reduce((total, row) => total + row.comments.length, 0);
console.log(`Checked ${rows.length} published post(s), extracted ${comments} comment signal(s).`);
