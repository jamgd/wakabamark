export const DEFAULT_ALLOWED_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'ftp:'] as const;

export const DEFAULT_EXTERNAL_LINK_REL = 'nofollow noopener noreferrer';

export const DEFAULT_EXTERNAL_LINK_TARGET = '_blank';

export const DEFAULT_SPOILER_CLASS_NAME = 'wakabamark-spoiler';

export const UNSAFE_URL_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);
