#!/usr/bin/env node
/**
 * Read saved SIS JSON from data/ and generate a simple HTML summary to output/.
 * Usage:
 *   node scripts/renderSisHtml.js --term 1258 --subject MATH [--page 1]
 *   node scripts/renderSisHtml.js --term 1258 --subject CS [--page 1]
 */

const fs = require('fs');
const path = require('path');

function getArg(name, defaultValue = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

function loadData({ term, subject, page }) {
  const dataDir = path.join(process.cwd(), 'data');
  const filename = `term-${term}-subject-${subject}-page-${page}.json`;
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filePath}`);
  }
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return json;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function meetingSummary(meeting) {
  const days = meeting?.days || 'TBA';
  const start = meeting?.start_time || 'TBA';
  const end = meeting?.end_time || 'TBA';
  return `${days} ${start && end ? `${start} - ${end}` : ''}`.trim();
}

function renderHtml({ term, subject, page, classes }) {
  const rows = classes.map(cls => {
    const raw = cls.raw || {};
    const instructorName = raw?.instructors?.[0]?.name || 'TBA';
    const meeting = raw?.meetings?.[0] || {};
    const when = meetingSummary(meeting);
    const enrolled = Number(cls.enrollment_total ?? 0);
    const cap = Number(cls.class_capacity ?? 0);
    const title = raw?.descr || `${cls.subject} ${cls.catalog_nbr}`;
    const type = cls.component || cls.section_type || raw?.component || raw?.section_type || '';
    return `
      <tr>
        <td>${escapeHtml(String(cls.class_nbr || ''))}</td>
        <td>${escapeHtml(String(cls.subject || ''))} ${escapeHtml(String(cls.catalog_nbr || ''))}</td>
        <td>${escapeHtml(title)}</td>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(instructorName)}</td>
        <td>${escapeHtml(when)}</td>
        <td>${enrolled} / ${cap}</td>
      </tr>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UVA SIS Classes ${escapeHtml(subject)} ${escapeHtml(term)} p${escapeHtml(page)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    .muted { color: #6b7280; }
  </style>
  </head>
<body>
  <h1>Classes for ${escapeHtml(subject)} — Term ${escapeHtml(term)} — Page ${escapeHtml(page)}</h1>
  <p class="muted">${classes.length} classes</p>
  <table>
    <thead>
      <tr>
        <th>Class #</th>
        <th>Course</th>
        <th>Title</th>
        <th>Type</th>
        <th>Instructor</th>
        <th>When</th>
        <th>Enrolled / Cap</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
  return html;
}

function saveHtml(content, { term, subject, page }) {
  const outDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const filename = `term-${term}-subject-${subject}-page-${page}.html`;
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, content, 'utf-8');
  return outPath;
}

function main() {
  const term = getArg('term', process.env.TERM || '1258');
  const subject = getArg('subject', process.env.SUBJECT || 'MATH');
  const page = Number(getArg('page', process.env.PAGE || '1'));

  const data = loadData({ term, subject, page });
  const html = renderHtml(data);
  const outPath = saveHtml(html, { term, subject, page });
  console.error(`Saved HTML to ${outPath}`);
}

main();

