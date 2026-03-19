/**
 * AI Prompt Templates for qualitative coding assistance
 */

import type { LlmMessage } from '../lib/llm.js';

/** Build messages for suggesting codes on a highlighted text excerpt */
export function buildSuggestCodesPrompt(params: {
  codedText: string;
  transcriptTitle: string;
  transcriptContext: string;
  existingCodes: { id: string; text: string; color: string }[];
}): LlmMessage[] {
  const codeList = params.existingCodes.length > 0
    ? params.existingCodes.map(c => `  - "${c.text}" (id: ${c.id})`).join('\n')
    : '  (none yet)';

  return [
    {
      role: 'system',
      content: `You are an expert qualitative research assistant specializing in thematic coding analysis. Your role is to suggest appropriate codes for highlighted text excerpts from research transcripts.

Rules:
- Suggest 1-5 codes that best capture the themes/concepts in the highlighted text
- Prefer reusing existing codes when they fit well (provide the existing code's id)
- When suggesting new codes, use concise labels (1-5 words)
- Each suggestion should have a confidence score between 0 and 1
- Return valid JSON only

Response format:
{
  "suggestions": [
    {
      "questionId": "existing-code-id-or-null",
      "suggestedText": "Code Label",
      "confidence": 0.85,
      "reasoning": "Brief explanation of why this code fits"
    }
  ]
}`,
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

/** Build messages for auto-coding an entire transcript */
export function buildAutoCodeTranscriptPrompt(params: {
  transcriptTitle: string;
  transcriptContent: string;
  existingCodes: { id: string; text: string }[];
  instructions?: string;
}): LlmMessage[] {
  const codeList = params.existingCodes.length > 0
    ? params.existingCodes.map(c => `  - "${c.text}" (id: ${c.id})`).join('\n')
    : '  (none yet — you may suggest new codes)';

  const userInstructions = params.instructions
    ? `\n\nAdditional instructions from the researcher:\n${params.instructions}`
    : '';

  return [
    {
      role: 'system',
      content: `You are an expert qualitative research assistant. Your task is to analyze a full transcript and identify all codable segments with appropriate thematic codes.

Rules:
- Identify meaningful segments that deserve coding (not every sentence)
- Prefer reusing existing codes when they fit
- You may suggest new codes when existing ones don't cover a theme
- Use exact character offsets (0-indexed) for startOffset and endOffset
- The codedText must be an exact substring of the transcript content
- Each segment should have a confidence score between 0 and 1
- Focus on substantive themes, not filler or procedural text
- Return valid JSON only

Response format:
{
  "codings": [
    {
      "questionId": "existing-code-id-or-null",
      "suggestedText": "Code Label",
      "startOffset": 0,
      "endOffset": 50,
      "codedText": "exact text from transcript",
      "confidence": 0.8
    }
  ]
}`,
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

Analyze the transcript and identify all segments that should be coded. For each segment, provide the exact text, character offsets, and the most appropriate code (reuse existing codes by providing their id, or suggest new codes with questionId as null).`,
    },
  ];
}
