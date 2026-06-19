export const SUSURRO_GATEWAY: string =
  import.meta.env.VITE_SUSURRO_GATEWAY ??
  'https://susurro-gateway.nicecliff-10074f57.eastus.azurecontainerapps.io';

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

export interface CreatedKeyResponse {
  token: string;
  name: string;
  daily_limit: number;
}

export interface RevokeResponse {
  revoked: boolean;
  active: boolean;
}
