/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed Bazaar subgraph GraphQL endpoint. Unset → UI reads chain directly. */
  readonly VITE_SUBGRAPH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
