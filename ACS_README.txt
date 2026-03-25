════════════════════════════════════════════════════════════════
  ACS 系統說明文件
  Asset Control System + ACS工作台 + 服飾管理系統
  最後更新：2026-03-25
════════════════════════════════════════════════════════════════

────────────────────────────────────────
  系統概述
────────────────────────────────────────
三個前端共用同一個 Google Sheet 後端，
透過 Google Apps Script（GAS）作為 API 中介層。

  ┌─────────────────────┐
  │   ACS 工作台         │  Chrome Extension（桌面）
  │   Chrome Extension  │  工作排程、行事曆、筆記
  └──────────┬──────────┘
             │
  ┌──────────▼──────────┐
  │   Google Apps       │  後端 API
  │   Script（GAS）      │  doGet() 處理所有請求
  └──────────┬──────────┘
             │
  ┌──────────▼──────────┐     ┌─────────────────────┐
  │   Google Sheet      │     │   ACS PWA           │
  │   （資料庫）         │◄────│   手機端 PWA         │
  └─────────────────────┘     │   資產管理＋服飾系統  │
                               └─────────────────────┘


────────────────────────────────────────
  一、ACS 工作台（Chrome Extension）
────────────────────────────────────────

【用途】
桌面工作控制中心，開新分頁時顯示 Dashboard

【檔案】
  manifest.json     擴充功能設定，版本 4.0.0，Manifest V3
  popup.html        點擊擴充功能圖示時的彈出視窗
  popup.js          顯示目前視窗數、分頁數，按鈕開啟 Dashboard
  dashboard.html    主 Dashboard 頁面
  dashboard.css     Dashboard 樣式
  dashboard.js      Dashboard 主邏輯

【功能模組】
  - 分頁/視窗總覽
  - 時鐘
  - 行事曆（資料存 Google Sheet「工作台行事曆」分頁）
  - 筆記本（資料存 Google Sheet「工作台筆記本」分頁）
  - 背景設定
  - 卡片自由拖拉排列

【連接 GAS 的 actions】
  getCalendar   讀取行事曆
  setCalendar   寫入/刪除行事曆
  getNotes      讀取筆記
  setNote       寫入/刪除筆記


────────────────────────────────────────
  二、ACS PWA（手機端）
────────────────────────────────────────

【用途】
手機優先的個人資產管理 + 服飾銷售管理系統
部署為 PWA，可加入手機主畫面使用

【包含兩大子系統】

  ▌ A. 資產管理系統
  管理個人持有的各類資產（加密貨幣、黃金、台股、現金等）

  支援資產類型：
    crypto     加密貨幣（透過 OKX API 抓取價格，換算台幣）
    gold_tw    台灣黃金（Yahoo Finance GC=F，換算台幣每克）
    metal_usd  貴金屬美元計價（Yahoo Finance）
    metal_two  興櫃貴金屬（Yahoo Finance .TWO）
    stock      台股（Yahoo Finance .TW）
    fx         現金/外幣（價格固定為 1）

  匯率來源：exchangerate-api.com（USD/TWD 即時匯率）

  連接 GAS 的 actions：
    getPrices      取得各資產即時報價
    addProduct     新增資產
    updateProduct  更新資產數量/價值
    deleteProduct  刪除資產
    addHistory     新增交易紀錄
    getHistory     讀取交易紀錄
    getProducts    讀取所有資產

  ▌ B. 服飾管理系統
  韓國服飾代購的完整進銷存管理

  流程：
    訂購 → 貨運核對 → 入庫 → 庫存管理 → 出貨 → 預存盈餘追蹤

  連接 GAS 的 actions：
    clothes_getStagingList      讀取貨運核對單
    clothes_addStaging          新增/更新核對單
    clothes_voidStaging         作廢核對單（廠商退款）
    clothes_clearStaging        清空核對單（依狀態）
    clothes_commitInbound       入庫（核對單→進貨明細＋更新庫存）
    clothes_getInbound          讀取進貨明細
    clothes_getStock            讀取庫存
    clothes_updateProduct       更新庫存商品（售價/樣品/狀態）
    clothes_getOutbound         讀取出貨明細
    clothes_addOutbound         新增出貨（自動扣庫存）
    clothes_deleteOutboundBatch 刪除整批出貨（自動還庫存）
    clothes_updateOutboundStatus 更新出貨狀態
    clothes_getSurplus          讀取預存盈餘（入金＋支出）
    clothes_addDeposit          新增入金
    clothes_addExpense          新增支出


