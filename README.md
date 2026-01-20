# Surtopya - Privacy-Preserving Survey Platform

Surtopya 是一個整合了去識別化資料集市場的問卷平台。本文件記載了系統的核心邏輯與架構設計。

## 1. 核心技術架構

### 前端 (Web)
- **Framework**: Next.js (App Router)
- **Internationalization (i18n)**: 使用 `next-intl`。
- **Styling**: Tailwind CSS & Lucide Icons.

### 後端 (API)
- **Framework**: Go Gin
- **Database**: PostgreSQL

---

## 2. 關鍵邏輯實作

### A. 自動化國際化 (i18n)
系統支援繁體中文 (zh-TW)、英文 (en) 與日文 (ja)。
- **自動翻譯**: 透過 `web/scripts/translate.ts` 使用 Ollama LLM 進行翻譯。
- **快取機制**: 使用內容 Hash (MD5) 進行磁碟快取 (`.translation-cache.json`)，避免重複翻譯，節省運算資源。
- **路由設計**: 採用 `[locale]` 動態路由結構，確保 SEO 與語系切換的流暢度。

### B. 動態環境變數 (Runtime Env Vars)
為了解決 Docker 環境下 `PUBLIC_API_URL` 被編譯固定的問題：
- **混合架構**: 數據集詳情頁等關鍵頁面改為 **Server Component**，在 Request Time 讀取環境變數。
- **注入機制**: 由 Server Component 讀取 `process.env` 後，作為 Prop 傳入 Client Component，確保 Docker Compose 中的變數修改能即時生效。

### C. 問卷可見度與資料分享連動
系統內建隱私補償邏輯：
- **公開問卷 (Public)**：自動強制開啟「資料集分享 (Dataset Sharing)」，以此維持平台的免費營運（去識別化後加入市場）。
- **非公開問卷 (Non-public)**：預設關閉分享，保障絕對隱私，除非使用者手動開啟。
- **知情同意**: 建置工具 (Survey Builder) 進入前必經 Consent Modal，拒絕同意將無法使用建置功能。

---

## 3. 開發與部署

### Docker 啟動
使用 Docker Compose 一鍵啟動全棧環境：
```bash
docker compose up --build
```

### 執行翻譯腳本
若修改了 `messages/zh-TW.json`，需執行翻譯：
```bash
# 在 web 容器內執行
npm run translate
```

### 資料持久化
- 翻譯快取與翻譯文件透過 Docker Volume 掛載到本地 `./web/messages`，確保翻譯進度不會因容器重啟而消失。

---

## 4. 系統環境變數
| 變數名 | 說明 | 範例 |
| :--- | :--- | :--- |
| `PUBLIC_API_URL` | 前端呼叫 API 的地址 | `http://localhost:8080/api/v1` |
| `OLLAMA_BASE_URL` | Ollama API 連線地址 | `http://host.docker.internal:11434` |
| `OLLAMA_MODEL` | 翻譯使用的 LLM 模型 | `llama3` |

---

## 5. 未來設計與維護建議 (Future Design Considerations)

### A. 資料庫設計 (Database Schema)
當未來從 Mock 轉向實體資料庫時，務必確保問卷 table 包含 `visibility` (enum: public, non-public) 欄位。這直接影響：
1. **API 過濾管理**：Server 端應在 Query 時就排除 `non-public` 的問卷，除非是作者本人或持有 Direct Link。
2. **搜尋引擎索引控制**：前端需根據此欄位動態輸出 `noindex`。

### B. 搜尋引擎優化 (SEO)
- **索引控制**：對於非公開問卷，前端必須輸出 `robots: { index: false, follow: true }`。主流搜尋引擎（Google, Bing, Baidu）均能正確識別此 Meta 標籤以防止頁面被收錄。
- **動態環境變數**：Docker 部署時，環境變數應統一從 `.env` 文件載入，避免直接硬編碼在 `docker-compose.yml` 中，以方便多環境管理（Dev/Staging/Prod）。
