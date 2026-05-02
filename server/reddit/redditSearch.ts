import { loadMatrixConfig, loadSubreddits, loadTopics, nowIso, upsertBy, loadRawResults, saveRawResults } from "./redditConfigLoader.js";
import type { KeywordTopic, RawRedditResult } from "./redditTypes.js";

interface RedditListingChild {
  data: {
    id: string;
    name?: string;
    subreddit: string;
    title?: string;
    selftext?: string;
    permalink?: string;
    created_utc?: number;
    score?: number;
    num_comments?: number;
  };
}

interface RedditListingResponse {
  data?: {
    children?: RedditListingChild[];
  };
}

export async function searchRedditTopic(topicId: string, limit: number): Promise<RawRedditResult[]> {
  const [matrixConfig, topics, subreddits] = await Promise.all([loadMatrixConfig(), loadTopics(), loadSubreddits()]);
  const topic = topics.find((item) => item.topic_id === topicId);
  if (!topic) throw new Error(`Unknown topic_id: ${topicId}`);

  const keywords = topic.keywords.slice(0, 6);
  const perQueryLimit = Math.max(3, Math.ceil(limit / Math.max(1, subreddits.length)));
  const collected: RawRedditResult[] = [];

  for (const subreddit of subreddits) {
    for (const keyword of keywords) {
      const params = new URLSearchParams({
        q: keyword,
        restrict_sr: "true",
        sort: matrixConfig.reddit_search.sort,
        t: matrixConfig.reddit_search.time,
        limit: String(perQueryLimit),
        raw_json: "1"
      });
      const url = `https://www.reddit.com/r/${subreddit.subreddit}/search.json?${params.toString()}`;
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            "user-agent": matrixConfig.reddit_search.user_agent,
            accept: "application/json"
          }
        });
      } catch (error) {
        console.warn(`Skipping r/${subreddit.subreddit} keyword "${keyword}": ${(error as Error).message}`);
        continue;
      }
      if (!response.ok) {
        console.warn(`Skipping r/${subreddit.subreddit} keyword "${keyword}": Reddit search failed ${response.status}`);
        continue;
      }
      const payload = (await response.json()) as RedditListingResponse;
      const rows = (payload.data?.children ?? []).map((child): RawRedditResult => {
        const data = child.data;
        const permalink = data.permalink ? `https://www.reddit.com${data.permalink}` : `https://www.reddit.com/${data.name ?? data.id}`;
        return {
          reddit_id: data.id,
          source_type: "post",
          subreddit: data.subreddit,
          topic_id: topic.topic_id,
          title: data.title ?? "",
          text: data.selftext ?? "",
          url: permalink,
          created_at: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : nowIso(),
          score: data.score ?? 0,
          comments_count: data.num_comments ?? 0,
          collected_at: nowIso()
        };
      });
      collected.push(...rows);
      if (upsertBy([], collected, (row) => row.reddit_id).length >= limit) break;
    }
    if (upsertBy([], collected, (row) => row.reddit_id).length >= limit) break;
  }

  return upsertBy([], collected, (row) => row.reddit_id).slice(0, limit);
}

export async function collectRedditTopic(topicId: string, limit: number): Promise<RawRedditResult[]> {
  const [existing, fresh] = await Promise.all([loadRawResults(), searchRedditTopic(topicId, limit)]);
  const merged = upsertBy(existing, fresh, (row) => row.reddit_id);
  await saveRawResults(merged);
  return fresh;
}
