# เปิดใช้งาน SATI บน GitHub Pages + Supabase

สถานะ: โค้ดพร้อมตั้งค่า แต่ยังไม่มีโปรเจกต์ Supabase และยังไม่ได้ทดสอบกับบัญชีออนไลน์จริง

## 1. สร้างฐานข้อมูลของคุณ

1. เปิด https://supabase.com/dashboard แล้วสร้างบัญชี/ลงชื่อเข้าใช้ด้วยตนเอง
2. สร้าง New project เลือกองค์กร ชื่อ `sati-money` และภูมิภาคที่เหมาะกับคุณ เช่น Singapore หากมีให้เลือก
3. ตั้งรหัสผ่านฐานข้อมูลเองและเก็บใน password manager ไม่ต้องใส่รหัสนี้ในเว็บไซต์หรือส่งให้ผู้ช่วย
4. เมื่อโปรเจกต์พร้อม เปิด SQL Editor แล้วรันไฟล์ `supabase/migrations/202610140001_finance_sync.sql` ทั้งไฟล์หนึ่งครั้ง
5. ดู Table Editor จะพบ `finance_documents` ซึ่งเปิด Row Level Security แล้ว ตารางเก็บสมุดของแต่ละบัญชีแยกกัน

ไฟล์ SQL สร้างตารางใหม่ จึงควรใช้โปรเจกต์ใหม่ หรือยืนยันว่าไม่มีตาราง/ฟังก์ชันชื่อเดียวกันก่อนรัน ไม่ต้องรันซ้ำเมื่อ Deploy หน้าเว็บ

## 2. สร้างผู้ใช้สำหรับเข้าสู่เว็บ

1. ไป Authentication → Users → Add user / Create new user สร้างผู้ใช้ด้วยอีเมลของคุณและรหัสผ่านที่คุณตั้งเอง เลือกยืนยันอีเมลเมื่อคุณเป็นเจ้าของอีเมลนั้น
2. ในการตั้งค่า Authentication ปิดการสมัครผู้ใช้ใหม่หากใช้คนเดียว เปิดผู้ให้บริการ Email ไว้
3. หน้า SATI ใช้อีเมลและรหัสผ่านนี้ ไม่ใช่รหัสผ่านบัญชี GitHub หรือรหัสผ่านฐานข้อมูล
4. ฟังก์ชันลืมรหัสผ่านส่งผ่านระบบอีเมล Supabase หากระบบอีเมลเริ่มต้นไม่อนุญาตผู้รับของคุณ ให้ตั้ง Custom SMTP ตามเอกสาร Supabase แล้วทดสอบก่อนใช้งานจริง

## 3. นำโค้ดขึ้น GitHub อย่างปลอดภัย

ใช้ไฟล์ `sati-github-pages-source.zip` ที่จัดให้ แตกไฟล์แล้วสร้าง repository ใหม่โดยให้ `package.json`, `public/`, `supabase/` และ `.github/` อยู่ที่ราก repository

อย่า push ประวัติ Git ของโฟลเดอร์ Sites เดิมทั้งชุด: ประวัติเก่ามีค่าตั้งต้นส่วนตัว โค้ดใน ZIP ถูกตัดข้อมูลเงินเดือนและค่าใช้จ่ายตั้งต้นแล้ว ไม่รวมไฟล์นำเข้าส่วนตัว ไฟล์สำรอง หรือข้อมูลบัญชี

1. ใน Supabase Project Settings → API Keys/Connect คัดลอก Project URL และ **Publishable key** (`sb_publishable_...`) หรือ legacy **anon** key
2. ใน GitHub repository → Settings → Secrets and variables → Actions → Variables เพิ่ม:
   - `SUPABASE_URL` เช่น `https://<project-ref>.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY`
3. ห้ามใช้ `service_role`, `sb_secret_...` หรือ database password ในค่าทั้งสองช่องนี้ Publishable key ถูกเผยแพร่ในเว็บโดยตั้งใจ การปกป้องข้อมูลอาศัย Auth + RLS
4. Settings → Pages → Source เลือก **GitHub Actions**
5. Push ไป branch `main` หรือ Run workflow `Test and deploy SATI`
6. Workflow จะรันทดสอบ สร้างไฟล์ และเผยแพร่เฉพาะ `dist/` การไม่มีค่าเชื่อมต่อจะทำให้ Deploy หยุดพร้อมแจ้งสาเหตุ

