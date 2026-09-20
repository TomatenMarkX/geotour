export type AccessTokenClaims = {
  sub: string;
  email?: string;
  exp: number;
  iat?: number;
  iss?: string;
};

/**
 * Liest die Claims eines Access Tokens aus.
 * Bewusst ohne Signaturprüfung: die macht das Backend als Resource Server.
 * Hier geht es nur darum, userId und E-Mail für die UI zu bekommen.
 */
export function decodeJwt(token: string): AccessTokenClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AccessTokenClaims;
  } catch {
    return null;
  }
}
