import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

/**
 * Generate a branded SourceUp India Proforma Invoice PDF from a deal.
 *
 * @param {object} deal      Mongoose lean doc (with leadId + salesRep populated)
 * @param {object} lead      Mongoose lean doc for the linked lead
 * @returns {Promise<Buffer>}
 */
export function generateProformaInvoicePdf(deal, lead) {
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

    // ── Helper: two-column row (label left, value right) ──────────────────
    const rowLine = (label, value, yPos) => {
      doc.fontSize(9).font("Helvetica").fillColor(muted);
      doc.text(label, leftM, yPos, { width: contentW / 2, lineBreak: false });
      doc.fontSize(9).font("Helvetica-Bold").fillColor(brandDark);
      doc.text(String(value), leftM + contentW / 2, yPos, { width: contentW / 2, align: "right", lineBreak: false });
    };

    // ── Header band ──────────────────────────────────────────────────────────
    doc.rect(0, 0, pageW, 90).fill(brandDark);
    doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold");
    doc.text("SourceUp India", leftM, 28);
    doc.fontSize(10).font("Helvetica").fillColor(accent);
    doc.text("Product Sourcing CRM", leftM, 56);
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text("PROFORMA INVOICE", rightM - 180, 32, { width: 180, align: "right", lineBreak: false });

    let y = 110;

    // ── PI meta ────────────────────────────────────────────────────────────
    const genDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    doc.fontSize(10).font("Helvetica").fillColor(muted);
    doc.text(`PI No: ${deal.piNo || deal.dealId || "—"}`, leftM, y, { lineBreak: false });
    doc.fontSize(10).font("Helvetica").fillColor(muted);
    doc.text(`Date: ${genDate}`, rightM - 120, y, { width: 120, align: "right", lineBreak: false });
    y += 18;

    if (deal.quotationNo) {
      doc.fontSize(9).font("Helvetica").fillColor(muted);
      doc.text(`Quotation No: ${deal.quotationNo}`, leftM, y);
      y += 16;
    }
    y += 4;

    doc.moveTo(leftM, y).lineTo(rightM, y).strokeColor(accent).lineWidth(1.5).stroke();
    y += 20;

    // ── Bill To ────────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor(muted);
    doc.text("BILL TO", leftM, y);
    y += 14;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(brandDark);
    doc.text(deal.customerName || lead?.clientName || "—", leftM, y);
    y += 15;
    doc.fontSize(9).font("Helvetica").fillColor("#334155");
    if (lead?.company)      { doc.text(lead.company, leftM, y); y += 13; }
    if (lead?.email)        { doc.text(lead.email, leftM, y); y += 13; }
    if (lead?.phone)        { doc.text(lead.phone, leftM, y); y += 13; }
    if (lead?.productNeeded){ doc.text(`Product: ${lead.productNeeded}`, leftM, y); y += 13; }
    y += 8;

    // ── Sales Rep ──────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor(muted);
    doc.text("SALES REPRESENTATIVE", leftM, y);
    y += 13;
    doc.fontSize(10).font("Helvetica").fillColor("#334155");
    doc.text(deal.salesRep?.username || "—", leftM, y);
    y += 22;

    // ── Item table ─────────────────────────────────────────────────────────
    const tableY = y;
    const colQty   = leftM + 270;
    const colPrice = leftM + 330;
    const colTotal = leftM + 430;

    doc.rect(leftM, tableY, contentW, 24).fill(lightBg);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(muted);
    doc.text("DESCRIPTION",  leftM   + 8, tableY + 7, { lineBreak: false });
    doc.text("QTY",           colQty  + 8, tableY + 7, { lineBreak: false });
    doc.text("UNIT PRICE",    colPrice + 8, tableY + 7, { lineBreak: false });
    doc.text("TOTAL",         colTotal + 8, tableY + 7, { lineBreak: false });
    y = tableY + 24;

    const desc = lead?.productNeeded || "Goods as per quotation";
    doc.rect(leftM, y, contentW, 36).fill("#ffffff");
    doc.fontSize(10).font("Helvetica").fillColor("#334155");
    doc.text(desc, leftM + 8, y + 8, { width: colQty - leftM - 16, lineBreak: false });
    doc.text(String(deal.qty || 0), colQty + 8, y + 8, { lineBreak: false });
    const sym = "\u20B9";
    doc.text(
      `${sym}${Number(deal.sellingPricePerUnit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      colPrice + 8, y + 8, { lineBreak: false }
    );
    const orderTotal = Number(deal.orderValue || (deal.sellingPricePerUnit * deal.qty) || 0);
    doc.font("Helvetica-Bold");
    doc.text(
      `${sym}${orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      colTotal + 8, y + 8, { lineBreak: false }
    );
    y += 36;

    // ── Payment summary ────────────────────────────────────────────────────
    y += 10;
    doc.moveTo(leftM, y).lineTo(rightM, y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    y += 12;

    const summaryLines = [
      { label: "Order Value",       value: `${sym}${orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
      { label: "Advance Received",  value: `${sym}${Number(deal.advance?.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
      { label: "Balance Due",       value: `${sym}${Number(deal.balance?.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
    ];
    if (deal.expectedDelivery) {
      summaryLines.push({ label: "Expected Delivery", value: new Date(deal.expectedDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) });
    }
    if (deal.orderConfirmDate) {
      summaryLines.push({ label: "Order Confirmed", value: new Date(deal.orderConfirmDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) });
    }

    for (const { label, value } of summaryLines) {
      rowLine(label, value, y);
      y += 16;
    }

    // ── Terms ──────────────────────────────────────────────────────────────
    y += 10;
    doc.fontSize(8).font("Helvetica-Oblique").fillColor(muted);
    const termsText =
      "Payment Terms: Advance as agreed, balance payable as per agreed trigger. " +
      "Prices are valid for 30 days from the date of this Proforma Invoice. " +
      "Goods will be dispatched upon confirmation of advance payment.";
    doc.text(termsText, leftM, y, { width: contentW, lineGap: 3 });
    y += doc.heightOfString(termsText, { width: contentW, lineGap: 3 }) + 10;

    // ── Footer (only if content fits — otherwise skip to avoid overlap) ───
    const footerY = pageH - 60;
    if (y < footerY - 10) {
      doc.moveTo(leftM, footerY).lineTo(rightM, footerY).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      doc.fontSize(8).font("Helvetica-Oblique").fillColor(muted);
      doc.text(
        "This is a system-generated Proforma Invoice from SourceUp India CRM. Please confirm all details before making payment.",
        leftM, footerY + 8, { width: contentW, align: "center", lineBreak: false }
      );
    }

    doc.end();
  });
}
