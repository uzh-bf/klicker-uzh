import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LOCAL_CHATBOT_ID, LOCAL_KB_ID } from './local-mcp-auth.mjs'

/**
 * The optional additional local identity.  Its owner and course are the
 * synthetic local ones this seed creates, so the file names only the identity
 * that receives its own retrieval corpus.
 */
export function loadLocalMcpFixture(env = {}, root = process.cwd()) {
  const path = resolve(
    root,
    env.LOCAL_MCP_FIXTURE_FILE ?? 'project/_local/local-mcp-fixture.json'
  )
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    if (!env.LOCAL_MCP_FIXTURE_FILE && error.code === 'ENOENT') return null
    throw new Error('Local MCP fixture configuration unavailable')
  }
  try {
    if (raw.length > 8192) throw new Error()
    const value = JSON.parse(raw)
    const keys = ['chatbotId', 'kbId', 'chatMode', 'documentsFile']
    if (
      !value ||
      Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      keys.some(
        (key) =>
          typeof value[key] !== 'string' ||
          !value[key].trim() ||
          value[key].length > 2048
      ) ||
      keys
        .slice(0, 2)
        .some(
          (key) =>
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
              value[key]
            )
        ) ||
      value.chatMode.length > 64 ||
      value.chatbotId.toLowerCase() === LOCAL_CHATBOT_ID ||
      value.kbId.toLowerCase() === LOCAL_KB_ID
    )
      throw new Error()
    for (const key of keys.slice(0, 2)) value[key] = value[key].toLowerCase()
    return { ...value, documentsFile: resolve(root, value.documentsFile) }
  } catch {
    throw new Error('Invalid local MCP fixture configuration')
  }
}
