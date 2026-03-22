// ═══════════════════════════════════════════════════════════════
// CSV & Excel file parser
// ═══════════════════════════════════════════════════════════════

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  errors: string[];
}

export function parseCSV(text: string): ParseResult {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0, errors: ['File is empty'] };

  // Parse header
  const headers = parseCsvLine(lines[0]);
  if (headers.length === 0) return { headers: [], rows: [], totalRows: 0, errors: ['No headers found'] };

  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, j) => {
        row[h] = values[j] ?? '';
      });
      rows.push(row);
    } catch {
      errors.push(`Row ${i + 1}: parse error`);
    }
  }

  return { headers, rows, totalRows: rows.length, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  // For Excel files, we read as text if it's actually a CSV with .xlsx extension
  // For real .xlsx, we'd need a library — for now, provide clear error
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || ext === 'tsv') {
    const text = await file.text();
    return parseCSV(ext === 'tsv' ? text.replace(/\t/g, ',') : text);
  }

  // For .xlsx files, attempt to read using basic parsing
  // Real Excel support would require xlsx library
  return {
    headers: [],
    rows: [],
    totalRows: 0,
    errors: ['Excel (.xlsx) files require the xlsx library. Please export as CSV for now, or we can add xlsx support.'],
  };
}
