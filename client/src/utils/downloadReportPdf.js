import { jsPDF } from "jspdf";

function lines(doc, text, x, y, maxWidth, lineHeight = 6) {
  const parts = doc.splitTextToSize(String(text || ""), maxWidth);
  doc.text(parts, x, y);
  return y + parts.length * lineHeight;
}

function textFrom(value, fallback = "") {
  if (value == null) return fallback;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map((item) => textFrom(item)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const preferred = value.title || value.area || value.category || value.action || value.description || value.summary || value.text || value.value;
    if (preferred && preferred !== value) return textFrom(preferred);
    return Object.entries(value)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${textFrom(val)}`)
      .join("; ");
  }
  return fallback;
}

function listFrom(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => textFrom(item)).filter(Boolean);
}

/**
 * Generate and download a PDF interview report from report + answers data.
 */
export function downloadReportPdf({ report, answers = [], candidateName = "Candidate", role = "" }) {
  const details = report?.report_json ?? report ?? {};
  const chart = details.chartData ?? {};
  const overall = Math.round(Number(report?.overall_score ?? details.overall_score ?? 0));
  const technical = Math.round(Number(report?.technical_score ?? details.technical_score ?? 0));
  const communication = Math.round(Number(report?.communication_score ?? details.communication_score ?? 0));
  const confidence = Math.round(Number(report?.confidence_score ?? details.confidence_score ?? 0));
  const resume = Math.round(Number(report?.resume_relevance_score ?? details.resume_relevance_score ?? 0));

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 20;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Interview Performance Report", margin, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  y = lines(doc, `Candidate: ${candidateName}`, margin, y, width);
  y = lines(doc, `Role: ${role || "—"}`, margin, y, width);
  y = lines(doc, `Date: ${new Date().toLocaleDateString()}`, margin, y, width);
  y += 6;

  doc.setTextColor(0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Overall Score: ${overall}/100`, margin, y);
  y += 12;

  doc.setFontSize(12);
  const scores = [
    ["Technical", technical],
    ["Communication", communication],
    ["Confidence", confidence],
    ["Resume relevance", resume],
  ];
  scores.forEach(([label, val]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${val}/100`, margin + 55, y);
    y += 7;
  });
  y += 4;

  const strengths = listFrom(report?.strengths ?? details.strengths);
  if (strengths.length) {
    doc.setFont("helvetica", "bold");
    doc.text("Strengths", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    strengths.slice(0, 6).forEach((s) => {
      y = lines(doc, `• ${s}`, margin, y, width);
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    y += 4;
  }

  const weakAreas = listFrom(report?.weak_areas ?? details.weak_areas);
  if (weakAreas.length) {
    doc.setFont("helvetica", "bold");
    doc.text("Areas to improve", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    weakAreas.slice(0, 6).forEach((s) => {
      y = lines(doc, `• ${s}`, margin, y, width);
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    y += 4;
  }

  const barScores = chart.barChartData?.scores ?? answers.map((a) => Math.round(Number(a.score) || 0));
  if (barScores.length) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Per-question scores", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    barScores.forEach((score, i) => {
      y = lines(doc, `Question ${i + 1}: ${score}/100`, margin, y, width);
    });
    y += 4;
  }

  const summary = textFrom(details.technical_reasoning_summary ?? details.key_takeaway);
  if (summary) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text("AI evaluation summary", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    y = lines(doc, summary, margin, y, width);
  }

  doc.save(`interview-report-${overall}-score.pdf`);
}
