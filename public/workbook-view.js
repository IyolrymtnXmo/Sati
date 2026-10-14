import { exportCSV } from './data.js';

const PAGE_SIZE = 60;
const ROUTES = ['networth', 'budget', 'health', 'debt', 'projection', 'settings'];
const ROUTE_LABELS = ['งบฐานะการเงิน', 'งบรายรับรายจ่าย', 'สุขภาพการเงิน', 'คำนวณเงินกู้', 'วางแผนลงทุน', 'ตั้งค่าประกันสังคม'];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const number = value => count(value).toLocaleString('th-TH');

function columnName(index) {
  let result = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}

function sheetCells(sheet) {
  if (Array.isArray(sheet?.cells)) return sheet.cells;
  return (Array.isArray(sheet?.rows) ? sheet.rows : []).flatMap(row => Array.isArray(row.cells) ? row.cells : []);
}

function pagination(currentPage, pages, matchingRows, firstRow, lastRow) {
  if (!matchingRows) return '';
  return `<div class="sheet-toolbar" aria-label="เปลี่ยนหน้าตาราง">
    <span class="muted">แถว ${number(firstRow)}–${number(lastRow)} · ${number(matchingRows)} แถว${pages > 1 ? ` · หน้า ${number(currentPage + 1)}/${number(pages)}` : ''}</span>
    ${pages > 1 ? `<div class="page-actions">
      <button type="button" class="button small" data-action="workbook-page" data-page="${currentPage - 1}"${currentPage === 0 ? ' disabled' : ''} aria-label="ตารางหน้าก่อนหน้า">ก่อนหน้า</button>
      <button type="button" class="button small" data-action="workbook-page" data-page="${currentPage + 1}"${currentPage >= pages - 1 ? ' disabled' : ''} aria-label="ตารางหน้าถัดไป">ถัดไป</button>
    </div>` : ''}
  </div>`;
}

function cellHTML(cell, row, column, showFormulas) {
  const address = `${columnName(column)}${row}`;
  if (!cell) return `<td aria-label="${address}: ว่าง"></td>`;
  const formula = typeof cell.formula === 'string' ? cell.formula : '';
  const isError = cell.type === 'e';
  const value = showFormulas && formula ? formula : cell.value;
  const classes = [formula ? 'formula-cell' : '', !showFormulas && typeof value === 'number' ? 'numeric' : '', isError && !showFormulas ? 'negative' : ''].filter(Boolean).join(' ');
  const title = `${address}${formula ? `\nสูตร: ${formula}\nค่าที่บันทึกใน Excel: ${String(cell.cachedValue ?? cell.value ?? '')}` : ''}${isError ? '\nข้อผิดพลาดที่บันทึกในไฟล์ต้นฉบับ' : ''}${cell.numberFormat ? `\nรูปแบบต้นฉบับ: ${cell.numberFormat}` : ''}`;
  return `<td class="${classes}" data-cell="${address}" title="${escapeHTML(title)}" style="white-space:pre-wrap;min-width:100px;max-width:400px;overflow-wrap:anywhere">${escapeHTML(value)}</td>`;
}

