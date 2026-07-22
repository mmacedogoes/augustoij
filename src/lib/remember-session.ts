// Controla o "Manter-me conectado" no login.
//
// Estratégia: sempre gravamos o token no localStorage (é onde o supabase-js lê).
// Quando o usuário NÃO quiser ser lembrado, na hora do unload copiamos o token
// para sessionStorage e removemos do localStorage — sessionStorage some quando
// o navegador/aba fecha, então o usuário perde a sessão. Ao reabrir a página
// dentro da mesma aba (refresh/navegação), copiamos de volta antes do supabase
// inicializar. Assim:
//   - Marcado:   sessão persiste normalmente (localStorage).
//   - Desmarcado: sessão sobrevive a refresh, mas some ao fechar aba/navegador.

const PROJECT_REF = "pcmptbflyagxycqvvdvd";
const TOKEN_KEY = `sb-${PROJECT_REF}-auth-token`;
const FLAG_KEY = "augusto.remember_me";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Restaura o token do sessionStorage para o localStorage antes do supabase inicializar. */
export function hydrateEphemeralSession() {
  if (!isBrowser()) return;
  try {
    if (!localStorage.getItem(TOKEN_KEY)) {
      const cached = sessionStorage.getItem(TOKEN_KEY);
      if (cached) localStorage.setItem(TOKEN_KEY, cached);
    }
  } catch {
    /* storage indisponível — segue sem sessão */
  }
}

let unloadHandler: ((this: Window, ev: Event) => void) | null = null;

function attachEphemeralUnload() {
  if (!isBrowser() || unloadHandler) return;
  unloadHandler = () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("pagehide", unloadHandler);
}

function detachEphemeralUnload() {
  if (!isBrowser() || !unloadHandler) return;
  window.removeEventListener("pagehide", unloadHandler);
  unloadHandler = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Define o modo após login bem-sucedido. */
export function setRememberMe(remember: boolean) {
  if (!isBrowser()) return;
  try {
    if (remember) {
      localStorage.setItem(FLAG_KEY, "1");
      detachEphemeralUnload();
    } else {
      localStorage.setItem(FLAG_KEY, "0");
      attachEphemeralUnload();
    }
  } catch {
    /* ignore */
  }
}

/** Rearma o modo efêmero em cada carregamento (quando o usuário optou por não lembrar). */
export function initRememberMode() {
  if (!isBrowser()) return;
  try {
    const flag = localStorage.getItem(FLAG_KEY);
    if (flag === "0") attachEphemeralUnload();
  } catch {
    /* ignore */
  }
}

/** Limpa tudo (usado no signOut). */
export function clearRememberMode() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(FLAG_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  detachEphemeralUnload();
}