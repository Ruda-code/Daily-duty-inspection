/**
 * DutyTracker.AI - Google Apps Script
 * รับผลตรวจจากหน้าเว็บและบันทึกลง Google Sheets
 */

const SHEET_NAME = "Inspection Logs";
const HEADERS = [
  "Timestamp",
  "Student ID",
  "Name",
  "Absent Students",
  "AI Score",
  "AI Feedback",
  "Image Data"
];

function doGet() {
  return jsonResponse({
    success: true,
    service: "DutyTracker.AI",
    message: "Google Apps Script Web App is running."
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("ไม่พบข้อมูลที่ส่งมา");
    }

    const data = JSON.parse(e.postData.contents);

    validateRequired(data, "studentId", "รหัสนักเรียน");
    validateRequired(data, "name", "ชื่อผู้ตรวจเวร");
    validateRequired(data, "aiScore", "AI Score");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("ไม่พบ Google Spreadsheet ที่ผูกกับ Apps Script นี้");
    }

    const sheet = getOrCreateSheet(ss);

    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    const score = Number(data.aiScore);

    if (Number.isNaN(score) || score < 0 || score > 100) {
      throw new Error("AI Score ต้องอยู่ระหว่าง 0 ถึง 100");
    }

    sheet.appendRow([
      timestamp,
      safeCell(data.studentId),
      safeCell(data.name),
      safeCell(data.absentStudents || ""),
      score,
      safeCell(data.aiFeedback || ""),
      safeCell(data.imageData || "")
    ]);

    return jsonResponse({
      success: true,
      message: "บันทึกผลการตรวจเรียบร้อยแล้ว"
    });
  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      message: error && error.message ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ"
    });
  }
}

function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);

    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#17213a");
    headerRange.setFontColor("#ffffff");
  }

  return sheet;
}

function validateRequired(data, key, label) {
  if (data[key] === undefined || data[key] === null || String(data[key]).trim() === "") {
    throw new Error("กรุณาระบุ" + label);
  }
}

function safeCell(value) {
  const text = String(value === undefined || value === null ? "" : value);

  // ป้องกัน Formula Injection ใน Google Sheets
  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }

  return text;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}