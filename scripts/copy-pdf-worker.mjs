import fs from "node:fs";
import path from "node:path";

const src = path.resolve("node_modules/pdfjs-dist/build/pdf.worker.mjs");
const destDir = path.resolve("public");
const dest = path.resolve("public/pdf.worker.mjs");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);

console.log("Copied pdf.worker.mjs to public/");