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
  }
}
