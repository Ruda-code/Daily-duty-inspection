# DutyTracker.AI — ตรวจเวร.ai

ระบบตรวจความสะอาดห้องเรียนอัจฉริยะสำหรับห้องเรียนเดียว โดยใช้ **TensorFlow.js + Teachable Machine** วิเคราะห์ภาพภายในเบราว์เซอร์ และบันทึกผลการตรวจลง **Google Sheets** ผ่าน **Google Apps Script Web App**

## ความสามารถ

- กรอกรหัสนักเรียนและชื่อผู้ตรวจเวร
- ระบุรายชื่อนักเรียนที่ขาดเวร
- ถ่ายภาพจากกล้องมือถือหรือเลือกไฟล์ภาพ
- วิเคราะห์ภาพด้วย Teachable Machine บนอุปกรณ์ของผู้ใช้
- แสดง Cleanliness Score 0–100%
- แสดง AI Feedback และความน่าจะเป็นของคลาส
- ส่ง Timestamp, Student ID, Name, Absent Students, AI Score, AI Feedback และ Image Data ไป Google Sheets
- รองรับหน้าจอมือถือและเดสก์ท็อป

## โครงสร้างไฟล์

```
Daily-duty-inspection/
├── index.html
├── style.css
├── script.js
├── Code.gs
└── README.md
```

## 1. สร้าง Google Sheet

1. สร้าง Google Spreadsheet ใหม่
2. ตั้งชื่อได้ตามต้องการ เช่น **DutyTracker.AI Database**
3. ไปที่ **Extensions → Apps Script**
4. เปิดไฟล์ Apps Script แล้วแทนที่โค้ดเดิมด้วยเนื้อหาจาก `Code.gs`
5. กด Save

สคริปต์จะสร้างชีตชื่อ **Inspection Logs** อัตโนมัติเมื่อได้รับข้อมูลครั้งแรก

คอลัมน์ที่ระบบบันทึก:

| คอลัมน์ | ข้อมูล |
|---|---|
| Timestamp | วันที่และเวลาที่ตรวจ |
| Student ID | รหัสนักเรียนผู้ตรวจ |
| Name | ชื่อผู้ตรวจ |
| Absent Students | นักเรียนที่ขาดเวร |
| AI Score | คะแนน 0–100 |
| AI Feedback | ข้อความจาก AI |
| Image Data | รูปภาพแบบ Base64 |

## 2. Deploy Google Apps Script เป็น Web App

ในหน้า Apps Script:

1. กด **Deploy → New deployment**
2. เลือกประเภท **Web app**
3. **Execute as:** Me
4. **Who has access:** Anyone หรือสิทธิ์ที่เหมาะสมกับโรงเรียน
5. กด Deploy
6. อนุญาตสิทธิ์การเข้าถึง Google Sheets หากระบบถาม
7. คัดลอก **Web app URL**

นำ URL ไปใส่ใน `script.js`:

```javascript
const GAS_WEB_APP_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";
```

ตัวอย่างรูปแบบ:

```javascript
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/xxxxxxxx/exec";
```

> ไม่ควรเผยแพร่ Web App URL ในเอกสารสาธารณะถ้าโรงเรียนมีข้อกำหนดด้านความปลอดภัยเพิ่มเติม หากต้องการระบบที่ปลอดภัยขึ้น สามารถเพิ่ม Secret Token หรือระบบตรวจสอบสิทธิ์ในภายหลังได้

## 3. สร้าง Teachable Machine Model

แนะนำให้สร้าง **Image Project** ที่ Teachable Machine และมีอย่างน้อย 2 คลาส:

- `Clean`
- `Dirty`

ตัวอย่างภาพสำหรับฝึกโมเดล:

**Clean**
- พื้นสะอาด
- โต๊ะจัดเป็นระเบียบ
- ไม่มีขยะ
- เก้าอี้จัดเข้าที่

**Dirty**
- มีขยะบนพื้น
- โต๊ะรก
- เก้าอี้ไม่เป็นระเบียบ
- มีสิ่งของวางกระจัดกระจาย

หลัง Train Model ให้เลือก **Export Model → TensorFlow.js → Upload/Share Model** แล้วคัดลอก Model URL

นำ URL ไปใส่ใน `script.js`:

```javascript
const MODEL_URL = "YOUR_TEACHABLE_MACHINE_URL";
```

ตัวอย่าง:

```javascript
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/xxxxxxxx/";
```

### การจับคู่คะแนน

ระบบจะพยายามตรวจชื่อคลาสที่เกี่ยวข้องกับ:

**สะอาด**
- Clean
- สะอาด
- Tidy
- Good
- เรียบร้อย

**ไม่สะอาด**
- Dirty
- สกปรก
- Messy
- Bad
- Not Clean
- ไม่สะอาด
- รก

ถ้าใช้ชื่อคลาสอื่น ให้แก้รายการ `CLEAN_LABELS` และ `DIRTY_LABELS` ใน `script.js`

## 4. เปิดเว็บไซต์

