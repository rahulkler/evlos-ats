import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
}

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += `
${pageText}`;
  }

  return text.trim();
}

export async function extractTextFromDocx(file) {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}

export async function extractTextFromTxt(file) {
  return (await file.text()).trim();
}

export async function extractCvText(file) {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".pdf")) return extractTextFromPdf(file);
  if (lower.endsWith(".docx")) return extractTextFromDocx(file);
  if (lower.endsWith(".txt")) return extractTextFromTxt(file);

  throw new Error(`Unsupported file format for ${file.name}. Use PDF, DOCX, or TXT.`);
}

export async function filesToCandidatePayload(files) {
  const result = [];

  for (const file of files) {
    const text = await extractCvText(file);
    result.push({
      fileName: file.name,
      text: text.slice(0, 50000)
    });
  }

  return result;
}