## 4. ตั้ง URL สำหรับล็อกอินและกู้รหัสผ่าน

เมื่อได้ URL GitHub Pages ให้ตั้งใน Supabase Authentication → URL Configuration:

- Site URL: `https://<username>.github.io/<repository>/`
- Redirect URLs: `https://<username>.github.io/<repository>/index.html?recovery=1`
- หากทดสอบในเครื่อง เพิ่ม `http://127.0.0.1:4173/index.html?recovery=1`

ใช้ URL ที่ตรงกับเว็บไซต์จริง ไม่ใส่ wildcard กว้าง การตั้งค่า GitHub Pages แบบ project path รองรับเพราะไฟล์ใช้ลิงก์ relative

## 5. นำข้อมูลเดิมเข้าครั้งเดียว

1. เปิดเว็บ ChatGPT Sites เดิม กดสำรอง JSON ให้ได้ข้อมูลล่าสุด
2. เปิดเว็บ GitHub Pages แล้วล็อกอินด้วยอีเมลที่สร้างใน Supabase
3. เลือก **นำเข้าไฟล์สำรอง JSON** บนหน้าเริ่มต้น และยืนยันบัญชีปลายทาง
4. ถ้ายังไม่เคยบันทึกรายการจริง ใช้ไฟล์ส่วนตัว `private/sati-starting-plan.json` ที่มีแผนตั้งต้นตามที่คุณยืนยันแทนได้ ไฟล์นี้ไม่ได้อยู่ใน ZIP และห้ามอัปโหลดเข้า public repository
5. รอ **ซิงก์แล้ว** จึงเปิดมือถือด้วย URL และบัญชีอีเมลเดียวกัน
6. ทดลองเพิ่มรายการเล็ก ๆ ตรวจอีกเครื่อง แล้วแก้หรือลบรายการทดสอบ ระบบจะตรวจข้อมูลทุก 10 วินาทีเมื่อเปิดแท็บ และเมื่อกลับมาที่แท็บ

## ขอบเขตและการดูแลข้อมูล

- ใช้งานออฟไลน์ได้หลังเปิดสมุดและตรวจบัญชีแล้ว ข้อมูลที่ยังไม่ส่งค้างอยู่ในเบราว์เซอร์ ต้องออนไลน์เมื่อต้องเปิดสมุดใหม่
- ถ้าแก้พร้อมกันแล้วข้อมูลต่างรุ่น ระบบหยุดและให้เลือกข้อมูลหลังสำรองทั้งสองชุด ไม่รวมรายการอัตโนมัติ
- ข้อมูลซิงก์ชุดเดียวไม่เกิน 4.5 MB ในหน้าเว็บ (ฐานข้อมูลจำกัด JSON text 5 MB) หากเต็มจะไม่ลบข้อมูล แต่ต้องสำรองและขยายโครงสร้างก่อนเพิ่มต่อ
- แคชและ token อยู่ในเบราว์เซอร์ ไม่เข้ารหัสเพิ่มด้วยรหัสเฉพาะแอป ควรล็อกเครื่องและออกจากระบบเมื่อใช้เครื่องร่วมกัน
- สถานะ “ซิงก์แล้ว” ยืนยันว่าเซิร์ฟเวอร์รับข้อมูล ไม่ใช่การรับประกัน backup ถาวร ควรสำรอง JSON รายเดือน และตรวจนโยบาย backup ของแพ็กเกจ Supabase
- หน้าเว็บและโค้ดบน GitHub Pages อาจเปิดสาธารณะ แต่ข้อมูลจริงต้องผ่านสิทธิ์บัญชี ไม่เผยแพร่ไฟล์สำรองไว้ใน `public/`

อ้างอิง: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions), [Password authentication](https://supabase.com/docs/guides/auth/passwords), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

