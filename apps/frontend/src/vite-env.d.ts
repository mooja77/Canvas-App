/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string | undefined;
  readonly VITE_STRIPE_PRO_MONTHLY_PRICE_ID: string | undefined;
  readonly VITE_STRIPE_PRO_ANNUAL_PRICE_ID: string | undefined;
  readonly VITE_STRIPE_TEAM_MONTHLY_PRICE_ID: string | undefined;
  readonly VITE_STRIPE_TEAM_ANNUAL_PRICE_ID: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
