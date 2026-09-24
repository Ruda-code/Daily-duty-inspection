/*
 * DutyTracker.AI - ตรวจเวร.ai
 * วิเคราะห์ภาพด้วย Teachable Machine ภายในเบราว์เซอร์
 * แล้วส่งรายงานไปยัง Google Apps Script Web App
 */

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/KUyrG8LMir/";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby-w2sIiaRNt49uskrFbFphkBJvMibFP9sHVPPh0FnsG2W10mrNIKgKlJr2Vvxx5if_/exec";

const CLEAN_LABELS = [
  "clean", "สะอาด", "tidy", "good", "เรียบร้อย", "clean classroom", "สะอาดเรียบร้อย"
];

const DIRTY_LABELS = [
  "dirty", "สกปรก", "messy", "bad", "not clean", "ไม่สะอาด", "รก", "ต้องทำความสะอาด"
];

let model = null;
let latestAnalysis = null;
let imageDataForUpload = "";

const $ = (id) => document.getElementById(id);

const imageInput = $("imageInput");
const imagePreview = $("imagePreview");
const imageLoading = $("imageLoading");
const previewWrap = $("previewWrap");
const uploadZone = $("uploadZone");
const analysisCanvas = $("analysisCanvas");
const scoreRing = $("scoreRing");
const scoreValue = $("scoreValue");
const aiFeedback = $("aiFeedback");
const aiExplanation = $("aiExplanation");
const aiStatus = $("aiStatus");
const predictions = $("predictions");
const submitBtn = $("submitBtn");
const formStatus = $("formStatus");
const inspectionForm = $("inspectionForm");

document.addEventListener("DOMContentLoaded", () => {
  imageInput.addEventListener("change", handleImageSelection);
  $("removeImage").addEventListener("click", resetImage);
  inspectionForm.addEventListener("submit", handleSubmit);
});

async function loadModel() {
  if (model) return model;

  if (!window.tmImage) {
    throw new Error("ไม่พบ Teachable Machine library");
  }

  if (!MODEL_URL || MODEL_URL.includes("YOUR_TEACHABLE_MACHINE_URL")) {
    throw new Error("ยังไม่ได้ตั้งค่า MODEL_URL ใน script.js");
  }

  const normalizedUrl = MODEL_URL.endsWith("/") ? MODEL_URL : MODEL_URL + "/";
  setAIStatus("กำลังโหลดโมเดล", "loading");
  model = await tmImage.load(
    normalizedUrl + "model.json",
    normalizedUrl + "metadata.json"
  );
  setAIStatus("โมเดลพร้อมใช้งาน", "ready");
  return model;
}

async function handleImageSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showStatus("กรุณาเลือกไฟล์รูปภาพเท่านั้น", "error");
    imageInput.value = "";
    return;
  }

  try {
    resetAnalysisOnly();
    $("fileName").textContent = file.name;
    previewWrap.classList.remove("hidden");
    uploadZone.classList.add("hidden");
    imageLoading.classList.remove("hidden");
    setAIStatus("กำลังวิเคราะห์", "loading");
    showStatus("");

    const dataUrl = await readImage(file);
    imagePreview.src = dataUrl;

    await waitForImage(imagePreview);
    imageDataForUpload = await compressImage(imagePreview, 1280, 0.74);

    const loadedModel = await loadModel();
    const predictionsResult = await loadedModel.predict(imagePreview, false);

    latestAnalysis = calculateScore(predictionsResult);
    renderAnalysis(latestAnalysis);
    imageLoading.classList.add("hidden");
    validateForm();
  } catch (error) {
    console.error(error);
    imageLoading.classList.add("hidden");
    resetAnalysisOnly();
    setAIStatus("เกิดข้อผิดพลาด", "error");
    showStatus(error.message || "ไม่สามารถวิเคราะห์ภาพได้", "error");
  }
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ภาพได้"));
    reader.readAsDataURL(file);
  });
}

function waitForImage(img) {
  return new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("ไม่สามารถแสดงภาพได้"));
  });
}

async function compressImage(img, maxSize, quality) {
  const ratio = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * ratio));
  const height = Math.max(1, Math.round(img.naturalHeight * ratio));

  analysisCanvas.width = width;
  analysisCanvas.height = height;

  const ctx = analysisCanvas.getContext("2d", { alpha: false });
  ctx.drawImage(img, 0, 0, width, height);

  return analysisCanvas.toDataURL("image/jpeg", quality);
}

