# Agent-Admin 端點與 Log 改進清單

## 功能缺口

- `GET /users/:id` 回 404，個別用戶查詢未實作
- `GET /surveys/:id/responses` 不存在，無法取得個別填答紀錄，只有聚合 analytics
- Log 查詢缺乏過濾參數，建議支援 `?module=`、`?status=`、`?actor_type=`、`?from=`、`?to=`

## Log 品質

- Module 命名不一致（`agent-admin`、`agent_admin`、`admin_agents`、`me`、`bootstrap` 混用），建議統一
- `response_summary.body` 存入完整 response body，資料量過大，建議移除或改為 opt-in
- 分頁 `meta` 缺少 `total` 欄位，不知道總筆數
- 僅支援 offset 分頁，資料量大時效能差，建議加入 cursor-based 分頁
- Log 無 IP 來源欄位，目前 anonymous 錯誤請求完全無法追蹤來源。透過 Cloudflare Tunnels 可從 `CF-Connecting-IP` header 取得真實用戶 IP，建議後端讀取此 header 並記錄至 log

## 資料設計

- `/policies` 與 `/subscription-plans` 回傳相同的 tier 資料，設計冗餘
- `nameI18n` / `descriptionI18n` 各語系值完全相同，多語系欄位尚未實際填入翻譯
- `/users` 回傳純陣列，缺少 `total` 欄位

## Survey

- 即使允許匿名填答，已登入用戶的回應仍可選擇性附上 `respondent_user_id`，建議支援
