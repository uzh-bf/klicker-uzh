import fs from 'fs'
import path from 'path'

export function getEmailTemplate(templateName: string): string {
  const templatePath = path.join(__dirname, `${templateName}.html`)
  return fs.readFileSync(templatePath, 'utf-8')
}
