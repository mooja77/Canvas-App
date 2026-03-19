declare namespace Express {
  interface Request {
    // Legacy access-code auth
    dashboardAccessId?: string;
    dashboardAccess?: {
      id: string;
      name: string;
      role: string;
    };
    // Email auth
    userId?: string;
    userPlan?: string;
    userRole?: string;
    // Per-request LLM provider (set by resolveAiConfig middleware)
    llmProvider?: import('../lib/llm.js').LlmProvider;
  }
}
