// SSR/SSG-safe polyfill (2026-07-25) — YALNIZ prerender (Node) ortamında etkin.
// vite-react-ssg build-time render'ında birçok bileşen render-anında `localStorage`
// okur (ThemeToggle, DemoChat, ChatWidget, i18n, Supabase client...). Node'da
// localStorage YOK → ReferenceError, prerender çöker. Tek-noktalı çözüm: erken
// yüklenen (main.tsx'in İLK importu) in-memory localStorage shim'i.
//
// GÜVENLİK: yalnız `globalThis.localStorage` TANIMSIZSA eklenir → tarayıcıda
// (gerçek localStorage var) DOKUNULMAZ, panel/istemci davranışı DEĞİŞMEZ.
// `window` polyfill'i YAPILMAZ (bu, `typeof window !== 'undefined'` izomorfik
// guard'larını bozardı); yalnız bare-global `localStorage` sağlanır. Prerender'da
// getItem hep null döner → bileşenler varsayılan durumla (tema/dil default) render
// olur; istemcide gerçek localStorage devreye girer.
if (typeof globalThis !== "undefined" && typeof (globalThis as any).localStorage === "undefined") {
  const _store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (_store.has(k) ? _store.get(k)! : null),
    setItem: (k: string, v: string) => { _store.set(k, String(v)); },
    removeItem: (k: string) => { _store.delete(k); },
    clear: () => { _store.clear(); },
    key: (i: number) => Array.from(_store.keys())[i] ?? null,
    get length() { return _store.size; },
  };
}
