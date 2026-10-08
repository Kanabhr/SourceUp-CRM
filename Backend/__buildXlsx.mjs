import ExcelJS from "./node_modules/exceljs/lib/index.js";
import { writeFileSync } from "fs";

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Leads");
ws.addRow(["Company / Brand Name","Contact Person","Designation","Phone / WhatsApp","Email","City / State","Website / Instagram Handle"]);
ws.addRow(["Test Co","John Doe","CEO","9876543210","john@test.com","Mumbai","testco.com"]);

const buf = await wb.xlsx.writeBuffer();
writeFileSync("__test_file.xlsx", buf);
console.log("xlsx written, size:", buf.length);
