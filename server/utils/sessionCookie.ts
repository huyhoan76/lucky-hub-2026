import { Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'lucky_hub_session';
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const REMEMBERED_SESSION_MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;

export function isSessionIdleExpired(
  rememberMe: boolean,
  lastPing: Date | null | undefined,
  now = Date.now(),
): boolean {
  return !rememberMe && (!lastPing || now - new Date(lastPing).getTime() >= SESSION_IDLE_TIMEOUT_MS);
}

export function getSessionIdFromCookie(req: Pick<Request, 'headers'>): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));

  return cookie ? cookie.slice(SESSION_COOKIE_NAME.length + 1) || null : null;
}

export function setSessionCookie(req: Request, res: Response, sessionId: string, rememberMe: boolean): void {
  const maxAge = rememberMe ? REMEMBERED_SESSION_MAX_AGE_MS : SESSION_IDLE_TIMEOUT_MS;
  const attributes = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ];

  if (req.secure) attributes.push('Secure');
  res.append('Set-Cookie', attributes.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (req.secure) attributes.push('Secure');
  res.append('Set-Cookie', attributes.join('; '));
}
