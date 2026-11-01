declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_MAP_PERF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
