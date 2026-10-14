# SATI · Personal Finance

เว็บการเงินภาษาไทยสำหรับ GitHub Pages + Supabase มี Dashboard งบประมาณ รายการรายวัน กองเงิน เป้าหมาย ทรัพย์สิน หนี้ รายได้หลายทาง ภาษี รายงานหลายปี และสมุดงานอ้างอิงครบ 6 ชีท รองรับมือถือ ธีมมืด/สว่าง พิมพ์และส่งออก JSON/CSV

## เริ่มใช้งาน

อ่าน [SETUP-SUPABASE.md](SETUP-SUPABASE.md) เพื่อสร้างโปรเจกต์ ฐานข้อมูล ผู้ใช้ และตั้ง GitHub Pages โค้ดพร้อมตั้งค่า แต่ยังไม่มีฐานข้อมูลออนไลน์จนกว่าจะทำขั้นตอนนี้

Node.js 22 ขึ้นไป (แนะนำ 24): `npm ci`, `npm test`, `npm run build`, `npm start` แล้วเปิด http://127.0.0.1:4173

ตั้งค่า SUPABASE_URL และ SUPABASE_PUBLISHABLE_KEY ระหว่าง build หรือแก้ public/config.js ด้วยค่าที่เปิดเผยได้เท่านั้น ห้ามใช้ secret/service_role key ไม่มี backend Node.js ที่ต้องรันบน GitHub Pages

## โครงสร้าง

- public/ : หน้าจอและการคำนวณ เริ่มจากแผนว่าง ไม่มีเงินเดือนส่วนตัวฝังไว้
- public/auth.js : ล็อกอินด้วย Supabase Auth, รีเฟรช session, ออกจากระบบ และกู้รหัสผ่าน
- public/cloud.js : อ่าน/เขียนฐานข้อมูล พร้อมแคชแยกตามโปรเจกต์และบัญชี
- public/sync-core.js : คิวซิงก์ เปรียบเทียบ revision แก้ conflict และ retry
- supabase/migrations/ : ตาราง PostgreSQL, RLS, ฟังก์ชันบันทึกแบบ atomic
- tests/ : การเงิน, backup validation, sync race conditions และทดสอบ SQL/RLS จริงบน PGlite
- .github/workflows/deploy.yml : ทดสอบและ Deploy เฉพาะ dist ไป GitHub Pages

## ขอบเขต

อ่านขอบเขตซิงก์และขั้นตอนย้ายข้อมูลในคู่มือ รองรับ JSON 4.5 MB บน client/5 MB ที่ฐานข้อมูล เปิดสมุดครั้งแรกต้องออนไลน์ ไม่มีการรวม conflict อัตโนมัติ สำรอง JSON เป็นประจำ

ทดสอบ SQL ด้วย PostgreSQL engine ในเครื่องไม่เท่ากับทดสอบ Auth/SMTP/โครงการ Supabase ออนไลน์ ต้องตรวจทั้งสองอุปกรณ์จริงหลังตั้งค่าบัญชี

กฎภาษีในแอปอ้างอิงตรวจเมื่อ 13 ตุลาคม 2569 ต้องตรวจใหม่ตามปีภาษี ไม่เชื่อมธนาคาร ไม่โอนเงินจริง และไม่ยื่นภาษี

หากมีไฟล์ private/ ในเครื่อง ไฟล์นั้นเป็นข้อมูลส่วนตัว ห้ามรวมใน repository สาธารณะหรือ public/ ใช้ ZIP ซอร์สที่จัดไว้เพื่อเริ่ม repository ใหม่โดยไม่มีประวัติส่วนตัวจาก Sites
