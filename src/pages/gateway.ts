export const SUSURRO_GATEWAY: string =
  import.meta.env.VITE_SUSURRO_GATEWAY ||
  (typeof window !== 'undefined'
    ? window.location.origin
    : 'https://sus.bernarduriza.com');

export interface DiscoveryEndpoint {
  method: string;
  url: string;
  body: unknown;
  returns: string | Record<string, string>;
  curl: string;
}

export interface DiscoveryAuth {
  scheme?: string;
  header?: string;
  note?: string;
  [key: string]: unknown;
}

export interface DiscoveryRateLimit {
  onboarding_token?: string;
  limit?: string;
  note?: string;
  [key: string]: unknown;
}

export interface DiscoveryResponse {
  service: string;
  purpose: string;
  onboarding_token: string;
  auth: DiscoveryAuth;
  rate_limit: DiscoveryRateLimit;
  endpoints: {
    tts: DiscoveryEndpoint;
    stt: DiscoveryEndpoint;
    refine: DiscoveryEndpoint;
  };
}

export interface AdminKey {
  token: string;
  token_preview: string;
  name: string;
  kind: string;
  daily_limit: number;
  active: boolean;
  requests_today: number;
  requests_total: number;
  est_cost_usd_total: number;
}

export interface AdminKeysResponse {
  keys: AdminKey[];
}

export interface ClaimResponse {
  token: string;
  name: string;
  warning: string;
}

export interface ClaimCreateResponse {
  claim_code: string;
  claim_url: string;
  name: string | null;
  note: string;
}

export interface CreatedKeyResponse {
  token: string;
  name: string;
  daily_limit: number;
}

export interface RevokeResponse {
  revoked: boolean;
  active: boolean;
}
