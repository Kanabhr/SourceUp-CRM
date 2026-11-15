import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

/**
 * Generate a branded SourceUp India quotation PDF and return it as a Buffer.
 *
 * @param {object} quotation  Mongoose lean doc (with leadId populated)
 * @param {object} lead       Mongoose lean doc for the linked lead
 * @returns {Promise<Buffer>}
 */
export function generateQuotationPdf(quotation, lead) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = new PassThrough();
    const chunks = [];

    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    doc.pipe(stream);

    const pageW = 595.28;
    const pageH = 841.89;
    const leftM = 50;
    const rightM = pageW - 50;
    const contentW = rightM - leftM;

    const brandDark = "#0d1b2a";
    const accent = "#2dd4bf";
    const muted = "#64748b";
    const lightBg = "#f1f5f9";

    let y = 50;

    // ── Header band ──────────────────────────────────────────────────────────
    doc.rect(0, 0, pageW, 90).fill(brandDark);
    doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold");
    doc.text("SourceUp India", leftM, 28);
    doc.fontSize(10).font("Helvetica").fillColor(accent);
    doc.text("Product Sourcing CRM", leftM, 56);

    y = 110;

    // ── Title ────────────────────────────────────────────────────────────────
    doc.fontSize(16).font("Helvetica-Bold").fillColor(brandDark);
    doc.text("QUOTATION", leftM, y);
    y += 24;

    // ── Meta (ID + date) — side by side using explicit x coords ─────────────
    const genDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    doc.fontSize(10).font("Helvetica").fillColor(muted);
    doc.text(`Quotation ID: ${quotation.quotationId || quotation._id}`, leftM, y, { lineBreak: false });
    doc.text(`Date: ${genDate}`, rightM - 120, y, { width: 120, align: "right", lineBreak: false });
    y += 20;

    doc.moveTo(leftM, y).lineTo(rightM, y).strokeColor(accent).lineWidth(1.5).stroke();
    y += 20;

    // ── Bill To ──────────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor(muted);
    doc.text("BILL TO", leftM, y);
    y += 14;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(brandDark);
    doc.text(lead?.clientName || "—", leftM, y);
    y += 15;
    doc.fontSize(9).font("Helvetica").fillColor("#334155");
    if (lead?.company)       { doc.text(lead.company, leftM, y); y += 13; }
    if (lead?.email)         { doc.text(lead.email, leftM, y); y += 13; }
    if (lead?.phone)         { doc.text(lead.phone, leftM, y); y += 13; }
    if (lead?.productNeeded) { doc.text(`Product Needed: ${lead.productNeeded}`, leftM, y); y += 13; }
    y += 8;

    // ── Vendor ───────────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor(muted);
    doc.text("VENDOR / SUPPLIER", leftM, y);
    y += 14;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(brandDark);
    doc.text(quotation.vendorName || quotation.vendorRef?.companyName || "—", leftM, y);
    y += 22;

    // ── Item table ────────────────────────────────────────────────────────────
    const tableY = y;
    const colProduct  = leftM;
    const colPrice    = leftM + 270;
    const colCurrency = leftM + 370;
    const colTotal    = leftM + 430;

    doc.rect(leftM, tableY, contentW, 24).fill(lightBg);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(muted);
    doc.text("PRODUCT / SERVICE", colProduct  + 8, tableY + 7, { lineBreak: false });
    doc.text("PRICE",             colPrice    + 8, tableY + 7, { lineBreak: false });
    doc.text("CURR.",             colCurrency + 8, tableY + 7, { lineBreak: false });
    doc.text("TOTAL",             colTotal    + 8, tableY + 7, { lineBreak: false });
    y = tableY + 24;

    doc.rect(leftM, y, contentW, 40).fill("#ffffff");
    doc.fontSize(10).font("Helvetica").fillColor("#334155");
    doc.text(quotation.product || "—", colProduct + 8, y + 8, { width: colPrice - colProduct - 16, lineBreak: false });

    const sym = quotation.currency === "INR" ? "\u20B9" : quotation.currency === "CNY" ? "\u00A5" : "$";
    doc.text(
      `${sym}${Number(quotation.price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      colPrice + 8, y + 8, { lineBreak: false }
    );
    doc.text(quotation.currency || "INR", colCurrency + 8, y + 8, { lineBreak: false });

    const totalVal = Number(quotation.price || 0) * Number(quotation.exchangeRate || 1);
    doc.font("Helvetica-Bold");
    doc.text(
      `${sym}${totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      colTotal + 8, y + 8, { lineBreak: false }
    );
    y += 40;

    // Exchange rate note
    if (quotation.exchangeRate && Number(quotation.exchangeRate) !== 1) {
      doc.fontSize(8).font("Helvetica-Oblique").fillColor(muted);
      doc.text(
        `Exchange rate applied: ${quotation.exchangeRate} (${quotation.currency} \u2192 INR equivalent shown)`,
        leftM, y
      );
      y += 14;
    }
    y += 16;

    // ── Validity ──────────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor(muted);
    doc.text("VALID UNTIL", leftM, y);
    y += 13;
    doc.fontSize(10).font("Helvetica").fillColor("#334155");
    const valDate = quotation.validity
      ? new Date(quotation.validity).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "—";
    doc.text(valDate, leftM, y);
    y += 22;

    // ── Terms & Conditions ────────────────────────────────────────────────────
    if (quotation.terms && quotation.terms.trim()) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(muted);
      doc.text("TERMS & CONDITIONS", leftM, y);
      y += 14;
      doc.fontSize(9).font("Helvetica").fillColor("#334155");
      const termsText = quotation.terms.trim();
      doc.text(termsText, leftM, y, { width: contentW, lineGap: 3 });
      y += doc.heightOfString(termsText, { width: contentW, lineGap: 3 }) + 16;
    }

    // ── Footer — only drawn if content fits above it ──────────────────────────
    const footerY = pageH - 60;
    if (y < footerY - 10) {
      doc.moveTo(leftM, footerY).lineTo(rightM, footerY).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      doc.fontSize(8).font("Helvetica-Oblique").fillColor(muted);
      doc.text(
        "This is a system-generated quotation from SourceUp India CRM. Prices are subject to confirmation and validity date mentioned above.",
        leftM, footerY + 8,
        { width: contentW, align: "center", lineBreak: false }
      );
    }

    doc.end();
  });
}