สามารถนำ Repository นี้ไปเปิดด้วย GitHub Pages ได้

แนะนำให้ใช้ HTTPS เพราะการใช้งานกล้องบนมือถือมักต้องการ Secure Context

อย่าเปิดด้วย `file://` หากต้องการใช้งานกล้องอย่างสม่ำเสมอ

### เปิด GitHub Pages

1. ไปที่ Repository
2. **Settings → Pages**
3. เลือก **Deploy from a branch**
4. เลือก branch `main`
5. เลือกโฟลเดอร์ `/(root)`
6. Save
7. รอ GitHub สร้างเว็บไซต์

## 5. ทดสอบระบบ

1. เปิดเว็บไซต์
2. กรอกรหัสนักเรียน
3. กรอกชื่อ
4. ระบุนักเรียนที่ขาดเวร ถ้ามี
5. ถ่ายภาพหรือเลือกรูปห้องเรียน
6. รอ AI วิเคราะห์
7. ตรวจ Cleanliness Score และ Feedback
8. กด **บันทึกผลตรวจ**
9. ตรวจสอบข้อมูลใน Google Sheet

## ข้อควรรู้เรื่อง Image Data

ตามสเปกของโปรเจกต์ ระบบนี้ส่งรูปภาพเป็น **Base64 Image Data** ไปยัง Google Sheets โดยตรง

ไฟล์ภาพถูกลดขนาดเป็น JPEG ก่อนส่ง เพื่อลดปริมาณข้อมูล แต่ Google Sheets มีข้อจำกัดด้านขนาดข้อมูลต่อเซลล์ ดังนั้นหากใช้งานจำนวนมากหรือภาพมีขนาดใหญ่ ควรเปลี่ยนสถาปัตยกรรมเป็น:

```
Browser
  ↓
Google Apps Script
  ↓
Google Drive (เก็บภาพ)
  ↓
Google Sheets (เก็บ URL ภาพ)
```

สำหรับงานห้องเรียนขนาดเล็ก วิธีปัจจุบันเหมาะสำหรับการทดลองและทำ PBL/โครงงานต้นแบบ

## การทำงานของระบบ

```
ผู้ตรวจเวร
   │
   ▼
ถ่ายภาพห้องเรียน
   │
   ▼
TensorFlow.js + Teachable Machine
   │
   ├── วิเคราะห์ภาพใน Browser
   │
   ▼
Cleanliness Score + AI Feedback
   │
   ▼
Google Apps Script Web App
   │
   ▼
Google Sheets
```

**จุดสำคัญ:** ภาพจะถูกประมวลผลด้วยโมเดล AI ในเบราว์เซอร์ก่อน ไม่ได้ส่งภาพไปยังบริการ AI ภายนอกเพื่อทำการจำแนกภาพ

## แก้ปัญหาเบื้องต้น

### AI ขึ้นว่า "ยังไม่ได้ตั้งค่า MODEL_URL"

เปิด `script.js` แล้วเปลี่ยน:

```javascript
const MODEL_URL = "YOUR_TEACHABLE_MACHINE_URL";
```

เป็น URL ของโมเดลจริง และควรมีเครื่องหมาย `/` ท้าย URL

### กดบันทึกไม่ได้

ตรวจสอบ:

- กรอก Student ID แล้ว
- กรอกชื่อแล้ว
- มีภาพ
- AI วิเคราะห์เสร็จแล้ว
- ตั้งค่า `GAS_WEB_APP_URL` แล้ว

### Google Sheets ไม่ได้รับข้อมูล

ตรวจสอบ:

- Deploy เป็น Web App แล้ว
- Execute as เป็นบัญชีเจ้าของ Script
- ตั้งค่าการเข้าถึงให้ผู้ใช้เว็บไซต์เรียกได้
- URL ลงท้ายด้วย `/exec`
- เปิด Apps Script → Executions เพื่อตรวจ Error

### กล้องไม่ทำงาน

- อนุญาต Camera ให้เบราว์เซอร์
- ใช้ HTTPS
- บนมือถือให้ใช้ปุ่มถ่ายภาพจากช่องอัปโหลด
- หลีกเลี่ยงการเปิดเว็บผ่าน `file://`

## การปรับปรุงในอนาคต

- Dashboard สรุปคะแนนรายวัน/รายสัปดาห์
- ระบบ Login สำหรับนักเรียนและครู
- ประวัติการตรวจย้อนหลัง
- แจ้งเตือนเมื่อคะแนนต่ำ
- บันทึกภาพลง Google Drive แทน Base64 ใน Sheet
- เพิ่มโมเดลตรวจเฉพาะจุด เช่น พื้น โต๊ะ ถังขยะ และกระดาน
- ระบบ QR Code สำหรับเลือกห้องเรียน
- ระบบสถิติการขาดเวรของนักเรียน

---

**DutyTracker.AI · ตรวจเวร.ai**  
ระบบต้นแบบสำหรับการตรวจความสะอาดห้องเรียนด้วย AI
