# RTM (Requirement Traceability Matrix) 需求追蹤矩陣系統

一個專為專案經理與開發團隊設計的**互動式 AI 輔助需求追蹤矩陣 (RTM)** 系統。本系統採用輕量級淺色微光風 (Glassmorphism) 設計，提供直觀、流暢的需求與功能對照管理，並整合 Google Gemini AI 進行智慧需求拆解與自動關聯推薦。

---

## 🌟 主要功能

1. **專案管理 (Project Management)**
   - 支援建立、讀取、更新、刪除多個專案。
   - 所有專案數據均儲存於本地 JSON 檔案資料庫（免去複雜的原生 DB 套件安裝與編譯）。

2. **需求管理與 AI 拆解 (Requirements & AI Parser)**
   - 支援導入客戶 RFP 檔案（Excel `.xlsx`/`.xls`、Word `.docx` 或純文字 `.txt`）。
   - 整合 **Gemini AI** 自動拆解段落，智慧提取出結構化的「需求編號」、「需求名稱」與「需求描述」。
   - 提供版本控制功能（異動分析），支援匯入新版 RFP 並與舊版對比，標記新增、修改及刪除的需求。

3. **功能模組管理 (System Functions)**
   - 支援導入系統功能規格書 (FSD)（支援 Excel、Word 與純文字 `.txt`）。
   - 支援透過 AI 快速將複雜的規格書內容拆解為「功能編號」、「功能名稱」與「功能描述」。

4. **二維矩陣檢視 (Matrix View)**
   - 直觀的雙向對照 Grid 矩陣。
   - **Sticky Headers**：橫向滾動時需求列固定，縱向滾動時功能欄固定，在大專案中也能清晰對齊。
   - 點擊即可手動勾選/取消勾選對應關係，實時保存至本地端。

5. **追蹤明細與 AI 自動關聯 (Traceability & AI Align)**
   - 清單式追蹤視圖，顯示每個需求的關聯狀態。
   - **AI 自動關聯 (AI Align)**：一鍵讓 Gemini AI 分析所有需求與功能，智慧推薦最合理的對應關係。
   - 單筆需求推薦：可針對單一需求點擊「AI 推薦」，由 AI 提供推薦的功能關聯與推薦理由。

6. **衝擊分析 (Impact Analysis)**
   - 當需求 (RFP) 發生版次異動且內容被修改時，系統會自動將舊有的關聯標記為「**待重新確認 (Pending Recheck)**」。
   - 提供視覺化警示，提醒專案人員針對受影響的關聯進行人工核對，降低規格異動遺漏的風險。

7. **匯出功能 (Export)**
   - 一鍵將 RTM 矩陣匯出為 Excel 兼容的 CSV 檔案。

---

## 🛠️ 專案架構

```text
RTM/
├── backend/               # 後端服務 (Express.js)
│   ├── data/              # 本地 JSON 資料庫目錄
│   ├── src/
│   │   ├── ai.js          # Gemini REST API 呼叫邏輯
│   │   ├── db.js          # 本地 JSON CRUD 資料庫管理
│   │   ├── parser.js      # Word/Excel/TXT 文件解析器
│   │   └── index.js       # Express 路由、版本 Diff 與主程式
│   ├── package.json
│   └── ...
├── frontend/              # 前端應用 (React + Vite)
│   ├── src/
│   │   ├── components/    # 功能分頁組件
│   │   │   ├── ProjectDashboard.jsx  # 專案首頁儀表板
│   │   │   ├── Workspace.jsx         # 專案工作區主控台
│   │   │   ├── RequirementsTab.jsx   # 需求管理 (RFP)
│   │   │   ├── FunctionsTab.jsx      # 功能管理 (FSD)
│   │   │   ├── MatrixTab.jsx         # 矩陣勾選對照 (Sticky Header Grid)
│   │   │   ├── TraceabilityTab.jsx   # 追蹤明細與 AI 推薦功能
│   │   │   └── SettingsTab.jsx       # 設定頁面 (Gemini API Key/模型)
│   │   ├── App.jsx        # 路由與導覽
│   │   ├── index.css      # 淺色玻璃微光設計系統樣式
│   │   └── main.jsx
│   ├── package.json
│   └── ...
├── 測試資料/              # 範例測試檔案
│   ├── RFP.txt            # 客戶需求說明書範例
│   └── FSD.txt            # 系統功能規格書範例
├── start-dev.ps1          # Windows 一鍵啟動指令檔 (PowerShell)
└── pushgit.ps1            # Git 推送輔助腳本
```

