/**
 * Excel / XLSX parser
 *
 * Converts .xlsx and .xls files into the same ParseResult shape as csv-parser.ts,
 * so the rest of the ingestion pipeline (mapping engine, FieldMappingReview, etc.)
 * works identically for both formats.
 *
 * Uses SheetJS (xlsx) which handles:
 *  - .xlsx (Office Open XML)
 *  - .xls (BIFF8 legacy)
 *  - .ods (OpenDocument Spreadsheet)
 *  - Excel serial dates → JS Date objects
 *  - Multi-sheet workbooks (first sheet used by default)
 */

import * as XLSX from 'xlsx';
import type { ParseResult } from './csv-parser';

export interface ExcelParseOptions {
  /** Which sheet to parse. Defaults to first sheet. */
  sheetName?: string;
  /** Max data rows to read (not counting header). Default: unlimited. */
  maxRows?: number;
  /**
   * How to handle dates. 'string' preserves Excel's display format (default),
   * 'iso' converts to YYYY-MM-DD strings.
   */
  dateFormat?: 'string' | 'iso';
}

/**
 * Parse an Excel file (ArrayBuffer or File) into the standard ParseResult.
 */
export async function parseExcelFile(
  input: File | ArrayBuffer,
  options: ExcelParseOptions = {},
): Promise<ParseResult> {
  const { sheetName, maxRows, dateFormat = 'string' } = options;

  // Read the workbook
  let workbook: XLSX.WorkBook;
  if (input instanceof File) {
    const buffer = await input.arrayBuffer();
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: dateFormat === 'iso',
      dateNF: 'YYYY-MM-DD',
    });
  } else {
    workbook = XLSX.read(input, {
      type: 'array',
      cellDates: dateFormat === 'iso',
      dateNF: 'YYYY-MM-DD',
    });
  }

  const warnings: string[] = [];

  // Pick sheet
  const availableSheets = workbook.SheetNames;
  let targetSheet = sheetName ?? availableSheets[0];

  if (!targetSheet) {
    return { headers: [], rows: [], rawRows: [], delimiter: ',', warnings: ['Workbook contains no sheets'] };
  }

  if (sheetName && !availableSheets.includes(sheetName)) {
    warnings.push(`Sheet "${sheetName}" not found. Using "${availableSheets[0]}" instead.`);
    targetSheet = availableSheets[0];
  }

  if (availableSheets.length > 1) {
    warnings.push(`Workbook has ${availableSheets.length} sheets. Importing from "${targetSheet}".`);
  }

  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) {
    return { headers: [], rows: [], rawRows: [], delimiter: ',', warnings: ['Selected sheet is empty'] };
  }

  // Convert sheet to array of arrays (raw cells)
  const rawMatrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,         // return array-of-arrays
    defval: '',        // fill empty cells with empty string
    blankrows: false,  // skip completely blank rows
  });

  if (rawMatrix.length === 0) {
    return { headers: [], rows: [], rawRows: [], delimiter: ',', warnings: ['Sheet appears empty'] };
  }

  // First row = headers
  const headerRow = rawMatrix[0] as unknown[];
  const headers: string[] = headerRow.map((h, i) => {
    const s = formatCell(h).trim();
    return s || `Column_${i + 1}`;
  });

  // Deduplicate headers (Excel sometimes has duplicates)
  const headerCounts: Record<string, number> = {};
  const deduped: string[] = headers.map(h => {
    headerCounts[h] = (headerCounts[h] ?? 0) + 1;
    return headerCounts[h] > 1 ? `${h}_${headerCounts[h]}` : h;
  });

  // Data rows
  const limit = maxRows ?? Infinity;
  const rawRows: string[][] = [];
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < rawMatrix.length && rows.length < limit; i++) {
    const rawRow = rawMatrix[i] as unknown[];
    const cells = deduped.map((_, colIdx) => formatCell(rawRow[colIdx]));

    // Skip completely empty rows
    if (cells.every(c => c === '')) continue;

    rawRows.push(cells);
    const obj: Record<string, string> = {};
    deduped.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    rows.push(obj);
  }

  if (rows.length === 0) {
    warnings.push('No data rows found (only headers detected)');
  }

  return { headers: deduped, rows, rawRows, delimiter: ',', warnings };
}

/** Format any Excel cell value as a plain string */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Format as YYYY-MM-DD
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    // Avoid scientific notation for large numbers
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  }
  return String(value).trim();
}

/** Return true if a file extension / MIME type indicates Excel */
export function isExcelFile(file: File): boolean {
  return (
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.name.endsWith('.ods') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.oasis.opendocument.spreadsheet'
  );
}

/** Return a list of sheet names from an Excel file */
export async function getSheetNames(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', bookSheets: true });
  return wb.SheetNames;
}
