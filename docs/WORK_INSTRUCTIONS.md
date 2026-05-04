# Reddit Lead Intelligence Matrix 工作说明书

## 1. 项目定位

本项目是一个 Reddit 社区线索情报与浏览器辅助发布系统，用于围绕留学、签证、移民相关话题做公开讨论采集、痛点分析、草稿生成、合规检查、人工审核和发布队列管理。

系统不用于 spam、批量铺帖、自动私信、自动评论、自动投票、验证码绕过、指纹伪装、代理轮换或自动注册 Reddit 账号。

## 2. 核心目标

1. 搜索 Reddit 公开讨论，发现高频问题和真实用户痛点。
2. 分析 lead signal，提取 high / medium / low / none 线索等级。
3. 根据高信号问题生成原创 Reddit 草稿。
4. 对草稿做合规检查，过滤促销、联系方式、重复内容、法律建议风险。
5. 将安全草稿放入人工审核发布队列。
6. 使用浏览器辅助填写 Reddit 发布页面，但最终 Post 必须由人工点击。
7. 监控已发布帖子评论，生成回复草稿和内容选题。
8. 生成每日 Reddit 情报报告，并产出小红书、抖音、YouTube 内容角度。

## 3. 当前模块

### UI 控制台

启动命令：

```bash
npm run ui
```

本地访问：

```text
http://localhost:4310
```

UI 功能：

- 查看账号矩阵状态
- 创建本地账号档案
- 打开账号独立浏览器 profile
- 手动登录或手动注册 Reddit
- 运行 topic pipeline
- 查看内容池
- 查看发布队列
- 批准任务进入 browser_assist_ready

### CLI 流程

```bash
npx tsx scripts/dev-reddit-search.ts --client_id study_immigration --topic study_permit_refusal --limit 30
npx tsx scripts/dev-reddit-analyze-leads.ts --client_id study_immigration
npx tsx scripts/dev-reddit-generate-drafts.ts --client_id study_immigration --topic study_permit_refusal
npx tsx scripts/dev-reddit-run-compliance.ts --client_id study_immigration
npx tsx scripts/dev-reddit-review-queue.ts --client_id study_immigration
npx tsx scripts/dev-reddit-daily-report.ts --client_id study_immigration
```

完整第一阶段 pipeline：

```bash
npm run reddit:pipeline
```

## 4. 账号矩阵说明

账号配置文件：

```text
data/reddit/accounts.json
```

每个账号包含：

- account_id
- username
- role
- status
- browser_profile_path
- daily_post_limit
- weekly_post_limit
- cooldown_hours
- manual_review_required
- auto_click_post

安全默认值：

```json
{
  "manual_review_required": true,
  "auto_click_post": false
}
```

账号矩阵是“合规多账号档案 + 独立浏览器 profile + 独立发布队列”，不是多账号自动轮换刷帖。

## 5. Reddit 运营流程

1. 在 UI 或 JSON 配置中确认 subreddit 和 topic。
2. 运行 topic pipeline。
3. 查看 high-signal lead 和生成的草稿。
4. 运行合规检查。
5. 检查 `ready_for_review` 草稿。
6. 在 UI 中批准一条发布任务。
7. 运行浏览器辅助发布脚本：

```bash
npx tsx scripts/dev-reddit-browser-assist-publish.ts --task_id <task_id>
```

8. 浏览器打开 Reddit 发布页。
9. 系统填写 title 和 body。
10. 人工检查 subreddit、标题、正文、风险提示。
11. 人工点击 Post。
12. 发布后把 Reddit URL 粘回终端。
13. 系统写入 `data/reddit/publish-records.json`。
14. 后续运行评论监控和日报。

## 6. 合规原则

禁止：

- 自动注册 Reddit 账号
- CAPTCHA bypass
- 指纹伪装
- 代理轮换
- 自动 DM
- 自动评论
- 自动投票
- 多账号自动轮换发帖
- 重复跨 subreddit 发布高度相似内容
- 引导用户加微信、WhatsApp、电话、邮箱
- “Guaranteed approval” 等保证性表达

必须：

- 人工审核草稿
- 人工点击最终 Post
- 使用 soft disclaimer
- 遵守 subreddit 规则
- 控制发布频率
- 保持社区帮助语气

## 7. 主要数据文件

```text
data/reddit/raw-search-results.json
data/reddit/analyzed-leads.json
data/reddit/content-pool.json
data/reddit/compliance-results.json
data/reddit/publish-queue.json
data/reddit/publish-records.json
data/reddit/comment-monitor.json
data/reddit/daily-report.md
```

## 8. 日常检查

每天运营前：

1. 打开 UI。
2. 查看账号是否 active。
3. 确认 pending_review 和 browser_assist_ready 队列。
4. 查看最新 daily report。
5. 检查是否有 compliance_failed 内容需要重写。

每天运营后：

1. 保存发布 URL。
2. 运行评论监控。
3. 更新日报。
4. 将高信号评论转为 FAQ / 小红书 / 抖音 / YouTube 选题。

## 9. 技术验证

每次改代码后运行：

```bash
npm run typecheck
```

如果 UI 不能访问，重新启动：

```bash
npm run ui
```

