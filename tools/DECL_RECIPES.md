# 宣告利率每月更新：各公司官網抓法（瀏覽器內執行 JS）
每家抓「當月」全部利變商品 名稱|利率|s(停售) → 存成文字檔 → `python3 tools/decl_update.py <公司> <YYYY-MM> <網址> <檔>`。

- 富邦人壽 https://www.fubon.com/life/product/interest-rate/ ：POST `/life/api/v1/node/search-rates` body `{"nodeId":267,"productTemplate":"D3-1-G"|"D3-1-D"(年金),"page":0,"size":2000,"itemName":null,"item":null,"startYear":"115","startMonth":"11","endYear":"115","endMonth":"11"}`（民國年）→ data.rateList[].itemName/rate
- 國泰人壽 https://www.cathaylife.com.tw/cathaylifeins/common/rate ：頁面文字「國泰人壽XXX（險別代號:..）\n宣告年…\n115\t11\t4.30」，按頁碼按鈕 1~30 逐頁抓
- 台灣人壽 https://www.taiwanlife.com/investment-rate-interest-rate ：POST `/portal-api/Rate` JSON `{"page_no":p,"rate_type":"A"}`，datas[].item_name/rate/date，只取當月
- 新光人壽 https://www.skl.com.tw/91d9af4914.html ：GET `/sklife_web/jsp/SklifeRate.jsp?action=rate&year=&pageSize=1000&page=1`（現售）與 `action=historicalrate&year=115&pageSize=2000`（停售，標 s）；content[].row 的 商品名稱/宣告利率/停賣日期。原台新商品在 https://www.skl.com.tw/1cc841ac17.html 的「YYYY年各商品宣告利率」PDF：在該頁用 JS fetch PDF → blob → <a download> 存到電腦「下載」資料夾，再用 device_stage_files 取回、pdftotext -layout 解析（每列第 N 個 % 為 N 月）
- 凱基人壽（含中國人壽） https://www.kgilife.com.tw/zh-tw/product-overview/interest/declare-interest ：頁面文字「名稱\n宣告利率\n4.3%」，點 a.pagination__item 1~18 頁
- 元大人壽 https://www.yuantalife.com.tw/products/investment-center/rate?tab=declared ：GET `/api/api/interest-rate` result[] Year/Month/Contract/Rate
- 全球人壽 https://www.transglobe.com.tw/other-interestrate.html ：頁面內 `GardenModule.MediaCenter.getData({API_ID:mediaAPIKey.productRate_info,session_key:sessionKey,params:[{year:'2026'},{month:'11'},{rateType:'2'}]},cb)` → datas[].name/rate（名稱含「-停售商品」標 s）
- 南山人壽 https://www.nanshanlife.com.tw/nanshanlife/service-rate-1 ：GET `/nanshanlife/portal-api/DeclaredRate/List?productId=-1&productType=-1&page=p`（header Content-Type: application/json），datas[].name/date(115/11)/rate，約 40 頁
- 遠雄人壽 https://www.fglife.com.tw/IRTableA.html ：頁面文字「遠雄人壽XXX(代碼)\t115年11月\t2.10%」（注意全形數字２３）
- 三商美邦 https://www.mli.com.tw/sites/mliportal/investment/products-rate&dlYear=2026&dlMonth=11&actionType=noneed ：「現售」「停售」兩個分頁，文字「三商美邦人壽XXX(代碼)\n\t4.30%」
- 宏泰人壽 https://www.hontai.com.tw/18pages/rate/115/11 ：文字「115/11\t宏泰人壽XXX\t代碼\t2.25%」
- 友邦人壽 https://www.aia.com.tw/zh-tw/help-and-support/interest-rate ：`$.ajax({url:TWWISECommon.generateAPIUrl("CreditRate"),type:"POST",data:{product_code:"",year:"2026",month:"11",pageindex:p}})` → datas[].productName/rateValue，約 5 頁
- 第一金人壽 https://www.firstlife.com.tw/FirstWeb/ProductRateChange ：文字「第一金人壽XXX\t代碼\t2.85%」（全形英文字要 NFKC）
- 合作金庫人壽 https://my.tcb-life.com.tw/interest-rate ：文字「代碼\t名稱\t2026/11\t4.23%」，按「下一頁」
- 臺銀人壽 https://www.twfhclife.com.tw/商品專區/宣告利率/ ：年度表格，取當月欄
- 安達人壽：每張商品一份 PDF，https://life.chubb.com/content/dam/chubb-sites/life-chubb-com/tw-zh/documents/<商品拼音>_declared_rate.pdf（mei_mei_de、mei_mei_de_yi、jin_duo_mei、mei_mei_you、chao_mei_de、mei_mei_xin_yi），在 life.chubb.com 頁面 fetch 後存「下載」資料夾、pdftotext 取「115 年 11 月 4.25%」
- 安聯人壽：尚未找到官網逐張公告頁（待補）
