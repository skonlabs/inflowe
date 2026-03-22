/**
 * RFC 4180-compliant CSV parser.
 *
 * Handles:
 *  - Quoted fields (with commas, newlines, and escaped double-quotes inside)
 *  - Multiple delimiters (comma, semicolon, tab — auto-detected)
 *  - Windows and Unix line endings
 *  - Byte-order marks (BOM)
 *  - Leading/trailing whitespace trimming per field
 */

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rawRows: string[][];
  delimiter: ',' | ';' | '\t';
  warnings: string[];
}

/** Detect the most likely delimiter from the header line */
function detectDelimiter(line: string): ',' | ';' | '\t' {
  const counts = {
    ',': (line.match(/,/g) ?? []).length,
    ';': (line.match(/;/g) ?? []).length,
    '\t': (line.match(/\t/g) ?? []).length,
  };
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

/** Parse a single CSV line into fields, respecting quotes */
function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let i = 0;
  let field = '';

  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            // Escaped double-quote
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      // Skip to delimiter or end
      while (i < line.length && line[i] !== delimiter) i++;
    } else if (line[i] === delimiter) {
      fields.push(field.trim());
      field = '';
    } else {
      field += line[i];
    }
    i++;
  }
  fields.push(field.trim()); // last field
  return fields;
}

/**
 * Parse CSV text into headers + rows.
 *
 * @param text  Raw CSV string (UTF-8)
 * @param options.maxRows  Max data rows to parse (default: unlimited)
 */
export function parseCsv(
  text: string,
  options?: { maxRows?: number },
): ParseResult {
  const warnings: string[] = [];

  // Strip BOM
  const cleaned = text.startsWith('\uFEFF') ? text.slice(1) : text;

  // Normalize line endings
  const normalized = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into lines — but we must handle quoted newlines.
  // We'll do a character-by-character split.
  const lines: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      inQuote = !inQuote;
      buf += ch;
    } else if (ch === '\n' && !inQuote) {
      lines.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) lines.push(buf);

  // Filter truly empty lines
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [], rawRows: [], delimiter: ',', warnings: ['File appears empty'] };
  }

  const delimiter = detectDelimiter(nonEmpty[0]);
  const headers   = parseLine(nonEmpty[0], delimiter);

  if (headers.length === 0) {
    warnings.push('Could not detect column headers');
  }

  const maxRows = options?.maxRows ?? Infinity;
  const rawRows: string[][] = [];
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length && rows.length < maxRows; i++) {
    const cells = parseLine(nonEmpty[i], delimiter);

    // Pad or trim to match header count
    while (cells.length < headers.length) cells.push('');

    if (cells.length > headers.length) {
      warnings.push(`Row ${i + 1} has more columns than headers; extra columns ignored`);
    }

    rawRows.push(cells);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    rows.push(obj);
  }

  return { headers, rows, rawRows, delimiter, warnings };
}

/** Parse an ArrayBuffer (from FileReader) as UTF-8 text then CSV */
export async function parseCsvFile(file: File, options?: { maxRows?: number }): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        resolve(parseCsv(text, options));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
}
