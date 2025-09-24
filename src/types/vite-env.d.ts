/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_RENDER?: string;
  // add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
