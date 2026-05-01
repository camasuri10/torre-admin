const TOKEN_KEY = "torre_auth_token";
const EDIFICIOS_KEY = "torre_edificios_disponibles";
const USER_TEMP_KEY = "torre_user_temp";

export interface AuthUser {
  sub: string;
  email: string;
  nombre: string;
  rol: "superadmin" | "administrador" | "propietario" | "inquilino" | "portero";
  edificio_id?: number;
  exp: number;
}

export interface EdificioBasic {
  id: number;
  nombre: string;
}

export interface UserTemp {
  id: number;
  nombre: string;
  email: string;
  rol: AuthUser["rol"];
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `auth_token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EDIFICIOS_KEY);
  localStorage.removeItem(USER_TEMP_KEY);
  document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax";
}

export function getUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return payload as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null;
}

export function getEdificiosDisponibles(): EdificioBasic[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EDIFICIOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setEdificiosDisponibles(edificios: EdificioBasic[]): void {
  localStorage.setItem(EDIFICIOS_KEY, JSON.stringify(edificios));
}

export function getUserTemp(): UserTemp | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_TEMP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUserTemp(user: UserTemp): void {
  localStorage.setItem(USER_TEMP_KEY, JSON.stringify(user));
}

export function clearUserTemp(): void {
  localStorage.removeItem(EDIFICIOS_KEY);
  localStorage.removeItem(USER_TEMP_KEY);
}