────────────────────────────────────────
  三、Google Apps Script（GAS）
────────────────────────────────────────

【用途】
整個系統的後端 API，部署為 Web App
所有前端都透過 HTTP GET 請求與 GAS 溝通

【部署方式】
Google Sheet → 擴充功能 → Apps Script → 部署為 Web App
執行身分：我（擁有者）
存取權限：所有人

【通訊格式】
所有請求都是 GET，帶 action 參數
支援 JSONP（帶 callback 參數）以解決跨域問題

範例：
  ?action=getProducts
  ?action=clothes_getStock
  ?action=getPrices&symbols=[...]


────────────────────────────────────────
  四、Google Sheet 分頁結構
────────────────────────────────────────

分頁名稱              用途
─────────────────────────────────────────
商品                  資產清單（名稱/種類/數量/現值/時間）
歷史紀錄              資產交易歷史（買入/賣出/調整）
工作台行事曆          Chrome 工作台的行事曆資料
工作台筆記本          Chrome 工作台的筆記資料（JSON 格式存儲）
服飾_貨運核對         訂購後尚未入庫的待確認清單
服飾_進貨明細         已入庫的進貨完整紀錄（含成本計算）
服飾_庫存             目前可售庫存（含售價/樣品標記/狀態）
服飾_出貨明細         出貨訂單紀錄（含客戶資料/金流資訊）
服飾_預存盈餘_入金    預存資金的入金紀錄
服飾_預存盈餘_支出    預存資金的支出紀錄（商品費/代購費/運費）


────────────────────────────────────────
  五、服飾系統完整欄位說明
────────────────────────────────────────

▌ 服飾_貨運核對
  ID / 訂購日期 / 商品代碼 / 檔口 / 款式 / 尺寸 /
  代購方式 / 韓幣成本(單件) / 匯率 / 數量 / 狀態
  狀態值：待入庫 / 已入庫 / 廠商退款

▌ 服飾_進貨明細
  ID / 訂購日期 / 商品代碼 / 檔口 / 款式 / 尺寸 /
  代購方式 / 韓幣成本(單件) / 韓幣總成本 / NT總成本 /
  代購費 / 匯率 / 單件成本 / 代購NT價 / 數量 / 合計 / 入庫時間

▌ 服飾_庫存
  商品代碼 / 款式 / 尺寸 / 成本 / 售價 / 庫存 / 狀態 / 樣品
  狀態值：可售 / 售完

▌ 服飾_出貨明細
  ID / 訂單編號 / 日期 / 狀態 / 商品代碼 / 款式 / 尺寸 /
  成本 / 售價 / 數量 / 合計 / IG帳號 / 姓名 / 電話 /
  地址 / 寄送方式 / 銀行後五碼 / 運費
  狀態值：待出貨 / 已出貨

▌ 服飾_預存盈餘_入金
  ID / 日期 / 金額(NT) / 匯率

▌ 服飾_預存盈餘_支出
  ID / 日期 / 商品費 / 代購費 / 運費 / 合計 / 備註


────────────────────────────────────────
  六、常見問題排解
────────────────────────────────────────

Q：資產價格抓不到？
A：確認 GAS 的 Web App 是否正常部署
   加密貨幣透過 OKX API，股票透過 Yahoo Finance
   如果特定幣種抓不到，確認 symbol 格式是否正確

Q：服飾系統入庫後庫存沒更新？
A：clothes_commitInbound 會同時更新核對單狀態、
   寫入進貨明細、更新庫存，三步驟在同一個 action
   如果庫存沒更新，檢查商品代碼是否完全一致（大小寫）

Q：出貨後庫存沒扣減？
A：clothes_addOutbound 會自動扣庫存
   如果沒扣，確認 productCode 與庫存分頁的商品代碼一致

Q：刪除出貨後庫存沒還回來？
A：clothes_deleteOutboundBatch 會自動將庫存還回
   使用 batchId（訂單編號）作為刪除依據

Q：GAS 回傳 error？
A：打開 Google Sheet → 擴充功能 → Apps Script
   查看執行記錄確認錯誤訊息

════════════════════════════════════════════════════════════════
