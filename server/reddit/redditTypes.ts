export type LeadSignal = "high" | "medium" | "low" | "none";
export type ContentStatus =
  | "draft"
  | "compliance_failed"
  | "ready_for_review"
  | "approved"
  | "scheduled"
  | "browser_assist_ready"
  | "published"
  | "rejected"
  | "archived";

export type ComplianceDecision = "compliance_failed" | "ready_for_review" | "rejected";
export type PublishMode = "draft_only" | "browser_assist" | "approved_auto_publish";

export interface ClientConfig {
  client_id: string;
  client_name: string;
  business_type: string;
  target_audience: string[];
  primary_goals: string[];
  forbidden_actions: string[];
}

export interface RedditAccount {
  account_id: string;
  username: string;
  role: string;
  status: "active" | "paused" | "disabled";
  browser_profile_path: string;
  allowed_actions: string[];
  forbidden_actions: string[];
  daily_post_limit: number;
  weekly_post_limit: number;
  cooldown_hours: number;
  manual_review_required: boolean;
  auto_click_post: boolean;
}

export interface SubredditConfig {
  subreddit: string;
  topic_fit: "high" | "medium" | "low";
  language: string;
  allow_self_promotion: boolean;
  allow_links: "yes" | "limited" | "no";
  allow_consultant_posts: boolean;
  posting_style: string;
  risk_level: "low" | "medium" | "high";
  rules_summary: string[];
  recommended_content_types: ContentType[];
  blocked_content_types: string[];
  daily_post_limit: number;
  weekly_post_limit: number;
  cooldown_hours: number;
}

export type ContentType =
  | "faq_post"
  | "discussion_post"
  | "checklist_post"
  | "case_pattern_post"
  | "misconception_post"
  | "comment_response_post";

export interface KeywordTopic {
  topic_id: string;
  topic_name: string;
  keywords: string[];
  lead_signal_rules: Record<"high" | "medium" | "low", string[]>;
}

export interface MatrixConfig {
  client_id: string;
  reddit_search: {
    sort: "relevance" | "hot" | "top" | "new" | "comments";
    time: "hour" | "day" | "week" | "month" | "year" | "all";
    default_limit: number;
    user_agent: string;
  };
  compliance: {
    max_risk_score_for_review: number;
    max_similarity_to_recent_posts: number;
    require_manual_review: boolean;
    allow_approved_auto_publish: boolean;
  };
  publishing: {
    default_publish_mode: PublishMode;
    auto_click_post: boolean;
    require_human_final_click: boolean;
  };
}

export interface RawRedditResult {
  reddit_id: string;
  source_type: "post" | "comment";
  subreddit: string;
  topic_id: string;
  title: string;
  text: string;
  url: string;
  created_at: string;
  score: number;
  comments_count: number;
  collected_at: string;
}

export interface AnalyzedLead {
  reddit_id: string;
  topic_id: string;
  subreddit: string;
  url: string;
  title: string;
  user_problem: string;
  case_context: {
    age: number | null;
    country: string | null;
    application_stage: string | null;
    main_concern: string | null;
    budget_issue: boolean;
    school_or_program: string | null;
  };
  pain_points: string[];
  urgency: "high" | "medium" | "low";
  lead_signal: LeadSignal;
  content_angle: string;
  analyzed_at: string;
}

export interface RedditContent {
  content_id: string;
  client_id: string;
  source_type: "reddit_intelligence";
  topic_id: string;
  target_subreddit: string;
  content_type: ContentType;
  title: string;
  body: string;
  language: "en" | "zh";
  status: ContentStatus;
  risk_score: number | null;
  lead_angle: string;
  review_status: "pending" | "approved" | "rejected";
  publish_status: "not_published" | "queued" | "published";
  published_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceResult {
  content_id: string;
  checks: {
    duplicate_content: boolean;
    too_promotional: boolean;
    contains_contact_info: boolean;
    contains_wechat: boolean;
    contains_phone_number: boolean;
    contains_email: boolean;
    contains_direct_sales_cta: boolean;
    subreddit_rule_conflict: boolean;
    legal_advice_risk: "low" | "medium" | "high";
    ai_generated_tone_risk: "low" | "medium" | "high";
    cross_subreddit_duplicate_risk: boolean;
    similarity_to_recent_posts: number;
    posting_frequency_risk: "low" | "medium" | "high";
  };
  risk_score: number;
  decision: ComplianceDecision;
  notes: string[];
  checked_at: string;
}

export interface PublishTask {
  task_id: string;
  content_id: string;
  account_id: string;
  target_subreddit: string;
  publish_mode: PublishMode;
  scheduled_time: string | null;
  status: "pending_review" | "browser_assist_ready" | "published" | "failed" | "rejected";
  requires_manual_approval: boolean;
  auto_click_post: boolean;
  approval: {
    approved_by: string | null;
    approved_at: string | null;
  };
  cooldown_checked: boolean;
  compliance_checked: boolean;
  risk_score: number;
  publish_attempts: number;
  last_error: string | null;
}

export interface PublishRecord {
  task_id: string;
  content_id: string;
  account_id: string;
  subreddit: string;
  title: string;
  published_url: string;
  publish_mode: PublishMode;
  published_by: "human";
  published_at: string;
  status: "published";
}

export interface MonitoredComment {
  comment_id: string;
  text: string;
  lead_signal: LeadSignal;
  user_problem: string;
  recommended_reply_draft: string;
}

export interface CommentMonitorRecord {
  published_url: string;
  content_id: string;
  comments_checked_at: string;
  comments: MonitoredComment[];
}
