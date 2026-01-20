# Surtopya 專案進度報告 (Status Report)

## 專案概覽 (Project Overview)
Surtopya 是一個整合去識別化數據集市場的隱私保護問卷平台。

---

## 已完成項目 (Completed)

### 1. 前端功能 (Frontend Features)
- **問卷建立器 (Survey Builder)**
  - 拖放式介面建立問卷
  - 支援多種題型：單選、多選、簡答、長答、評分、日期、下拉選單、分頁
  - 多頁面問卷支援
  - 條件邏輯跳轉
  - 主題自訂（顏色、字體）
  - 頁面深層複製功能
  - 智慧文字對比（自動切換黑白文字）
  - 發布設定對話框

- **問卷填答器 (Survey Renderer)**
  - 多頁面進度顯示
  - 主題套用
  - 邏輯跳轉執行
  - 驗證與提交
  - 預覽模式

- **儀表板 (Dashboard)**
  - 問卷列表與狀態標示
  - 統計卡片（總回應數、點數餘額、進行中問卷）
  - 可見度狀態顯示（公開/非公開/草稿）
  - 未發布變更標示

- **數據集市場 (Dataset Marketplace)**
  - 搜尋與篩選功能
  - 類別分類
  - 排序選項
  - 數據集詳情頁面

- **UI 元件庫**
  - 完整的 Radix UI 整合
  - 響應式設計
  - 深色模式支援

### 2. 後端 API (Backend API)
- **問卷 API (Survey API)**
  - `POST /api/v1/surveys` - 建立問卷
  - `GET /api/v1/surveys/:id` - 取得問卷
  - `GET /api/v1/surveys/my` - 取得使用者問卷
  - `GET /api/v1/surveys/public` - 取得公開問卷
  - `PUT /api/v1/surveys/:id` - 更新問卷
  - `DELETE /api/v1/surveys/:id` - 刪除問卷
  - `POST /api/v1/surveys/:id/publish` - 發布問卷
  - `POST /api/v1/surveys/:id/unpublish` - 取消發布

- **回應 API (Response API)**
  - `POST /api/v1/surveys/:id/responses/start` - 開始填答
  - `POST /api/v1/responses/:id/answers` - 提交單一答案
  - `POST /api/v1/responses/:id/submit` - 提交所有答案
  - `GET /api/v1/surveys/:id/responses` - 取得問卷回應

- **數據集 API (Dataset API)**
  - `GET /api/v1/datasets` - 取得數據集列表
  - `GET /api/v1/datasets/:id` - 取得數據集詳情
  - `GET /api/v1/datasets/categories` - 取得類別
  - `POST /api/v1/datasets/:id/download` - 下載數據集

### 3. 資料庫 (Database)
- PostgreSQL 架構設計完成
- 資料表：users, surveys, questions, responses, answers, datasets, points_transactions
- 索引與觸發器設定

### 4. 認證 (Authentication)
- Logto JWT 驗證中介層
- CORS 設定
- 使用者自動建立

### 5. 國際化 (i18n)
- 繁體中文 (zh-TW) ✓
- 英文 (en) ✓
- 日文 (ja) ✓

### 6. DevOps
- Docker Compose 設定
- PostgreSQL 容器整合
- 環境變數設定

---

## 核心邏輯實作 (Core Logic Implementation)

### A. 問卷可見度與數據分享連動
- **公開問卷**：強制開啟數據集分享
- **非公開問卷**：預設關閉分享，可選擇加入
- **首次發布鎖定**：發布後無法從非公開切換為公開

### B. 動態環境變數
- Server Component 在請求時讀取環境變數
- Docker 環境變數即時生效

### C. 知情同意
- 建立問卷前必須同意數據使用條款

---

## 技術架構 (Tech Stack)

### 前端
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Radix UI
- dnd-kit (拖放)
- next-intl (i18n)

### 後端
- Go Gin
- PostgreSQL
- JWT 認證

### 部署
- Docker & Docker Compose
- Bun (前端執行環境)

---

## 檔案結構 (File Structure)

```
surtopya/
├── web/                    # 前端 (Next.js)
│   ├── src/
│   │   ├── app/           # 頁面路由
│   │   ├── components/    # 元件
│   │   │   ├── builder/   # 問卷建立器
│   │   │   ├── survey/    # 問卷填答
│   │   │   └── ui/        # UI 元件
│   │   ├── lib/           # 工具函式與 API 客戶端
│   │   └── types/         # TypeScript 類型定義
│   └── messages/          # i18n 翻譯檔
├── api/                    # 後端 (Go)
│   ├── cmd/server/        # 入口點
│   ├── internal/
│   │   ├── handlers/      # API 處理器
│   │   ├── middleware/    # 中介層
│   │   ├── models/        # 資料模型
│   │   ├── repository/    # 資料庫操作
│   │   ├── routes/        # 路由設定
│   │   └── database/      # 資料庫連線
│   └── migrations/        # 資料庫遷移
└── docker-compose.yml     # 容器編排
```

---

## 下一步計劃 (Next Steps)

1. ~~實作頁面深層複製~~ ✓
2. ~~完成後端 API 開發~~ ✓
3. ~~完成 i18n 翻譯~~ ✓
4. 整合測試
5. 部署設定優化
6. 效能調校

---

## 啟動方式 (Getting Started)

```bash
# 啟動完整環境
docker compose up --build

# 前端：http://localhost:3000
# API：http://localhost:8080
# PostgreSQL：localhost:5432
```

## 環境變數

請參考 `.env.example` 設定必要的環境變數。
