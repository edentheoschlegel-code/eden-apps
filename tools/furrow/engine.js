// Furrow web engine — a faithful browser port of winnow/src-tauri/src/lib.rs.
//
// Everything runs in the browser. No network calls anywhere in this file.
// Files never leave the page: they are read with the File API and written back
// as downloads. The behaviour below mirrors the Rust engine command for command
// so the web version and the Mac app agree about what a table is and what each
// operation does — especially column typing, where "007" and long account
// numbers must stay text, not turn into numbers.

/* global XLSX */

// ---------------------------------------------------------------------------
// Reading — CSV/TSV/TXT parsed to preserve exact cell strings; spreadsheets via
// SheetJS with dates rendered ISO 8601, matching the Rust reader.
// ---------------------------------------------------------------------------

const DELIMITED = new Set(["csv", "tsv", "txt"]);
const SPREADSHEET = new Set(["xlsx", "xlsm", "xls", "ods"]);

export function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function stem(name) {
  const base = name.split(/[\\/]/).pop() || name;
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(0, i) : base;
}

export function baseName(path) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function kindOf(name) {
  const e = extOf(name);
  if (e === "csv") return "CSV";
  if (e === "tsv") return "TSV";
  if (e === "txt") return "TXT";
  if (e === "xlsx" || e === "xlsm") return "Excel";
  if (e === "xls") return "Excel (97)";
  if (e === "ods") return "OpenDocument";
  return e ? e.toUpperCase() : "File";
}

