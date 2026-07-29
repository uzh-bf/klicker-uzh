import { lstatSync } from 'fs'

export default {
  '*': (stagedFiles) => {
    const nonSymlinks = stagedFiles.filter((f) => {
      try {
        return !lstatSync(f).isSymbolicLink()
      } catch {
        return false
      }
    })
    if (nonSymlinks.length === 0) return []
    return [
      `prettier --config .prettierrc.mjs --ignore-unknown --check ${nonSymlinks.join(' ')}`,
    ]
  },
}
