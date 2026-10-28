export const SAFE_TOOL_ERROR = 'Tool execution failed'

export function normalizeLiveToolOutput(output: unknown, failed = false) {
  const isMcpError =
    output !== null &&
    typeof output === 'object' &&
    'isError' in output &&
    output.isError === true
  const isError = failed || isMcpError

  return {
    result: isError ? SAFE_TOOL_ERROR : output,
    isError,
  }
}