// Minimal RFC-4180 delimited parser. Preserves quoting, embedded newlines and
// exact whitespace — the Rust side uses the `csv` crate with flexible rows; this
// mirrors that closely enough that cell strings round-trip unchanged.
function parseDelimited(text, delim) {
  // Strip a leading UTF-8 BOM.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delim) {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    if (c === "\r") {
      // swallow CRLF and lone CR as a row break
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (text[i + 1] === "\n") i += 2;
      else i++;
      continue;
    }
    cell += c;
    i++;
  }
  // trailing cell/row (unless the file ended exactly on a newline)
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function detectDelim(name, text) {
  const e = extOf(name);
  if (e === "tsv") return "\t";
  if (e === "csv") return ",";
  // txt: sniff the header line
  const line = text.slice(0, text.indexOf("\n") >= 0 ? text.indexOf("\n") : text.length);
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

// Excel serial → ISO string. SheetJS gives us JS Dates when cellDates is on;
// we render them the way the Rust reader does (date-only when midnight).
function isoFromDate(d) {
  const pad = (x) => String(x).padStart(2, "0");
  const Y = d.getUTCFullYear();
  const M = pad(d.getUTCMonth() + 1);
  const D = pad(d.getUTCDate());
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  if (h === 0 && m === 0 && s === 0) return `${Y}-${M}-${D}`;
  return `${Y}-${M}-${D} ${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Read a File into an array of { name, table:{headers, rows} } sheets.
async function readSheets(file) {
  const name = file.name;
  const e = extOf(name);
  if (DELIMITED.has(e)) {
    const text = await file.text();
    const delim = detectDelim(name, text);
    const raw = parseDelimited(text, delim);
    if (!raw.length) throw new Error("That file had no readable data.");
    const headers = raw[0];
    const rows = raw.slice(1);
    return [{ name: "Sheet1", table: { headers, rows } }];
  }
  if (SPREADSHEET.has(e)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true, cellNF: false, cellText: false });
    const sheets = [];
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      if (!ws || !ws["!ref"]) continue;
      const aoa = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: true,
        defval: "",
        blankrows: false,
      });
      if (!aoa.length) continue;
      const norm = aoa.map((r) =>
        r.map((v) => {
          if (v === null || v === undefined) return "";
          if (v instanceof Date) return isoFromDate(v);
          return String(v);
        }),
      );
      const headers = norm[0] || [];
      const rows = norm.slice(1);
      if (!headers.length && !rows.length) continue;
      sheets.push({ name: sn, table: { headers, rows } });
    }
    if (!sheets.length) throw new Error("That spreadsheet had no data on any sheet.");
    return sheets;
  }
  throw new Error("Furrow works with CSV and Excel files, so that one was skipped.");
}

// ---------------------------------------------------------------------------
// Column typing — the soul of the app. Mirrors column_kind() in lib.rs.
// ID is checked FIRST: leading-zero or long all-digit strings stay text.
// ---------------------------------------------------------------------------

export function columnKind(values) {
  const seen = values.filter((v) => v != null && String(v).trim() !== "").map(String);
  if (!seen.length) return "empty";

  const allId = seen.every((v) => {
    const t = v.trim();
    const digits = /^[0-9]+$/.test(t);
    return digits && ((t.length > 1 && t.startsWith("0")) || t.length >= 7);
  });
  if (allId) return "id";

  const allNumber = seen.every((v) => {
    const t = v.trim();
    if (t === "") return false;
    const n = Number(t);
    return Number.isFinite(n) && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t);
  });
  if (allNumber) return "number";

  const allDate = seen.every((v) => {
    const t = v.trim();
    return (
      (t.length === 10 || t.length === 19) &&
      /^\d{4}-\d{2}-\d{2}/.test(t)
    );
  });
  if (allDate) return "date";

  return "text";
}

// classify a single cell for xlsx writing — mirrors classify() in lib.rs.
function isNumericButNotId(s) {
  if (s.trim() !== s) return false;
  let body = s.startsWith("-") ? s.slice(1) : s;
  if (body.startsWith("+")) return false;
  if (body.length >= 2 && body[0] === "0" && /[0-9]/.test(body[1])) return false;
  if (body.length > 15 && /^[0-9]+$/.test(body)) return false;
  return true;
}

function classify(s) {
  if (s === "") return { t: "text" };
  if (s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00Z");
    if (!isNaN(d)) return { t: "date", v: s };
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s)) {
    return { t: "datetime", v: s };
  }
  if (isNumericButNotId(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return { t: "number", v: n };
  }
  return { t: "text" };
}

// ---------------------------------------------------------------------------
// Writing — CSV text and xlsx bytes (via SheetJS), preserving cell types.
// ---------------------------------------------------------------------------

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function tableToCsv(table) {
  const lines = [];
  lines.push(table.headers.map(csvEscape).join(","));
  for (const row of table.rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\r\n") + "\r\n";
}

function safeSheetName(name, used) {
  let cleaned = String(name).replace(/[[\]:*?/\\]/g, "-").trim().slice(0, 31);
  if (!cleaned) cleaned = "Sheet";
  let candidate = cleaned;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = cleaned.slice(0, 31 - suffix.length) + suffix;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// Build an xlsx workbook (as a Blob) from typed sheets.
export function sheetsToXlsxBlob(sheets) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  for (const sh of sheets) {
    const name = safeSheetName(sh.name, used);
    const data = [sh.table.headers.slice()];
    for (const row of sh.table.rows) {
      data.push(
        row.map((val) => {
          const c = classify(String(val ?? ""));
          if (c.t === "number") return c.v;
          if (c.t === "date" || c.t === "datetime") {
            const iso = c.v.replace(" ", "T");
            const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso + "Z");
            return d;
          }
          return String(val ?? "");
        }),
      );
    }
    const ws = XLSX.utils.aoa_to_sheet(data, { cellDates: true, dateNF: "yyyy-mm-dd" });
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ---------------------------------------------------------------------------
// Column description + preview + recipe steps
// ---------------------------------------------------------------------------

export function describeColumns(table) {
  return table.headers.map((name, ci) => {
    const values = table.rows.map((r) => r[ci] ?? "");
    const blanks = values.filter((v) => String(v).trim() === "").length;
    return { name, kind: columnKind(values), blanks };
  });
}

function columnIndex(headers, name) {
  return headers.indexOf(name);
}

// The single source of truth for applying a recipe — preview and save both call
// this, so what you see is exactly what saves. Mirrors apply_steps() in lib.rs.
export function applySteps(table, steps) {
  const outcomes = [];
  const headers = table.headers;
  for (const step of steps) {
    if (step.kind === "trim") {
      const i = columnIndex(headers, step.column);
      if (i < 0) {
        outcomes.push({ kind: "missing" });
        continue;
      }
      let changed = 0;
      for (const row of table.rows) {
        if (i < row.length) {
          const trimmed = String(row[i]).trim();
          if (trimmed !== row[i]) {
            row[i] = trimmed;
            changed++;
          }
        }
      }
      outcomes.push({ kind: "changed", n: changed });
    }
  }
  return outcomes;
}

function describeOutcome(step, outcome) {
  if (step.kind === "trim") {
    if (outcome.kind === "missing") return `Skipped "${step.column}": that column isn't in this sheet`;
    if (outcome.n === 0) return `"${step.column}" was already tidy, no spaces to trim`;
    if (outcome.n === 1) return `Trimmed spaces in "${step.column}" (1 cell)`;
    return `Trimmed spaces in "${step.column}" (${outcome.n} cells)`;
  }
  return "";
}

