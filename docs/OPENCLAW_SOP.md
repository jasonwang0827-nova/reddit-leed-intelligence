# OpenClaw 执行 SOP：Reddit Lead Intelligence Matrix

## 1. 执行身份

OpenClaw 在本项目中的角色是运营执行助手，负责按照既定流程进行 Reddit 公开讨论采集、线索分析、草稿生成、合规检查、队列整理、日报生成和浏览器辅助操作。

OpenClaw 不得执行任何绕过平台规则、规避检测或自动化 spam 的操作。

## 2. 项目路径

```text
/Users/jason/Nova/reddit leed intelligence
```

进入项目：

```bash
cd "/Users/jason/Nova/reddit leed intelligence"
```

## 3. 启动 UI

```bash
npm run ui
```

访问：

```text
http://localhost:4310
```

如果端口被占用，可以使用：

```bash
npm run ui -- --port 4311
```

## 4. 每次执行前检查

```bash
git status --short
npm run typecheck
```

确认：

- 没有未知错误
- UI 能打开
- `data/reddit/accounts.json` 中账号状态正确
- 不存在 `auto_click_post: true`

## 5. 账号操作 SOP

### 创建账号档案

可在 UI 的“账号矩阵”页面创建账号档案。

注意：这里创建的是系统档案和浏览器 profile，不是自动注册 Reddit 账号。

必须保持：

```json
{
  "manual_review_required": true,
  "auto_click_post": false
}
```

### 登录或注册 Reddit

1. 在 UI 中点击“打开登录窗口”。
2. 在浏览器中手动登录或手动注册 Reddit。
3. 如遇 CAPTCHA，必须由真人手动处理。
4. 不得使用任何 CAPTCHA bypass、自动注册、代理轮换、指纹伪装。

## 6. 采集与生产 SOP

### 推荐 UI 方式

1. 打开 UI。
2. 进入“采集生产”。
3. 选择 topic。
4. 设置 limit，建议 20-50。
5. 点击运行 Pipeline。
6. 等待结果完成。

### CLI 方式

```bash
npx tsx scripts/dev-reddit-search.ts --client_id study_immigration --topic <topic_id> --limit 30
npx tsx scripts/dev-reddit-analyze-leads.ts --client_id study_immigration
npx tsx scripts/dev-reddit-generate-drafts.ts --client_id study_immigration --topic <topic_id>
npx tsx scripts/dev-reddit-run-compliance.ts --client_id study_immigration
npx tsx scripts/dev-reddit-review-queue.ts --client_id study_immigration
npx tsx scripts/dev-reddit-daily-report.ts --client_id study_immigration
```

常用 topic：

```text
study_permit_refusal
pgwp_risk
older_student_risk
proof_of_funds
school_program_choice
family_application_risk
post_refusal_reapply
```

## 7. 合规审核 SOP

发布前必须检查：

- 是否 direct sales pitch
- 是否包含微信、WhatsApp、电话、邮箱
- 是否出现 “DM me”、“book a consultation”、“free assessment”
- 是否保证签证成功
- 是否像 AI 批量生成
- 是否和近期内容高度相似
- 是否违反 subreddit 规则
- 是否包含 soft disclaimer

只允许通过：

```text
ready_for_review
```

禁止发布：

```text
compliance_failed
rejected
archived
```

## 8. 发布 SOP

### 批准任务

在 UI 发布队列中点击批准，或使用 CLI：

```bash
npx tsx scripts/dev-reddit-review-queue.ts --approve_task <task_id> --approved_by jason
```

批准后任务状态应为：

```text
browser_assist_ready
```

### 浏览器辅助发布

```bash
npx tsx scripts/dev-reddit-browser-assist-publish.ts --task_id <task_id>
```

执行时：

1. 系统打开 Reddit submit 页面。
2. 如果未登录，真人手动登录。
3. 系统填写 title 和 body。
4. 系统打印最终风险提示。
5. OpenClaw 必须停止在最终 Post 前。
6. 最终 Post 只能由真人点击。
7. 发布后，把 Reddit URL 粘回终端。

禁止：

- 自动点击 Post
- 自动重试强发
- 自动切换账号继续发
- 自动评论或私信

## 9. 评论监控 SOP

```bash
npx tsx scripts/dev-reddit-monitor-comments.ts --client_id study_immigration
npx tsx scripts/dev-reddit-daily-report.ts --client_id study_immigration
```

评论监控只生成回复草稿，不得自动回复。

需要提取：

- 新问题
- 反对意见
- 高信号 lead
- FAQ 选题
- 小红书 / 抖音 / YouTube 角度

## 10. 日报 SOP

日报位置：

```text
data/reddit/daily-report.md
```

每日必须包含：

- High-Signal Reddit Problems
- Recommended Reddit Drafts
- Publishing Queue
- Comment Feedback
- Xiaohongshu / Douyin Content Angles

## 11. Git SOP

查看状态：

```bash
git status --short
```

提交：

```bash
git add .
git commit -m "Update Reddit matrix operations"
git push
```

GitHub 仓库：

```text
https://github.com/jasonwang0827-nova/reddit-leed-intelligence
```

## 12. 异常处理

### UI 打不开

```bash
npm run ui
```

确认端口：

```bash
curl -I http://localhost:4310
```

### Reddit 搜索结果少

1. 换 topic。
2. 调高 limit。
3. 修改 `data/reddit/keyword-topics.json` 中 keywords。
4. 检查 subreddit 是否过窄。

### 草稿大量 compliance_failed

1. 检查是否与已有草稿相似。
2. 改写标题和结构。
3. 去除 CTA、联系方式和营销表达。
4. 保留 soft disclaimer。

### 发布器找不到表单

1. 确认是否已登录。
2. 确认 Reddit 页面是否打开到 submit。
3. 如果新版 UI 变更，人工复制 title/body。
4. 不得用脚本强行点击 Post。

## 13. OpenClaw 最重要的边界

OpenClaw 可以辅助运营，但不能替代真人做 Reddit 最终发布判断。

任何时候都必须遵守：

```text
Human review required.
Human final Post click required.
No spam automation.
No account automation.
No CAPTCHA bypass.
```

