// ===== Google Apps Script バックエンド =====
// 使い方:
//   1. https://script.google.com で新規プロジェクトを作成
//   2. このコードを貼り付けて保存
//   3. SPREADSHEET_ID をコピーしたスプレッドシートのIDに書き換える
//   4. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
//      実行ユーザー: 自分、アクセス: 全員
//   5. デプロイURLを index.html の GAS_URL に貼り付ける
//
// スプレッドシートのシート構成:
//   「商品マスタ」シート:
//     A列: バーコード  B列: 商品名  C列: 価格（税込）
//     1行目はヘッダー行
//   「売上記録」シート:
//     自動生成されます（存在しない場合は作成されます）

// ===== 設定定数（変更してください） =====
const SPREADSHEET_ID    = "ここにスプレッドシートIDを入力";
const PRODUCT_SHEET     = "商品マスタ";
const SALES_SHEET       = "売上記録";
// =========================================

function doGet(e) {
  const action = e.parameter.action;

  if (action === "ping") {
    return json({ success: true });
  }

  if (action === "getProduct") {
    return getProduct(e.parameter.barcode);
  }

  return json({ success: false, message: "不明なアクション" });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === "recordSale") return recordSale(payload);
    return json({ success: false, message: "不明なアクション" });
  } catch (err) {
    return json({ success: false, message: err.message });
  }
}

// バーコードで商品マスタを検索
function getProduct(barcode) {
  if (!barcode) return json({ success: false, message: "バーコードが未指定です" });

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PRODUCT_SHEET);
  if (!sheet) return json({ success: false, message: `シート "${PRODUCT_SHEET}" が見つかりません` });

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {          // 1行目はヘッダー
    if (String(data[i][0]).trim() === String(barcode).trim()) {
      return json({
        success: true,
        product: { barcode: String(data[i][0]), name: data[i][1], price: Number(data[i][2]) }
      });
    }
  }

  return json({ success: false, message: "商品が見つかりません" });
}

// 売上を売上記録シートに書き込む
function recordSale(payload) {
  const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   salesSheet = ss.getSheetByName(SALES_SHEET);

  // シートがなければ自動作成してヘッダーを設定
  if (!salesSheet) {
    salesSheet = ss.insertSheet(SALES_SHEET);
    salesSheet.appendRow(["日時", "取引ID", "バーコード", "商品名", "単価", "数量", "小計", "合計（税込）", "消費税"]);
  }

  const datetime = new Date(payload.datetime);
  payload.items.forEach(item => {
    salesSheet.appendRow([
      datetime,
      payload.transactionId,
      item.barcode,
      item.name,
      item.price,
      item.qty,
      item.subtotal,
      payload.total,
      payload.tax
    ]);
  });

  return json({ success: true, transactionId: payload.transactionId });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
