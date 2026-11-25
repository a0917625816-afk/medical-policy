# 燈塔 Pharos 上線收費步驟（launch-prep 分支）

這個分支把「收費上線」需要的東西全部先準備好，**目前網站（GitHub Pages）完全不受影響**。站長說要開始收費時，照下面順序做。

## 已準備好的東西
| 檔案 | 用途 |
|---|---|
| `functions/api/[[path]].js`、`lib/member/core.js` | 會員系統 API（Cloudflare Pages Functions＋D1）；品牌「燈塔 Pharos」、399／月、3,990／年、處經理團購 3,591／人／年（5 人以上 9 折；10 人 85 折、20 人 8 折在後台登記付款時改金額） |
| `account/`、`admin/` | 會員中心（登入、裝置、改密碼）、站長後台（總覽、會員、夥伴與邀請碼、報表、設定、操作紀錄） |
| `.github/scripts/build_site.sh` | Cloudflare 建置：只發佈網站要用的檔案（tools／clauses／gx／內部筆記不公開）、插入網域鎖、搬家接收端、隱藏記號過濾、頁尾禁止抓取聲明、資料檔不給搜尋引擎收錄、壓縮程式 |
| `launch/guard.js` | 上面那段插入網頁的保護程式 |
| `launch/sender.js` | 上線當天放進舊網址（GitHub Pages）的搬家送出端：把夥伴裝置裡 `mpe-` 開頭的資料帶到新網址 |
| `launch/backup.yml` | 每日異地備份到 R2（`pharos/` 底下） |

## 上線當天順序
1. **合併最新內容**：把 `main` 最新的內容合併進這個分支（或反過來），確認網站功能正常。
2. **買網域**（約一年 300～400 台幣，**先跟站長確認**）→ 在 Cloudflare 買，名稱由站長決定。
3. **建 Cloudflare Pages 專案**：連 GitHub（只授權 medical-policy 這個儲存庫）、建置指令 `bash .github/scripts/build_site.sh`、輸出 `_site`、正式分支 `main`。
   - 環境變數：`SITE_HOST`＝正式網域；`CANARY_ROWS`＝隱藏記號假保單（清單存在工作室，不寫進儲存庫）。
4. **建 D1 資料庫** `pharos-members`，綁定到 Pages 專案，變數名稱 `DB`；部署後打開 `/api/config` 確認 `needs_setup:true`。
5. **站長自己建帳號**：到 `/account/` 輸入開通碼（開通碼另外給站長，只能用一次）。
6. **綁定網域＋防火牆**（跟每月現金流規劃一樣）：Bot Fight Mode、擋 AI 訓練爬蟲、限流（同一 IP 10 秒內抓資料超過 120 次就擋）、擋抓取程式（python／curl／wget／headless 等）、www 轉主網域、一律 HTTPS。
7. **舊網址搬家**：把 `launch/sender.js`（`__NEW__` 換成新網址）放進 `main` 的 index.html 最前面 → 夥伴打開舊網址會自動帶著資料搬到新網址。
8. **儲存庫改成私人**（GitHub Pages 會停，所以一定要在第 7 步生效、確認搬家正常之後）。
9. **每日備份**：把 `launch/backup.yml` 放到 `.github/workflows/`，加 R2 鑰匙（站長自己貼）。
10. **上鎖＋防 AI／程式代抓**（收費開始才做）：
    - 伺服器端登入把關：沒登入拿不到網頁與資料（客戶專屬連結維持免登入）
    - 每個帳號每天查詢量上限，超過自動暫停並通知站長
    - 每個帳號資料埋各自不同的隱藏記號，外流可追到帳號與日期
    - 登入／註冊頁加 Cloudflare Turnstile 真人驗證
    - 服務條款寫明禁止以程式或 AI 自動抓取
11. **金流**：串綠界／藍新，或由代收公司收款後在後台登記付款。

## 已測試
- 會員 API 45 項自動測試全過（登入、90 天、3 台裝置、付款延長、分潤、退款、停用、權限、跨站、嘗試次數）。
- 建置後網站在正式網域正常開啟；被複製到別的網址會被鎖住；隱藏記號只在資料檔裡，畫面搜尋不到。
