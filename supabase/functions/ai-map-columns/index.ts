/**
 * ai-map-columns Edge Function
 *
 * Uses Claude AI to suggest canonical field mappings for ambiguous or
 * low-confidence column names that the rule-based engine couldn't resolve.
 *
 * Called client-side via supabase.functions.invoke('ai-map-columns')
 * only for columns where confidence === 'low' or suggestedField === null.
 *
 * Request body:
 *  {
 *    columns: Array<{
 *      sourceColumn: string;
 *      sampleValues: string[];
 *      currentSuggestion: string | null;
 *    }>
 *  }
 *
 * Response:
 *  {
 *    suggestions: Array<{
 *      sourceColumn: string;
 *      suggestedField: string | null;
 *      confidence: 'high' | 'medium' | 'low';
 *      reasoning: string;
 *    }>
 *  }
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CANONICAL_FIELDS = [
  'invoice_number',
  'client_name',
  'contact_name',
  'contact_email',
  'contact_phone',
  'issue_date',
  'due_date',
  'amount',
  'amount_paid',
  'remaining_balance',
  'currency',
  'status',
  'payment_terms',
  'notes',
  'ignore',
] as const;

const FIELD_DESCRIPTIONS: Record<string, string> = {
  invoice_number:    'Unique identifier for the invoice (e.g. INV-001)',
  client_name:       'Name of the client, customer, or company being billed',
  contact_name:      'Name of the billing contact person',
  contact_email:     'Email address of the billing contact',
  contact_phone:     'Phone number of the contact',
  issue_date:        'Date the invoice was issued or created',
  due_date:          'Date by which payment is due',
  amount:            'Total invoice amount (gross amount before any payments)',
  amount_paid:       'Amount already received from the client',
  remaining_balance: 'Outstanding balance still owed',
  currency:          'Currency code (e.g. USD, GBP, EUR)',
  status:            'Current status of the invoice (paid, unpaid, overdue, etc.)',
  payment_terms:     'Payment terms such as Net 30, Net 60',
  notes:             'Additional notes, memo, or description',
  ignore:            'This column is not relevant and should be ignored',
};

function buildPrompt(columns: Array<{ sourceColumn: string; sampleValues: string[]; currentSuggestion: string | null }>): string {
  const fieldList = CANONICAL_FIELDS.map(f => `  - ${f}: ${FIELD_DESCRIPTIONS[f]}`).join('\n');

  const columnList = columns.map(c => {
    const samples = c.sampleValues.slice(0, 5).filter(Boolean);
    return `Column: "${c.sourceColumn}"
Sample values: ${samples.length > 0 ? samples.map(v => `"${v}"`).join(', ') : '(empty)'}
Current suggestion: ${c.currentSuggestion ?? 'none'}`;
  }).join('\n\n');

  return `You are a data import assistant for an invoice management system. Your task is to map spreadsheet column names to canonical invoice fields.

Available canonical fields:
${fieldList}

For each column below, suggest which canonical field it maps to. Consider both the column name AND the sample values.

Rules:
- Only suggest one of the exact canonical field names listed above
- Use "ignore" if the column is clearly irrelevant (e.g. internal codes, row numbers)
- If genuinely uncertain, use "ignore" rather than guessing a critical field incorrectly
- A column like "Ref #" with values like "INV-001" should map to "invoice_number"
- Amount-like columns: prefer "remaining_balance" if values look like outstanding balances, "amount" for totals
- Be conservative with critical fields (invoice_number, client_name, amount, due_date)

Columns to analyze:
${columnList}

Respond with a JSON array ONLY (no other text), one object per column:
[
  {
    "sourceColumn": "exact column name",
    "suggestedField": "canonical_field_name_or_null",
    "confidence": "high|medium|low",
    "reasoning": "one sentence explanation"
  }
]`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { columns } = await req.json();

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return jsonResponse({ error: 'columns array is required' }, 400);
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',  // Fast + cost-effective for this task
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: buildPrompt(columns),
      }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    let suggestions: unknown[];
    try {
      // Extract JSON array from response (handle any leading/trailing text)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      // If parsing fails, return empty suggestions (fall back to rule-based)
      suggestions = columns.map(c => ({
        sourceColumn: c.sourceColumn,
        suggestedField: null,
        confidence: 'low',
        reasoning: 'AI response could not be parsed',
      }));
    }

    // Validate that suggested fields are canonical
    const validated = (suggestions as any[]).map(s => ({
      sourceColumn:   s.sourceColumn,
      suggestedField: CANONICAL_FIELDS.includes(s.suggestedField) ? s.suggestedField : null,
      confidence:     ['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'low',
      reasoning:      s.reasoning ?? '',
    }));

    return jsonResponse({ suggestions: validated });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
