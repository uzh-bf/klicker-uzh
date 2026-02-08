/**
 * Parses the `embed` query parameter from a URL.
 * Handles both single string and array forms (Next.js query params).
 */
export function parseEmbedParam(param: string | string[] | undefined): boolean {
  const value = Array.isArray(param) ? param[0] : param
  return value === 'true' || value === '1'
}
