import { canvasClient } from './api';

// How did you hear about us. Keys are the canonical JMS channel keys; the
// server whitelists them (apps/backend/src/lib/hdyhau.ts).
export type HdyhauChannel = 'ai_assistant' | 'google' | 'word_of_mouth' | 'trade_group' | 'social' | 'other';

export const hdyhauApi = {
  get: () => canvasClient.get<{ success: true; data: { ask: boolean } }>('/user/hdyhau'),

  answer: (channel: HdyhauChannel, otherText?: string) =>
    canvasClient.post<{ success: true; data: { recorded: boolean } }>('/user/hdyhau', {
      channel,
      ...(channel === 'other' && otherText ? { otherText } : {}),
    }),

  skip: () => canvasClient.post<{ success: true; data: { recorded: boolean } }>('/user/hdyhau', { skipped: true }),
};
