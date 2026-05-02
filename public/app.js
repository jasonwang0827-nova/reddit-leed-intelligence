const state = {
  data: null,
  activeTab: "overview"
};

const titles = {
  overview: ["总览", "账号、线索、草稿和队列状态"],
  accounts: ["账号矩阵", "创建账号档案、检查 profile 和登录状态"],
  pipeline: ["采集生产", "按 topic 运行 Reddit 线索生产链路"],
  queue: ["发布队列", "人工批准后进入浏览器辅助发布"],
  content: ["内容池", "草稿、合规结果和发布状态"]
};

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("is-visible");
  setTimeout(() => node.classList.remove("is-visible"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Request failed");
  return json;
}

function setTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-visible", view.id === tab));
  $("#viewTitle").textContent = titles[tab][0];
  $("#viewSubtitle").textContent = titles[tab][1];
}

function badge(value) {
  return `<span class="badge ${escapeHtml(value)}">${escapeHtml(value)}</span>`;
}

function renderMetrics(data) {
  $("#metricAccounts").textContent = data.accounts.length;
  $("#metricSubreddits").textContent = data.subreddits.length;
  $("#metricTopics").textContent = data.topics.length;
  $("#metricHighSignals").textContent = data.high_signal_count;
  $("#metricQueue").textContent = data.summary.pending_queue;
  $("#metricReady").textContent = data.summary.browser_assist_ready;
}

function renderAccountStatus(data) {
  $("#accountStatusList").innerHTML = data.accounts.map((account) => `
    <article class="list-row">
      <header>
        <div>
          <h4>${escapeHtml(account.account_id)}</h4>
          <p>${escapeHtml(account.username)} · ${escapeHtml(account.role)}</p>
        </div>
        ${badge(account.status)}
      </header>
      <div class="card-actions">
        <span class="badge">profile ${account.profile_exists ? "ready" : "missing"}</span>
        <span class="badge">queue ${account.queued_tasks}</span>
        <span class="badge">ready ${account.ready_tasks}</span>
        <span class="badge">published ${account.published_count}</span>
      </div>
    </article>
  `).join("");
}

function renderTopics(data) {
  $("#topicList").innerHTML = data.topics.map((topic) => `
    <span class="chip">${escapeHtml(topic.topic_id)}</span>
  `).join("");
  $("#topicSelect").innerHTML = data.topics.map((topic) => `
    <option value="${escapeHtml(topic.topic_id)}">${escapeHtml(topic.topic_name)}</option>
  `).join("");
}

function renderAccounts(data) {
  $("#accountCards").innerHTML = data.accounts.map((account) => `
    <article class="account-card">
      <header>
        <div>
          <h4>${escapeHtml(account.account_id)}</h4>
          <p>${escapeHtml(account.username)}</p>
        </div>
        ${badge(account.status)}
      </header>
      <div class="card-actions">
        <span class="badge">daily ${account.daily_post_limit}</span>
        <span class="badge">weekly ${account.weekly_post_limit}</span>
        <span class="badge">cooldown ${account.cooldown_hours}h</span>
      </div>
      <div class="card-actions">
        <button class="secondary" data-open-login="${escapeHtml(account.account_id)}">打开登录窗口</button>
        <button class="secondary" data-toggle-account="${escapeHtml(account.account_id)}" data-status="${account.status === "active" ? "paused" : "active"}">${account.status === "active" ? "暂停" : "启用"}</button>
      </div>
    </article>
  `).join("");
}

function renderSubreddits(data) {
  $("#subredditTable").innerHTML = `
    <table>
      <thead><tr><th>Subreddit</th><th>Fit</th><th>Risk</th><th>Weekly</th><th>Cooldown</th><th>Style</th></tr></thead>
      <tbody>
        ${data.subreddits.map((item) => `
          <tr>
            <td>r/${escapeHtml(item.subreddit)}</td>
            <td>${badge(item.topic_fit)}</td>
            <td>${badge(item.risk_level)}</td>
            <td>${escapeHtml(item.weekly_post_limit)}</td>
            <td>${escapeHtml(item.cooldown_hours)}h</td>
            <td>${escapeHtml(item.posting_style)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderQueue(data) {
  $("#queueTable").innerHTML = `
    <table>
      <thead><tr><th>Task</th><th>Account</th><th>Subreddit</th><th>Status</th><th>Risk</th><th>Action</th></tr></thead>
      <tbody>
        ${data.queue.map((task) => `
          <tr>
            <td class="title-cell">${escapeHtml(task.task_id)}<br><span class="badge">${escapeHtml(task.content_id)}</span></td>
            <td>${escapeHtml(task.account_id)}</td>
            <td>r/${escapeHtml(task.target_subreddit)}</td>
            <td>${badge(task.status)}</td>
            <td>${escapeHtml(task.risk_score)}</td>
            <td>
              ${task.status === "pending_review" ? `<button class="secondary" data-approve="${escapeHtml(task.task_id)}">批准</button>` : ""}
              ${task.status === "browser_assist_ready" ? `<span class="badge active">可浏览器发布</span>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderContent(data) {
  const rows = data.content.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  $("#contentTable").innerHTML = `
    <table>
      <thead><tr><th>Title</th><th>Topic</th><th>Subreddit</th><th>Status</th><th>Risk</th></tr></thead>
      <tbody>
        ${rows.map((item) => `
          <tr>
            <td class="title-cell">${escapeHtml(item.title)}<br><span class="badge">${escapeHtml(item.content_id)}</span></td>
            <td>${escapeHtml(item.topic_id)}</td>
            <td>r/${escapeHtml(item.target_subreddit)}</td>
            <td>${badge(item.status)}</td>
            <td>${escapeHtml(item.risk_score ?? "")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function render(data) {
  renderMetrics(data);
  renderAccountStatus(data);
  renderTopics(data);
  renderAccounts(data);
  renderSubreddits(data);
  renderQueue(data);
  renderContent(data);
}

async function refresh() {
  state.data = await api("/api/state");
  render(state.data);
}

function formToObject(form) {
  const data = new FormData(form);
  const output = {};
  for (const [key, value] of data.entries()) {
    output[key] = ["daily_post_limit", "weekly_post_limit", "cooldown_hours", "limit"].includes(key) ? Number(value) : value;
  }
  return output;
}

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
$("#refreshBtn").addEventListener("click", async () => {
  await refresh();
  toast("已刷新");
});

$("#accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/accounts", { method: "POST", body: formToObject(event.currentTarget) });
  event.currentTarget.reset();
  await refresh();
  toast("账号档案已创建");
});

$("#pipelineForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = { client_id: "study_immigration", ...formToObject(event.currentTarget) };
  $("#runOutput").textContent = "运行中...";
  const result = await api("/api/pipeline", { method: "POST", body });
  $("#runOutput").textContent = JSON.stringify(result, null, 2);
  await refresh();
  toast("Pipeline 已完成");
});

document.body.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const openLogin = target.dataset.openLogin;
  if (openLogin) {
    await api(`/api/accounts/${openLogin}/open-login`, { method: "POST" });
    toast("已打开 Reddit 登录窗口");
  }
  const accountId = target.dataset.toggleAccount;
  if (accountId) {
    await api(`/api/accounts/${accountId}`, { method: "PATCH", body: { status: target.dataset.status } });
    await refresh();
    toast("账号状态已更新");
  }
  const taskId = target.dataset.approve;
  if (taskId) {
    await api(`/api/queue/${taskId}/approve`, { method: "POST", body: { approved_by: "jason" } });
    await refresh();
    toast("任务已批准");
  }
});

refresh().catch((error) => toast(error.message));
