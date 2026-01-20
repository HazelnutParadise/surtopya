# Surtopya 術語對照表 (Terminology Glossary)

本文件定義系統中使用的核心名詞及其行為，作為開發與 i18n (多語系) 實作的標準。

| 英文術語 (Key) | 中文對應 (Traditional Chinese) | 定義與行為 (Definition & Behavior) |
| :--- | :--- | :--- |
| **Public** | **公開** | 問卷可見於市集。必須開啟數據集分享 (非付費會員)。 |
| **Non-public** | **非公開** | 問卷不可見於市集，僅能透過連結訪問。預設關閉數據集分享，但可手動開啟。 |
| **Private** | *(不建議使用)* | *統一替換為 Non-public 以符合一致性。* |
| **Draft** | **草稿** | 編輯中且未發布的版本。 |
| **Published** | **已發布** | 目前線上的問卷版本。 |
| **Unpublished Changes** | **未發布的變更** | 問卷已儲存但尚未同步至線上版本的內容。 |
| **New Changes** | **有新變更** | 儀表板中用來標註問卷有「未發布的變更」的標籤。 |
| **Dataset Sharing** | **資料集共享** | 將去識別化的問卷結果貢獻至 Open Marketplace 的功能。 |
| **Toolbox** | **工具箱** | 問卷製作器左側的問題類型選擇區。 |
| **Canvas** | **畫布** | 問卷製作器中間的題目排列與編輯區。 |
| **Logic** | **邏輯** | 設定題目跳轉或隱藏的規則條件。 |
| **Section / Page** | **頁面** | 問卷的邏輯分段。 |

## 行為一致性準則 (Terminology Consistency)

1. **Dashboard (儀表板)**:
   - 顯示狀態應統一為：`Public` (公開), `Non-public` (非公開), `Draft` (草稿)。
   - 若有未發布變更，應顯示 `New Changes` (有新變更) 標籤。

2. **Survey Builder (問卷製作器)**:
   - 右上角狀態顯示：`Draft` 或 `Published`。
   - 發布設定中的「可見度」選項統一使用：`Public` 與 `Non-public`。

3. **Database / API (後端)**:
   - 存儲字串統一使用小寫：`public`, `non-public`, `draft`。
