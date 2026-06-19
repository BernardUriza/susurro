/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_RENDER?: string;
  readonly VITE_SUSURRO_GATEWAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
