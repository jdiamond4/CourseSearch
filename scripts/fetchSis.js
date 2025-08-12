#!/usr/bin/env node
/**
 * Fetch UVA SIS class search JSON via a headless browser (Playwright).
 * Usage:
 *   node scripts/fetchSis.js --term 1258 --subject CS [--page 1]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function getArg(name, defaultValue = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

function buildUrl({ term, subject, page }) {
  const base = 'https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch';
  const params = new URLSearchParams({
    institution: 'UVA01',
    term,
    subject,
    page: String(page)
  });
  return `${base}?${params.toString()}`;
}

function normalizeClass(item) {
  const classNbr = item?.class_nbr ?? item?.classNbr ?? item?.classNumber;
  const subject = item?.subject ?? item?.subject_code ?? item?.subjectCode;
  const catalogNbr = item?.catalog_nbr ?? item?.catalogNbr ?? item?.courseNumber;
  const capacity = item?.class_capacity ?? item?.capacity ?? item?.enrollment_cap;
  const enrolled = item?.enrollment_total ?? item?.enrolled ?? item?.enrollment;
  const available = item?.enrollment_available ?? item?.available ?? (capacity != null && enrolled != null ? capacity - enrolled : undefined);
  const component = item?.component ?? item?.section_type ?? null; // e.g., LEC, LAB, DIS, IND, SEM, PRA
  const sectionType = item?.section_type ?? item?.component ?? null;

  return {
    class_nbr: classNbr ?? null,
    subject: subject ?? null,
    catalog_nbr: catalogNbr ?? null,
    class_capacity: capacity ?? null,
    enrollment_total: enrolled ?? null,
    enrollment_available: available ?? null,
    component: component,
    section_type: sectionType,
    raw: item
  };
}

async function main() {
  const term = getArg('term', process.env.TERM || '1258');
  const subject = getArg('subject', process.env.SUBJECT || 'CS');
  const page = Number(getArg('page', process.env.PAGE || '1'));
  const shouldSave = (getArg('save', process.env.SAVE || 'true') || 'true').toString().toLowerCase() !== 'false';

  if (!term || !subject) {
    console.error('Missing required arguments: --term and --subject');
    process.exit(1);
  }

  const url = buildUrl({ term, subject, page });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const pageObj = await context.newPage();

  let result;
  try {
    const response = await pageObj.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!response) {
      throw new Error('No response received');
    }
    const status = response.status();
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status}`);
    }
    const body = await response.text();
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      throw new Error('Failed to parse JSON from response');
    }

    const classes = Array.isArray(json?.classes) ? json.classes : Array.isArray(json) ? json : [];
    const normalized = classes.map(normalizeClass);
    result = { term, subject, page, classes: normalized, fetched_at: new Date().toISOString() };
  } catch (err) {
    console.error(`Fetch failed: ${err.message}`);
    result = { term, subject, page, error: err.message };
  } finally {
    await browser.close();
  }

  if (shouldSave) {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const fileBase = `term-${term}-subject-${subject}-page-${page}.json`;
      const outPath = path.join(dataDir, fileBase);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.error(`Saved JSON to ${outPath}`);
    } catch (e) {
      console.error(`Failed to save JSON: ${e.message}`);
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main();

