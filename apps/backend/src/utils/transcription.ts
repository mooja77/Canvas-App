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

let client: OpenAI | null = null;

function getClient(apiKey?: string): OpenAI {
  if (apiKey) {
    // Per-request client with user's own key
    return new OpenAI({ apiKey });
  }
  if (!client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is required for transcription');
    client = new OpenAI({ apiKey: key });
  }
  return client;
}

/**
 * Transcribe an audio file using Whisper API.
 * @param filePath Absolute path to the audio file on disk
 * @param language Optional BCP-47 language code (e.g. 'en')
 * @param apiKey Optional user-provided OpenAI API key (BYOK)
 */
export async function transcribeAudio(
  filePath: string,
  language?: string,
  apiKey?: string,
): Promise<TranscriptionResult> {
  const file = fs.createReadStream(filePath);

  const response = await getClient(apiKey).audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
    ...(language ? { language } : {}),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verboseResponse = response as any;
  const segments: TranscriptionSegment[] = verboseResponse.segments?.map((seg: { start: number; end: number; text: string }) => ({
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
