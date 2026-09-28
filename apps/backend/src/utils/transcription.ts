/**
 * Audio Transcription via OpenAI Whisper API
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface TranscriptionSegment {
  start: number; // seconds
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  duration: number; // total seconds
  language?: string;
}

/**
 * Always a per-request client on a customer's own key. There is no server key
 * fallback: an empty key is refused before any network call.
 */
function clientFor(apiKey: string): OpenAI {
  if (!apiKey) throw new Error("Transcription needs the customer's own OpenAI key");
  return new OpenAI({ apiKey });
}

/**
 * Transcribe an audio file using Whisper API.
 * @param filePath Absolute path to the audio file on disk
 * @param language Optional BCP-47 language code (e.g. 'en')
 * @param apiKey The customer's own OpenAI API key (required; see utils/aiKeys.ts)
 */
export async function transcribeAudio(
  filePath: string,
  language: string | undefined,
  apiKey: string,
): Promise<TranscriptionResult> {
  const client = clientFor(apiKey);
  const file = fs.createReadStream(filePath);

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
    ...(language ? { language } : {}),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verboseResponse = response as any;
  const segments: TranscriptionSegment[] =
    verboseResponse.segments?.map((seg: { start: number; end: number; text: string }) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    })) || [];

  const duration = verboseResponse.duration || segments[segments.length - 1]?.end || 0;

  return {
    text: response.text,
    segments,
    duration,
    language: verboseResponse.language,
  };
}

/**
 * Get the local upload path for a storage key (for local storage provider)
 */
export function getLocalUploadPath(storageKey: string): string {
  return path.resolve(__dirname, '../../uploads', storageKey);
}