function cloneTable(t) {
  return { headers: t.headers.slice(), rows: t.rows.map((r) => r.slice()) };
}

// ---------------------------------------------------------------------------
// The engine: one object per open file, keyed by the display name ("path").
// The UI calls these the same way it called the Rust commands.
// ---------------------------------------------------------------------------

export class FurrowEngine {
  constructor() {
    this.files = new Map(); // name -> File
  }

  register(file) {
    this.files.get(file.name); // no-op read to keep lints quiet
    this.files.set(file.name, file);
  }

  has(name) {
    return this.files.has(name);
  }

  forget(name) {
    this.files.delete(name);
  }

  _file(path) {
    const f = this.files.get(path);
    if (!f) throw new Error("That file is no longer open.");
    return f;
  }

  async analyze(path) {
    const sheets = await readSheets(this._file(path));
    const rows = sheets.reduce((a, s) => a + s.table.rows.length, 0);
    const cols = sheets[0] ? sheets[0].table.headers.length : 0;
    return { path, kind: kindOf(path), rows, cols, sheets: sheets.length };
  }

  async previewTable(path, sheetName, limit, steps) {
    const sheets = await readSheets(this._file(path));
    const sheetNames = sheets.map((s) => s.name);
    const chosen =
      (sheetName && sheets.find((s) => s.name === sheetName)) || sheets[0];
    const work = cloneTable(chosen.table);
    if (steps && steps.length) applySteps(work, steps);
    const columns = describeColumns(work);
    const total = work.rows.length;
    const shown = Math.min(limit || 200, total);
    return {
      sheet: chosen.name,
      sheets: sheetNames,
      columns,
      rows: work.rows.slice(0, shown),
      total_rows: total,
      shown,
    };
  }

  // Returns { files:[{name, blob}], rows } — the caller triggers downloads.
  async split(path, rowsPerFile) {
    if (rowsPerFile < 1) throw new Error("Choose at least 1 row per file.");
    const sheets = await readSheets(this._file(path));
    const multi = sheets.length > 1;
    const name = stem(path);
    const out = [];
    let total = 0;
    for (const sh of sheets) {
      total += sh.table.rows.length;
      const chunks = Math.max(1, Math.ceil(sh.table.rows.length / rowsPerFile));
      for (let i = 0; i < chunks; i++) {
        const slice = sh.table.rows.slice(i * rowsPerFile, (i + 1) * rowsPerFile);
        const fname = multi
          ? `${name} (${sh.name}) (part ${i + 1}).csv`
          : `${name} (part ${i + 1}).csv`;
        const csv = tableToCsv({ headers: sh.table.headers, rows: slice });
        out.push({ name: fname, blob: new Blob([csv], { type: "text/csv" }) });
      }
    }
    return { files: out, rows: total };
  }

  async convert(path, to) {
    const sheets = await readSheets(this._file(path));
    const rows = sheets.reduce((a, s) => a + s.table.rows.length, 0);
    const name = stem(path);
    const multi = sheets.length > 1;
    if (to === "xlsx") {
      const blob = sheetsToXlsxBlob(sheets);
      const out = `${name}.xlsx`;
      const note = multi ? `Kept all ${sheets.length} sheets` : null;
      return { files: [{ name: out, blob }], output: out, rows, removed: 0, note };
    }
    if (to === "csv") {
      const files = [];
      for (const sh of sheets) {
        const fname = multi ? `${name} (${sh.name}).csv` : `${name}.csv`;
        files.push({ name: fname, blob: new Blob([tableToCsv(sh.table)], { type: "text/csv" }) });
      }
      const note = multi ? `${sheets.length} sheets → ${files.length} CSV files` : null;
      return { files, output: files[0]?.name || "", rows, removed: 0, note };
    }
    throw new Error(`Can't convert to .${to} yet.`);
  }

