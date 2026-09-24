/**
 * DutyTracker.AI - Google Apps Script
 * รับผลตรวจจากหน้าเว็บ บันทึกลง Google Sheets
 * และเก็บรูปไว้ใน Google Drive พร้อมสร้างลิงก์กดเปิดรูป
 */

const SHEET_NAME = "Inspection Logs";
const DRIVE_FOLDER_NAME = "DutyTracker.AI Images";

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

    const imageLink = saveImageToDrive(data.imageData, timestamp, data.studentId);

    sheet.appendRow([
      timestamp,
      safeCell(data.studentId),
      safeCell(data.name),
      safeCell(data.absentStudents || ""),
      score,
      safeCell(data.aiFeedback || ""),
      imageLink ? createHyperlinkFormula(imageLink) : ""
    ]);

    return jsonResponse({
      success: true,
      message: "บันทึกผลการตรวจเรียบร้อยแล้ว",
      imageLink: imageLink || ""
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      success: false,
      message: error && error.message ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ"
    });
  }
}

function saveImageToDrive(imageData, timestamp, studentId) {
  if (!imageData) return "";

  const match = String(imageData).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("รูปภาพมีรูปแบบข้อมูลไม่ถูกต้อง");

  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(
    bytes,
    mimeType,
    createImageFileName(timestamp, studentId, mimeType)
  );

  const folder = getOrCreateDriveFolder();
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sharingError) {
    console.warn("ไม่สามารถตั้งค่า Anyone with link ได้: " + sharingError.message);
  }

  return "https://drive.google.com/file/d/" + file.getId() + "/view";
}

function createImageFileName(timestamp, studentId, mimeType) {
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const time = Utilities.formatDate(
    timestamp,
    Session.getScriptTimeZone() || "Asia/Bangkok",
    "yyyyMMdd_HHmmss"
  );
  return "Duty_" + time + "_" +
    String(studentId).replace(/[^a-zA-Z0-9_-]/g, "_") + "." + extension;
}

function getOrCreateDriveFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function createHyperlinkFormula(url) {
  const safeUrl = String(url).replace(/"/g, '""');
  return '=HYPERLINK("' + safeUrl + '","เปิดรูป")';
}

function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

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
  if (data[key] === undefined || data[key] === null ||
      String(data[key]).trim() === "") {
    throw new Error("กรุณาระบุ" + label);
  }
}

function safeCell(value) {
  const text = String(value === undefined || value === null ? "" : value);
  if (/^[=+\-@]/.test(text)) return "'" + text;
  return text;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}