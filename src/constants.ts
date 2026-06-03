export const DEFAULT_ALLOWED_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'ftp:'] as const;

export const DEFAULT_EXTERNAL_LINK_REL = 'nofollow noopener noreferrer';

export const DEFAULT_EXTERNAL_LINK_TARGET = '_blank';

export const DEFAULT_BLOCKQUOTE_CLASS_NAME = 'wakabamark-blockquote';

export const DEFAULT_SPOILER_CLASS_NAME = 'wakabamark-spoiler';

export const UNSAFE_URL_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);

// Number of leading spaces that mark an indented code block (a single leading tab is equivalent).
export const CODE_INDENT_WIDTH = 4;

// Delimiter that opens and closes an inline spoiler span.
export const SPOILER_DELIMITER = '%%';
