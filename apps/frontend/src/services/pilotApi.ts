const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface PilotFeedbackPayload {
  participantRole: string;
  sector?: string;
  productExperience: string;
  taskResults: { taskId: string; outcome: string }[];
  hardestStep?: string;
  missingFeature?: string;
  adoptionBlocker?: string;
  recommendationScore: number;
  contactEmail?: string;
  consentToContact?: boolean;
  website?: string;
}

/**
 * Small public client kept separate from the authenticated Axios client so
 * /pilot remains safe to server-render for search and link previews.
 */
export const pilotApi = {
  async submitFeedback(data: PilotFeedbackPayload): Promise<void> {
    const response = await fetch(`${API_BASE}/pilot/feedback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Pilot feedback request failed (${response.status})`);
  },
};
