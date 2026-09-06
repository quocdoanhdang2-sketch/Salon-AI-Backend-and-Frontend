// tools/check_frontend.js — Kiểm tra tĩnh frontend: cân bằng thẻ HTML + cú pháp JS
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'Code Salon AI Frontend');
const TAGS = ['div', 'section', 'form', 'button', 'span', 'header', 'footer', 'ul', 'li', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'p', 'a', 'select', 'canvas', 'video'];

let failed = false;
for (const page of ['index.html', 'dich-vu.html']) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const problems = [];
  for (const tag of TAGS) {
    const openRe = new RegExp(`<${tag}(?=\\s|>)`, 'gi');
    const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
    const open = (html.match(openRe) || []).length;
    const close = (html.match(closeRe) || []).length;
    if (open !== close) problems.push(`<${tag}> mở/đóng: ${open}/${close}`);
  }
  if (problems.length) {
    failed = true;
    console.log(`${page} — LỆCH THẺ: ${problems.join(', ')}`);
  } else {
    console.log(`${page} — cân bằng thẻ OK`);
  }
}

for (const js of ['script.js', 'cv-hair-engine.js']) {
  try {
    new Function(fs.readFileSync(path.join(ROOT, js), 'utf8'));
    console.log(`${js} — cú pháp OK`);
  } catch (e) {
    failed = true;
    console.log(`${js} — LỖI CÚ PHÁP: ${e.message}`);
  }
}

process.exit(failed ? 1 : 0);
