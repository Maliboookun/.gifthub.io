// ===== Google Apps Script Backend =====
// Setup instructions:
//   1. Go to https://script.google.com and create a new project
//   2. Paste this code and save
//   3. Replace SPREADSHEET_ID with your Google Spreadsheet ID
//   4. Deploy > New deployment > Web app
//      Execute as: Me, Who has access: Anyone
//   5. Paste the deployment URL into GAS_URL in index.html
//
// Spreadsheet sheet structure:
//   "Product Master" sheet:
//     Column A: Barcode  Column B: Product Name  Column C: Price (VAT-inclusive)
//     Row 1 is the header row
//   "Sales Records" sheet:
//     Auto-created if it does not exist

// ===== Configuration (edit these values) =====
const SECRET_TOKEN      = "Enter token here";              // Must match API_TOKEN in index.html
const SPREADSHEET_ID    = "Enter spreadsheet ID here";
const PRODUCT_SHEET     = "Product Master";
const SALES_SHEET       = "Sales Records";
// ==============================================

function doGet(e) {
  if (e.parameter.token !== SECRET_TOKEN) {
    return json({ success: false, message: "Unauthorized" });
  }

  const action = e.parameter.action;

  if (action === "ping") {
    return json({ success: true });
  }

  if (action === "getProduct") {
    return getProduct(e.parameter.barcode);
  }

  return json({ success: false, message: "Unknown action" });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.token !== SECRET_TOKEN) {
      return json({ success: false, message: "Unauthorized" });
    }
    if (payload.action === "recordSale") return recordSale(payload);
    return json({ success: false, message: "Unknown action" });
  } catch (err) {
    return json({ success: false, message: err.message });
  }
}

// Look up a product by barcode in the Product Master sheet
function getProduct(barcode) {
  if (!barcode) return json({ success: false, message: "Barcode is required" });

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PRODUCT_SHEET);
  if (!sheet) return json({ success: false, message: `Sheet "${PRODUCT_SHEET}" not found` });

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {   // Row 0 is the header
    if (String(data[i][0]).trim() === String(barcode).trim()) {
      return json({
        success: true,
        product: { barcode: String(data[i][0]), name: data[i][1], price: Number(data[i][2]) }
      });
    }
  }

  return json({ success: false, message: "Product not found" });
}

// Append sale records to the Sales Records sheet
function recordSale(payload) {
  const ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   salesSheet = ss.getSheetByName(SALES_SHEET);

  // Auto-create the sheet with headers if it doesn't exist
  if (!salesSheet) {
    salesSheet = ss.insertSheet(SALES_SHEET);
    salesSheet.appendRow(["Date/Time", "Transaction ID", "Barcode", "Product Name", "Unit Price", "Qty", "Subtotal", "Total (VAT-incl.)", "VAT"]);
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
