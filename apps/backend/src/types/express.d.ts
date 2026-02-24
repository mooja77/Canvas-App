declare namespace Express {
  interface Request {
    dashboardAccessId?: string;
    dashboardAccess?: {
      id: string;
      name: string;
      role: string;
    };
  }
}
