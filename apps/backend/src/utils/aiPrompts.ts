/**
 * AI Prompt Templates for qualitative coding assistance.
 *
 * Design notes:
 * - System prompts use Anthropic-style `cache_control: ephemeral` marker on
 *   the system role. Providers that don't recognise it ignore it (no-op).
 *   The Anthropic provider lifts this onto the API call to enable prompt
 *   caching, saving ~5% on repeat calls.
 * - Few-shot examples are baked into system prompts to ground LLM output
 *   in real qualitative coding decisions. Eliminates a class of
 *   "code-vs-theme confusion" hallucinations.
 * - We instruct the model to lower its `confidence` score when the
 *   transcript shows AAVE, code-switching, or non-Western communicative
 *   norms — the model is most likely to misread tone in those registers
 *   per AAVENUE benchmark (Gupta et al. 2024) and CHI 2026 "Black
 *   LLMirror" findings.
 * - We instruct text-anchored output (codedText + anchorBefore) for the
 *   auto-code prompt. Character-offset trust is unreliable — LLMs
 *   routinely miscount. We use the model output as a substring query
 *   into the actual transcript server-side.
 */

import type { LlmMessage } from '../lib/llm.js';

/** Build messages for suggesting codes on a highlighted text excerpt. */
export function buildSuggestCodesPrompt(params: {
  codedText: string;
  transcriptTitle: string;
  transcriptContext: string;
  existingCodes: { id: string; text: string; color: string }[];
}): LlmMessage[] {
  const codeList =
    params.existingCodes.length > 0
      ? params.existingCodes.map((c) => `  - "${c.text}" (id: ${c.id})`).join('\n')
      : '  (none yet)';

  return [
    {
      role: 'system',
      content: `You are an expert qualitative research assistant specializing in thematic coding analysis. Your role is to suggest appropriate codes for highlighted text excerpts from research transcripts.

# Rules
- Suggest 1-5 codes that best capture the themes/concepts in the highlighted text
- Prefer reusing existing codes when they fit well (provide the existing code's id)
- When suggesting new codes, use concise labels (1-5 words)
- Each suggestion must include a confidence score:
  - 0.90-1.00: the excerpt strongly and unambiguously evidences this code
  - 0.70-0.89: plausible read, well-supported
  - 0.50-0.69: tentative — researcher should review carefully
  - <0.50: highly speculative
- If the transcript contains AAVE, code-switching, or non-Western communicative norms, LOWER your confidence by 0.15-0.25 and note the linguistic context in \`reasoning\` (your training distribution underweights these registers; humility is appropriate)
- Return valid JSON only — no preamble, no markdown fences

# Examples

## Example 1 — reuse existing code
Highlighted: "I just felt so overwhelmed. The whole thing was just too much."
Existing codes: ["Emotional overwhelm" (id: q-1), "Time pressure" (id: q-2)]
Output:
{
  "suggestions": [{
    "questionId": "q-1",
    "suggestedText": "Emotional overwhelm",
    "confidence": 0.92,
    "reasoning": "Direct first-person expression of being overwhelmed; reuses existing code rather than creating duplicate."
  }]
}

## Example 2 — suggest new code alongside reuse
Highlighted: "We tried to use NVivo but it crashed, so we just used spreadsheets."
Existing codes: ["Software frustration" (id: q-3)]
Output:
{
  "suggestions": [
    {"questionId": "q-3", "suggestedText": "Software frustration", "confidence": 0.85, "reasoning": "NVivo crash maps to existing 'Software frustration' theme."},
    {"questionId": null, "suggestedText": "Workaround / fallback to spreadsheet", "confidence": 0.78, "reasoning": "Distinct theme — the substitution behaviour itself is a finding worth its own code."}
  ]
}

## Example 3 — low confidence, AAVE register
Highlighted: "Yo, that ain't even how it be."
Existing codes: ["Discontent" (id: q-7)]
Output:
{
  "suggestions": [{
    "questionId": "q-7",
    "suggestedText": "Discontent",
    "confidence": 0.55,
    "reasoning": "Possible discontent reading but utterance is in AAVE and may carry tonal nuance (irony, emphasis) my training may misrepresent. Recommend researcher review."
  }]
}

# Response format
{
  "suggestions": [
    {
      "questionId": "existing-code-id-or-null",
      "suggestedText": "Code Label",
      "confidence": 0.85,
      "reasoning": "Brief explanation (<50 words)."
    }
  ]
}`,
      // Anthropic prompt-caching marker. Other providers ignore.
      cache_control: { type: 'ephemeral' },
    },
    {
      role: 'user',
      content: `Transcript: "${params.transcriptTitle}"

Context (surrounding text):
"""
${params.transcriptContext}
"""

Highlighted excerpt to code:
"""
${params.codedText}
"""

Existing codes in this project:
${codeList}

Suggest appropriate qualitative codes for the highlighted excerpt. Reuse existing codes where appropriate (set questionId to the existing code's id). For new codes, set questionId to null.`,
    },
  ];
}

/** Build messages for auto-coding an entire transcript. */
export function buildAutoCodeTranscriptPrompt(params: {
  transcriptTitle: string;
  transcriptContent: string;
  existingCodes: { id: string; text: string }[];
  instructions?: string;
}): LlmMessage[] {
  const codeList =
    params.existingCodes.length > 0
      ? params.existingCodes.map((c) => `  - "${c.text}" (id: ${c.id})`).join('\n')
      : '  (none yet — you may suggest new codes)';

  const userInstructions = params.instructions
    ? `\n\nAdditional instructions from the researcher:\n${params.instructions}`
    : '';

  return [
    {
      role: 'system',
      content: `You are an expert qualitative research assistant analyzing transcripts for codable segments.

# Rules
- Identify SUBSTANTIVE themes — not interviewer asides, transitions, or procedural filler
- Prefer reusing existing codes; suggest new only when no existing code fits
- Each segment must include a confidence score (same 0.5/0.7/0.9 thresholds as suggest-codes)
- Lower confidence by 0.15-0.25 for AAVE / code-switching / non-Western communicative norms
- Return valid JSON only

# Text-anchored output (IMPORTANT)
Character offsets from LLMs are unreliable — instead, return:
- \`codedText\`: the EXACT substring of the transcript content (will be matched server-side)
- \`anchorBefore\`: 20-30 chars of context immediately before \`codedText\` (used to disambiguate if the same substring appears multiple times)

# Example
Transcript excerpt: "...And then the IRB said no, which was just devastating. We had to start over..."
Output for the coded segment:
{
  "codedText": "the IRB said no, which was just devastating",
  "anchorBefore": "...And then ",
  "questionId": null,
  "suggestedText": "Institutional gatekeeping",
  "confidence": 0.82,
  "reasoning": "IRB rejection framed emotionally; institutional barrier theme."
}

# Response format
{
  "codings": [{
    "codedText": "exact substring from the transcript",
    "anchorBefore": "20-30 chars of context before",
    "questionId": "existing-code-id-or-null",
    "suggestedText": "Code Label",
    "confidence": 0.80,
    "reasoning": "Brief explanation (<50 words)"
  }]
}`,
      cache_control: { type: 'ephemeral' },
    },
    {
      role: 'user',
      content: `Transcript: "${params.transcriptTitle}"

Full transcript content:
"""
${params.transcriptContent}
"""

Existing codes in this project:
${codeList}
${userInstructions}

Analyze the transcript and identify substantive segments that should be coded. For each, provide the exact text, anchor context, and the most appropriate code (reuse existing codes by providing their id, or suggest new codes with questionId as null).`,
    },
  ];
}
