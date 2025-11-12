const normalize = (value: string | undefined, fallback: string) => {
  if (!value || value.trim() === "") {
    return fallback;
  }

  return value.replace(/\/$/, "");
};

const DEFAULT_API_BASE = "http://localhost:4000";
const DEFAULT_WS_BASE = "ws://localhost:4000";

export const API_BASE_URL = normalize(process.env.NEXT_PUBLIC_API_URL, DEFAULT_API_BASE);
export const WS_BASE_URL = normalize(process.env.NEXT_PUBLIC_WS_URL, DEFAULT_WS_BASE);

export const buildApiUrl = (path: string) => {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${suffix}`;
};

export const buildWsUrl = (path: string) => {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${WS_BASE_URL}${suffix}`;
};

export const buildWsProtocols = (token?: string | null) => {
  return ["token", token ?? ""];
};