  async dedup(path) {
    const sheets = await readSheets(this._file(path));
    const multi = sheets.length > 1;
    const name = stem(path);
    const files = [];
    let keptTotal = 0;
    let removedTotal = 0;
    for (const sh of sheets) {
      const before = sh.table.rows.length;
      const seen = new Set();
      const kept = [];
      for (const row of sh.table.rows) {
        const key = row.join("");
        if (!seen.has(key)) {
          seen.add(key);
          kept.push(row);
        }
      }
      removedTotal += before - kept.length;
      keptTotal += kept.length;
      const fname = multi ? `${name} (${sh.name}) (deduped).csv` : `${name} (deduped).csv`;
      const csv = tableToCsv({ headers: sh.table.headers, rows: kept });
      files.push({ name: fname, blob: new Blob([csv], { type: "text/csv" }) });
    }
    const note = multi ? `Cleaned ${files.length} sheets` : null;
    return { files, output: files[0]?.name || "", rows: keptTotal, removed: removedTotal, note };
  }

  async merge(paths) {
    if (paths.length < 2) throw new Error("Pick at least two files to merge.");
    let canonical = null;
    const merged = [];
    for (const p of paths) {
      const sheets = await readSheets(this._file(p));
      const multi = sheets.length > 1;
      for (const sh of sheets) {
        const label = multi ? `${p} (sheet "${sh.name}")` : p;
        // duplicate header guard
        const seen = new Set();
        for (const h of sh.table.headers) {
          if (seen.has(h)) {
            throw new Error(
              `${label} has two columns both named "${h}", so merging can't tell them apart. Nothing was written. Rename one, then merge.`,
            );
          }
          seen.add(h);
        }
        if (!canonical) {
          canonical = sh.table.headers.slice();
          merged.push(...sh.table.rows.map((r) => r.slice()));
        } else {
          const aligned = alignTo(canonical, sh.table, label);
          merged.push(...aligned);
        }
      }
    }
    const csv = tableToCsv({ headers: canonical, rows: merged });
    const out = "Merged.csv";
    return {
      files: [{ name: out, blob: new Blob([csv], { type: "text/csv" }) }],
      output: out,
      rows: merged.length,
    };
  }

  async applyAndSave(path, sheetName, steps) {
    const sheets = await readSheets(this._file(path));
    const chosen = (sheetName && sheets.find((s) => s.name === sheetName)) || sheets[0];
    const work = cloneTable(chosen.table);
    const outcomes = applySteps(work, steps);
    const labels = steps.map((s, i) => describeOutcome(s, outcomes[i]));
    const name = stem(path);
    const out = `${name} (cleaned).csv`;
    const csv = tableToCsv(work);
    return {
      files: [{ name: out, blob: new Blob([csv], { type: "text/csv" }) }],
      output: out,
      rows: work.rows.length,
      steps: labels,
    };
  }
}

function alignTo(canonical, table, label) {
  if (arraysEqual(canonical, table.headers)) return table.rows.map((r) => r.slice());
  const want = new Set(canonical);
  const have = new Set(table.headers);
  if (want.size !== have.size || [...want].some((h) => !have.has(h))) {
    throw new Error(
      `${label} has different columns, so merging would misalign the rows. Nothing was written. Line the headers up first, then merge.`,
    );
  }
  const order = canonical.map((h) => table.headers.indexOf(h));
  return table.rows.map((row) => order.map((i) => row[i] ?? ""));
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Sample spreadsheet — mirrors the bundled sample the Mac app opens on first run.
export function sampleFile() {
  const csv = [
    "Order ID,Customer,Zip,Amount,Ordered,Notes",
    '00123,Ada Lovelace,01003,  84.50  ,2026-01-04,  first order ',
    '00124,Grace Hopper,90210,120.00,2026-01-05,rush',
    '00124,Grace Hopper,90210,120.00,2026-01-05,rush',
    '00125,Katherine Johnson,20706,  36.00,2026-01-06, gift wrap ',
    '00126,Ada Lovelace,01003,15.75,2026-01-07,',
  ].join("\n");
  return new File([csv], "Sample orders.csv", { type: "text/csv" });
}
