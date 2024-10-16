export function generateIdWithPrefix(prefix: string): string {
  const uniquePart =
    Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  return `${prefix}-${uniquePart}`;
}
