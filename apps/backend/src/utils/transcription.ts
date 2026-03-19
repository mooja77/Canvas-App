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

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for transcription');
    client = new OpenAI({ apiKey });
  }
  return client;
}

/**
 * Transcribe an audio file using Whisper API.
 * @param filePath Absolute path to the audio file on disk
 * @param language Optional BCP-47 language code (e.g. 'en')
 */
export async function transcribeAudio(
  filePath: string,
  language?: string,
): Promise<TranscriptionResult> {
  const file = fs.createReadStream(filePath);

  const response = await getClient().audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
    ...(language ? { language } : {}),
  });

  const segments: TranscriptionSegment[] = (response as any).segments?.map((seg: any) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  })) || [];

  const duration = (response as any).duration || segments[segments.length - 1]?.end || 0;

  return {
    text: response.text,
    segments,
    duration,
    language: (response as any).language,
  };
}

/**
 * Get the local upload path for a storage key (for local storage provider)
 */
export function getLocalUploadPath(storageKey: string): string {
  return path.resolve(__dirname, '../../uploads', storageKey);
}
