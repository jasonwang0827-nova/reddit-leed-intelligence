# Reddit Community Intelligence & Browser-Assisted Publishing Matrix v0.1

This module treats Reddit as lead intelligence and community drafting infrastructure, not as a spam or mass-promotion system.

The v0.1 flow is:

1. Search public Reddit posts by configured topic.
2. Analyze lead signals and user problems.
3. Generate original Reddit post drafts.
4. Run compliance checks.
5. Move safe drafts into a manual review publishing queue.
6. Optionally open a browser-assisted publisher that fills the post form and stops before the final Post click.

## Safety Defaults

- `auto_click_post` is `false`.
- Auto-DM, auto-comment, auto-vote, account creation, CAPTCHA bypass, proxy rotation, and fingerprint spoofing are not implemented.
- Browser publishing requires a human to review and manually click Post.
- Reply monitoring generates reply drafts only.

## Commands

```bash
npm install
npm run typecheck
npm run ui
```

Open the local control console:

```text
http://localhost:4310
```

The UI can create local account profiles, open each account's persistent Reddit browser profile for manual login or manual signup, run topic pipelines, inspect content and queues, and approve tasks for browser-assisted publishing.

```bash
npx tsx scripts/dev-reddit-search.ts --client_id study_immigration --topic study_permit_refusal --limit 30
npx tsx scripts/dev-reddit-analyze-leads.ts --client_id study_immigration
npx tsx scripts/dev-reddit-generate-drafts.ts --client_id study_immigration --topic study_permit_refusal
npx tsx scripts/dev-reddit-run-compliance.ts --client_id study_immigration
npx tsx scripts/dev-reddit-review-queue.ts --client_id study_immigration
npx tsx scripts/dev-reddit-daily-report.ts --client_id study_immigration
```

Or run the first-stage pipeline:

```bash
npm run reddit:pipeline
```

Browser-assisted publishing:

```bash
npx tsx scripts/dev-reddit-review-queue.ts \
  --approve_task reddit_publish_20260502_reddit_post_20260502_proof_of_funds_001 \
  --approved_by jason

npx tsx scripts/dev-reddit-browser-assist-publish.ts \
  --task_id reddit_publish_20260502_reddit_post_20260502_proof_of_funds_001
```

The browser publisher only accepts tasks with `status: "browser_assist_ready"`. It opens Reddit in the configured persistent profile, waits if login is needed, fills the title and body using multiple Reddit composer selectors, prints a final warning, and stops before the final Post click.

## Operating Loop

1. Add or tune `data/reddit/subreddits.json`.
2. Add or tune `data/reddit/keyword-topics.json`.
3. Run search for one topic at a time.
4. Analyze leads and generate drafts.
5. Run compliance and build the review queue.
6. Approve one task manually.
7. Use browser assist to fill Reddit.
8. Review in browser and manually click Post.
9. Paste the published URL into the terminal prompt.
10. Run comment monitoring and daily report generation.

## Operations Docs

- `docs/WORK_INSTRUCTIONS.md`: 工作说明书
- `docs/OPENCLAW_SOP.md`: OpenClaw 执行 SOP

## Main Data Files

- `data/reddit/raw-search-results.json`
- `data/reddit/analyzed-leads.json`
- `data/reddit/content-pool.json`
- `data/reddit/compliance-results.json`
- `data/reddit/publish-queue.json`
- `data/reddit/publish-records.json`
- `data/reddit/comment-monitor.json`
- `data/reddit/daily-report.md`
