let counter = 0;
const session = Math.random().toString(36).slice(2, 6);

/** Short unique id for pipes. Unique within a session and very unlikely to collide across sessions. */
export function newId(prefix = 'p'): string {
  counter += 1;
  return `${prefix}${session}${counter.toString(36)}`;
}