/** Read-only source viewer. Original figures are deliberately never imported into personal plans. */
export function renderWorkbook(reference, { sheetIndex = 0, showFormulas = false, search = '', page = 0 } = {}) {
  const sheets = Array.isArray(reference?.sheets) ? reference.sheets : [];
  if (!sheets.length) return '<div class="card"><div class="empty-state"><h3>ยังเปิดไฟล์อ้างอิงไม่ได้</h3><p>กรุณาลองโหลดหน้าใหม่เพื่อเรียกข้อมูล Excel ต้นฉบับ</p></div></div>';
  const selected = Math.min(count(sheetIndex), sheets.length - 1);
  const sheet = sheets[selected];
  const cells = sheetCells(sheet);
  const maxRow = Math.min(1048576, Math.max(count(sheet.maxRow), ...cells.map(cell => count(cell.row))));
  const maxColumn = Math.min(16384, Math.max(count(sheet.maxColumn), ...cells.map(cell => count(cell.column))));
  const cellMap = new Map(cells.map(cell => [`${count(cell.row)}:${count(cell.column)}`, cell]));
  const query = String(search ?? '').trim().toLocaleLowerCase('th-TH');
  const matching = new Set(query ? cells.filter(cell => [cell.address, cell.value, cell.formula].some(value => String(value ?? '').toLocaleLowerCase('th-TH').includes(query))).map(cell => count(cell.row)) : []);
  const rows = query ? [...matching].filter(row => row > 0).sort((a, b) => a - b) : Array.from({ length: maxRow }, (_, index) => index + 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(count(page), pages - 1);
  const visibleRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const names = (Array.isArray(reference.definedNames) ? reference.definedNames : []).filter(item => item.localSheetId === undefined || Number(item.localSheetId) === selected);
  const formulaCount = cells.filter(cell => typeof cell.formula === 'string' && cell.formula).length;
  const errors = cells.filter(cell => cell.type === 'e');
  const sheetTabs = sheets.map((item, index) => `<button type="button" id="workbook-tab-${index}" role="tab" aria-selected="${index === selected}" aria-controls="workbook-sheet-panel" class="sheet-tab${index === selected ? ' active' : ''}" data-action="workbook-sheet" data-index="${index}">${escapeHTML(item.name)}${item.state === 'hidden' ? '<span class="badge muted">ชีทซ่อน</span>' : ''}</button>`).join('');
  const mappingLinks = sheets.map((item, index) => `<a href="#${ROUTES[index] ?? 'settings'}" class="chip" title="${escapeHTML(item.name)}">${number(index + 1)}. ${ROUTE_LABELS[index] ?? 'ตั้งค่า'}</a>`).join(' ');
  const controls = pagination(currentPage, pages, rows.length, visibleRows[0], visibleRows.at(-1));
  const table = visibleRows.length ? `<div class="table-wrap" tabindex="0" aria-label="ตารางต้นฉบับ เลื่อนแนวนอนเพื่อดูทุกคอลัมน์">
    <table aria-label="${escapeHTML(sheet.name)}${showFormulas ? ' สูตรต้นฉบับ' : ' ค่าที่บันทึกไว้'}">
      <thead><tr><th scope="col" aria-label="เลขแถว">#</th>${Array.from({ length: maxColumn }, (_, index) => `<th scope="col">${columnName(index + 1)}</th>`).join('')}</tr></thead>
      <tbody>${visibleRows.map(row => `<tr><th scope="row">${row}</th>${Array.from({ length: maxColumn }, (_, index) => cellHTML(cellMap.get(`${row}:${index + 1}`), row, index + 1, showFormulas)).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>` : '<div class="empty-state"><h3>ไม่พบรายการที่ค้นหา</h3><p>ค้นหาจากชื่อรายการ พิกัดเซลล์ ค่าต้นฉบับ หรือข้อความสูตรในชีทนี้</p></div>';

  return `<div class="section-stack">
    <div class="notice"><p><strong>ไฟล์อ้างอิงครบทุกชีท</strong> ตัวเลขในตารางนี้มาจากแม่แบบ Excel และยังไม่ใช่ข้อมูลการเงินที่คุณยืนยัน ค่าสูตรเป็นผลลัพธ์ที่ไฟล์บันทึกไว้ ไม่ได้คำนวณใหม่ในหน้านี้ ใช้หน้าระบบด้านล่างเพื่อกรอกข้อมูลจริงและคำนวณแผนของคุณ</p></div>
    <div class="stat-grid">
      <div class="stat-card"><p class="stat-label">ชีททั้งหมด</p><p class="stat-value">${number(sheets.length)}<small>ชีท</small></p><span class="stat-foot">รวมชีทอ้างอิงที่ซ่อนใน Excel</span></div>
      <div class="stat-card"><p class="stat-label">เซลล์ที่มีข้อมูล</p><p class="stat-value">${number(reference.totalMeaningfulCells ?? sheets.reduce((sum, item) => sum + sheetCells(item).length, 0))}</p><span class="stat-foot">คงค่าต้นฉบับและตำแหน่งเซลล์</span></div>
      <div class="stat-card"><p class="stat-label">สูตรต้นฉบับ</p><p class="stat-value">${number(reference.totalFormulas ?? sheets.reduce((sum, item) => sum + sheetCells(item).filter(cell => cell.formula).length, 0))}</p><span class="stat-foot">รวมสูตรที่คัดลอกตามแถวและคอลัมน์</span></div>
      <div class="stat-card"><p class="stat-label">ชีทที่กำลังเปิด</p><p class="stat-value">${number(selected + 1)}<small>/ ${number(sheets.length)}</small></p><span class="stat-foot">${number(cells.length)} เซลล์ · ${number(formulaCount)} สูตร</span></div>
    </div>
    <div class="card"><div class="card-body"><h2 class="card-title">เปิดส่วนที่ใช้งานได้ในระบบ</h2><p class="card-subtitle">แต่ละชีทเชื่อมกับเครื่องมือที่กรอกและคำนวณใหม่ได้</p><div class="legend" style="margin-top:14px">${mappingLinks}</div></div></div>
    <div>
      <div class="sheet-tabs" role="tablist" aria-label="เลือกชีท Excel ต้นฉบับ">${sheetTabs}</div>
      <section id="workbook-sheet-panel" role="tabpanel" aria-labelledby="workbook-tab-${selected}" class="card">
        <div class="card-head"><div><h2 class="card-title">${escapeHTML(sheet.name)}</h2><p class="card-subtitle">ช่วงต้นฉบับ ${escapeHTML(sheet.dimension)} · ดูค่าดิบตามพิกัดเซลล์ · ${showFormulas ? 'แสดงสูตร' : 'แสดงค่าที่บันทึกไว้'}</p></div><span class="badge muted">อ่านอย่างเดียว</span></div>
        <div class="sheet-toolbar">
          <div class="field" style="flex:1 1 240px;max-width:400px"><label for="workbook-search" class="sr-only">ค้นหาในชีท</label><input id="workbook-search" type="search" value="${escapeHTML(search)}" placeholder="ค้นหาข้อความ พิกัด หรือสูตรในชีท…" autocomplete="off"></div>
          <div class="page-actions"><button type="button" class="button small${showFormulas ? ' primary' : ''}" data-action="workbook-formulas" aria-pressed="${Boolean(showFormulas)}">${showFormulas ? 'กลับไปดูค่า' : 'ดูสูตร Excel'}</button><button type="button" class="button small" data-action="workbook-csv" data-index="${selected}">CSV ทั้งชีท</button><a class="button small" href="./money-coach-on-stage-8.xlsx" download="money-coach-on-stage-8.xlsx">Excel ต้นฉบับ</a></div>
        </div>
        ${errors.length ? `<div class="card-body" style="padding-bottom:0"><div class="notice warning"><p>ไฟล์ต้นฉบับบันทึกข้อผิดพลาดไว้ ${number(errors.length)} เซลล์ เช่น ${escapeHTML(errors[0].address)}: ${escapeHTML(errors[0].value)} โดยคงไว้เพื่ออ้างอิง ไม่ใช่ผลคำนวณจากข้อมูลส่วนตัวของคุณ</p></div></div>` : ''}
        ${table}
        ${controls}
        <div class="card-body"><div class="legend"><span><span class="legend-dot"></span>พื้นเขียวอ่อน = เซลล์สูตร</span><span>วางตัวชี้บนเซลล์เพื่อดูพิกัด สูตร และค่าที่บันทึกไว้</span>${pages > 1 ? `<span>แบ่งแสดงหน้าละ ${PAGE_SIZE} แถว · CSV และ Excel มีข้อมูลครบ</span>` : ''}</div>
          ${names.length ? `<details style="margin-top:16px"><summary>ชื่อช่วงและขอบเขตพิมพ์ต้นฉบับ (${number(names.length)})</summary><div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>สูตร / ช่วง</th></tr></thead><tbody>${names.map(item => `<tr><td>${escapeHTML(item.name)}</td><td style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(item.formula)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
        </div>
      </section>
    </div>
  </div>`;
}

/** Every meaningful cell in the selected sheet, independent of search or pagination. */
export function sheetCSV(reference, index = 0) {
  const sheets = Array.isArray(reference?.sheets) ? reference.sheets : [];
  const sheet = sheets[Math.min(count(index), Math.max(0, sheets.length - 1))];
  const safeValue = value => {
    if (typeof value !== 'string') return value;
    return /^[\s\uFEFF]*[=+@\-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  };
  return exportCSV(['sheet', 'address', 'value', 'formula'], sheetCells(sheet).map(cell => [sheet.name, cell.address, cell.value, cell.formula ?? ''].map(safeValue)));
}