---

## 🚀 快速開始 (Windows 環境)

本專案提供了一鍵啟動腳本，會自動檢查並安裝前後端依賴，並同時啟動後端與前端開發伺服器。

### 步驟 1：環境準備
請確保您的系統已安裝 [Node.js](https://nodejs.org/) (建議 v18 以上版本)。

### 步驟 2：一鍵啟動
1. 在專案根目錄，以 PowerShell 執行：
   ```powershell
   .\start-dev.ps1
   ```
2. 腳本會自動：
   - 檢測並使用 `npm install` 安裝後端依賴。
   - 檢測並使用 `npm install` 安裝前端依賴。
   - 開啟新的 PowerShell 視窗啟動後端 (Port `5000`)。
   - 開啟新的 PowerShell 視窗啟動前端 (Port `5173`)。

3. 啟動完成後，瀏覽器會自動或手動開啟：[http://localhost:5173](http://localhost:5173)

---

## 🔌 AI 設定與 API 金鑰配置

本系統的 AI 功能基於 Google Gemini REST API 進行整合，具備高相容性與快速回應的特點。

### 如何配置 API 金鑰：
1. 進入系統後，點擊右上角或側邊欄的 **「系統設定」 (Settings)**。
2. 輸入您的 Gemini API Key (通常以 `AIzaSy...` 或 `AQ.Ab...` 開頭)。
3. 選擇模型（預設建議為 `gemini-3.5-flash` 以獲得最佳速度與分析品質）。
4. 點擊儲存，設定值將安全的儲存在您瀏覽器的 `localStorage` 中，後續的操作將自動帶上此金鑰。

---

## 📝 推薦測試流程

您可以使用專案根目錄下 `測試資料/` 資料夾中的範例檔案來快速體驗系統功能：

1. **建立專案**：在首頁點擊「建立新專案」，輸入專案名稱與代碼。
2. **導入 RFP (需求)**：
   - 進入專案，點擊左側「需求管理 (RFP)」。
   - 點擊「導入 RFP 檔案」，選擇 `測試資料/RFP.txt`。
   - 勾選「使用 AI 進行需求拆解」，然後點擊導入。系統會自動利用 Gemini AI 將文字拆解成 5 個結構化需求。
3. **導入 FSD (功能)**：
   - 點擊左側「功能管理 (FSD)」。
   - 點擊「導入 FSD 檔案」，選擇 `測試資料/FSD.txt`。
   - 勾選「使用 AI 進行功能拆解」，然後點擊導入。系統會自動利用 AI 拆解出功能清單。
4. **自動關聯 (AI Align)**：
   - 點擊左側「追蹤明細」。
   - 點擊右上角「AI 自動關聯」，Gemini 會比對需求與功能的語意，為所有項目建立對應關係，並提供推薦理由。
5. **手動微調與查看矩陣**：
   - 點擊左側「二維矩陣」。
   - 您會看到交叉格狀矩陣。您可以手動點擊格子，即時新增或取消特定的關聯。
6. **模擬異動與衝擊分析**：
   - 如果您上傳了新版的 RFP（例如某個需求描述被修改了），在「需求管理」中該需求會顯示為 `MODIFIED`。
   - 此時進入「追蹤明細」或「二維矩陣」，受該需求影響的關聯會顯示黃色警示，標記為 `Pending Recheck` (待重新確認)，您需要核對並重新確認該關聯。
7. **匯出 RTM**：
   - 點擊「追蹤明細」中的「匯出為 CSV」，即可將對照表下載至本機使用 Excel 開啟。
