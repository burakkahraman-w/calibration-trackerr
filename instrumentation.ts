/**
 * Node can expose a broken global `localStorage` when NODE_OPTIONS includes
 * `--localstorage-file` without a valid path. Next.js dev tooling then crashes
 * calling `localStorage.getItem`. Replace with a minimal stub (`getItem` / `key` → `null`).
 *
 * Must never throw: if `register()` rejects, the dev server can return 500 for every
 * request (including `/_next/static/*`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    delete process.env.NODE_OPTIONS;
  } catch {
    /* ignore */
  }

  const g = globalThis as typeof globalThis & { localStorage?: unknown };

  function storageLooksUsable(s: unknown): boolean {
    if (!s || typeof s !== "object") return false;
    const st = s as Partial<Storage>;
    if (typeof st.getItem !== "function" || typeof st.setItem !== "function") return false;
    try {
      st.getItem("__next_ls_probe__");
      return true;
    } catch {
      return false;
    }
  }

  if (storageLooksUsable(g.localStorage)) return;

  const storage: Storage = {
    get length() {
      return 0;
    },
    clear() {},
    getItem() {
      return null;
    },
    key() {
      return null;
    },
    removeItem() {},
    setItem() {},
  };

  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  } catch {
    try {
      (g as { localStorage?: Storage }).localStorage = storage;
    } catch {
      /* non-configurable built-in: avoid crashing the process */
    }
  }
}
