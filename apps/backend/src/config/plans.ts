export type PlanTier = 'free' | 'pro' | 'team';

export interface PlanLimits {
  maxCanvases: number;
  maxTranscriptsPerCanvas: number;
  maxWordsPerTranscript: number;
  maxCodes: number;
  autoCodeEnabled: boolean;
  allowedAnalysisTypes: string[];
  allowedExportFormats: string[];
  maxShares: number;
  ethicsEnabled: boolean;
  casesEnabled: boolean;
  intercoderEnabled: boolean;
  aiEnabled: boolean;
  aiRequestsPerDay: number;
  fileUploadEnabled: boolean;
  maxStorageMb: number;
  transcriptionMinutesPerMonth: number;
  maxCollaborators: number;
  repositoryEnabled: boolean;
  integrationsEnabled: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxCanvases: 1,
    maxTranscriptsPerCanvas: 2,
    maxWordsPerTranscript: 5000,
    maxCodes: 5,
    autoCodeEnabled: false,
    allowedAnalysisTypes: ['stats', 'wordcloud'],
    allowedExportFormats: ['csv'],
    maxShares: 0,
    ethicsEnabled: false,
    casesEnabled: false,
    intercoderEnabled: false,
    aiEnabled: false,
    aiRequestsPerDay: 0,
    fileUploadEnabled: false,
    maxStorageMb: 0,
    transcriptionMinutesPerMonth: 0,
    maxCollaborators: 0,
    repositoryEnabled: false,
    integrationsEnabled: false,
  },
  pro: {
    maxCanvases: Infinity,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 50000,
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [
      'search', 'cooccurrence', 'matrix', 'stats', 'comparison',
      'wordcloud', 'cluster', 'codingquery', 'sentiment', 'treemap',
      'documentportrait', 'timeline', 'geomap',
    ],
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'qdpx'],
    maxShares: 5,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: false,
    aiEnabled: true,
    aiRequestsPerDay: 50,
    fileUploadEnabled: true,
    maxStorageMb: 500,
    transcriptionMinutesPerMonth: 60,
    maxCollaborators: 3,
    repositoryEnabled: true,
    integrationsEnabled: false,
  },
  team: {
    maxCanvases: Infinity,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 50000,
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [
      'search', 'cooccurrence', 'matrix', 'stats', 'comparison',
      'wordcloud', 'cluster', 'codingquery', 'sentiment', 'treemap',
      'documentportrait', 'timeline', 'geomap',
    ],
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'qdpx'],
    maxShares: Infinity,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: true,
    aiEnabled: true,
    aiRequestsPerDay: 200,
    fileUploadEnabled: true,
    maxStorageMb: 5000,
    transcriptionMinutesPerMonth: 300,
    maxCollaborators: Infinity,
    repositoryEnabled: true,
    integrationsEnabled: true,
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  if (plan in PLAN_LIMITS) {
    return PLAN_LIMITS[plan as PlanTier];
  }
  return PLAN_LIMITS.free;
}