function calculateScore(items) {
  const normalized = items.map((item) => ({
    className: item.className,
    probability: Number(item.probability) || 0
  }));

  let cleanProbability = 0;
  let dirtyProbability = 0;

  for (const item of normalized) {
    const label = item.className.trim().toLowerCase();
    if (isCleanLabel(label)) cleanProbability += item.probability;
    if (isDirtyLabel(label)) dirtyProbability += item.probability;
  }

  let score;
  let mappingNote = "";

  if (cleanProbability > 0 || dirtyProbability > 0) {
    const total = cleanProbability + dirtyProbability;
    score = total > 0 ? (cleanProbability / total) * 100 : 50;
  } else {
    const top = [...normalized].sort((a, b) => b.probability - a.probability)[0];
    const topLabel = top?.className || "";
    if (isCleanLabel(topLabel.toLowerCase())) {
      score = top.probability * 100;
    } else if (isDirtyLabel(topLabel.toLowerCase())) {
      score = (1 - top.probability) * 100;
    } else {
      score = 50;
      mappingNote = "ชื่อคลาสของโมเดลยังไม่ตรงกับ Clean/Dirty";
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    feedback: feedbackForScore(score),
    explanation: explanationForScore(score, mappingNote),
    predictions: normalized.sort((a, b) => b.probability - a.probability)
  };
}

function isCleanLabel(label) {
  return CLEAN_LABELS.some((known) => label === known || label.includes(known));
}

function isDirtyLabel(label) {
  return DIRTY_LABELS.some((known) => label === known || label.includes(known));
}

function feedbackForScore(score) {
  if (score >= 90) return "ยอดเยี่ยม! ห้องเรียนสะอาดและเป็นระเบียบมาก";
  if (score >= 75) return "ดีมาก! โดยรวมสะอาด แนะนำตรวจรายละเอียดเล็กน้อย";
  if (score >= 50) return "ควรปรับปรุง ควรเก็บขยะและจัดพื้นที่เพิ่มเติม";
  return "ควรทำความสะอาดเพิ่มเติม ก่อนส่งผลการตรวจ";
}

function explanationForScore(score, mappingNote = "") {
  let text;
  if (score >= 90) text = "AI ประเมินว่าพื้นที่โดยรวมมีความสะอาดและเป็นระเบียบในระดับสูง";
  else if (score >= 75) text = "AI พบว่าห้องเรียนอยู่ในสภาพดี แต่ยังควรตรวจจุดเล็ก ๆ เช่น โต๊ะ พื้น และถังขยะ";
  else if (score >= 50) text = "AI พบสัญญาณที่ควรปรับปรุง ควรจัดโต๊ะ เก็บขยะ และตรวจพื้นที่ให้ทั่วถึง";
  else text = "AI พบสัญญาณความไม่สะอาดค่อนข้างมาก ควรทำความสะอาดก่อนบันทึกผล";
  return mappingNote ? text + " · " + mappingNote : text;
}

function renderAnalysis(result) {
  scoreValue.textContent = result.score;
  scoreRing.style.setProperty("--score", (result.score * 3.6) + "deg");
  aiFeedback.textContent = result.feedback;
  aiExplanation.textContent = result.explanation;
  predictions.innerHTML = result.predictions
    .slice(0, 4)
    .map((item) => '<span class="prediction-chip">' +
      escapeHtml(item.className) + " · " + Math.round(item.probability * 100) + "%</span>")
    .join("");

  setAIStatus("วิเคราะห์เสร็จแล้ว", "ready");
  submitBtn.disabled = false;
}

function setAIStatus(text, state) {
  aiStatus.textContent = text;
  aiStatus.className = "ai-status";
  if (state === "error") {
    aiStatus.style.color = "var(--danger)";
    aiStatus.style.borderColor = "rgba(255,113,136,.2)";
    aiStatus.style.background = "rgba(255,113,136,.07)";
  } else if (state === "loading") {
    aiStatus.style.color = "var(--warning)";
    aiStatus.style.borderColor = "rgba(255,209,102,.2)";
    aiStatus.style.background = "rgba(255,209,102,.07)";
  } else {
    aiStatus.style.color = "var(--accent)";
    aiStatus.style.borderColor = "rgba(110,231,255,.18)";
    aiStatus.style.background = "rgba(110,231,255,.07)";
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  showStatus("");

  const studentId = $("studentId").value.trim();
  const studentName = $("studentName").value.trim();
  const absentStudents = $("absentStudents").value.trim();

  if (!studentId || !studentName) {
    showStatus("กรุณากรอกรหัสนักเรียนและชื่อผู้ตรวจเวร", "error");
    return;
  }

  if (!latestAnalysis || !imageDataForUpload) {
    showStatus("กรุณาเลือกภาพและรอให้ AI วิเคราะห์จนเสร็จก่อน", "error");
    return;
  }

  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL")) {
    showStatus("ยังไม่ได้ตั้งค่า GAS_WEB_APP_URL ใน script.js", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.querySelector("span").textContent = "กำลังบันทึก...";
  showStatus("กำลังส่งผลการตรวจไปยัง Google Sheets...");

  const payload = {
    timestamp: new Date().toISOString(),
    studentId,
    name: studentName,
    absentStudents,
    aiScore: latestAnalysis.score,
    aiFeedback: latestAnalysis.feedback,
    imageData: imageDataForUpload
  };

  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("เซิร์ฟเวอร์ตอบกลับด้วยสถานะ " + response.status);
    }

    let result = null;
    try { result = await response.json(); } catch (_) {}

    if (result && result.success === false) {
      throw new Error(result.message || "Google Apps Script ปฏิเสธข้อมูล");
    }

    showStatus("บันทึกผลการตรวจเรียบร้อยแล้ว ✓", "success");
  } catch (error) {
    console.error(error);
    showStatus("ไม่สามารถบันทึกข้อมูลได้: " + error.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector("span").textContent = "บันทึกผลตรวจ";
  }
}

function validateForm() {
  submitBtn.disabled = !latestAnalysis || !imageDataForUpload;
}

function resetAnalysisOnly() {
  latestAnalysis = null;
  imageDataForUpload = "";
  scoreValue.textContent = "--";
  scoreRing.style.setProperty("--score", "0deg");
  aiFeedback.textContent = "กำลังเตรียมการวิเคราะห์";
  aiExplanation.textContent = "ระบบจะประเมินภาพด้วยโมเดล AI ที่ตั้งค่าไว้";
  predictions.innerHTML = "";
  submitBtn.disabled = true;
}

function resetImage() {
  imageInput.value = "";
  previewWrap.classList.add("hidden");
  uploadZone.classList.remove("hidden");
  imagePreview.removeAttribute("src");
  resetAnalysisOnly();
  setAIStatus("รอภาพ", "ready");
  showStatus("");
}

function showStatus(message, type = "") {
  formStatus.textContent = message;
  formStatus.className = "form-status" + (type ? " " + type : "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
