import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Handlebars from 'handlebars'

type PromptContext = {
  'citation-contract': { maxSources: number }
  'course-data': { courseData: string }
  'course-grounding': Record<string, never>
  'course-policy': Record<string, never>
  'input-context': Record<string, never>
  'language-style': Record<string, never>
  'output-format': Record<string, never>
  'mode-tutor': Record<string, never>
  'mode-explainer': Record<string, never>
  'mode-quizzer': Record<string, never>
  'lecturer-guidance': { lecturerPrompt: string }
  'lecturer-custom-persona': {
    selectedModeJson: string
    lecturerPrompt: string
  }
  'lecturer-standard-context': { personaContextJson: string }
  'image-description': { userContent: string }
}

const templates = new Map<keyof PromptContext, Handlebars.TemplateDelegate>()

/** Render only repository-owned templates; supplied values are plain text data. */
export function renderPromptTemplate<Name extends keyof PromptContext>(
  name: Name,
  context: PromptContext[Name]
): string {
  let template = templates.get(name)
  if (!template) {
    // Next's standalone server changes cwd to the app directory before loading
    // routes. Explicit output tracing includes these non-public server assets.
    const source = readFileSync(
      join(process.cwd(), 'src', 'prompts', `${name}.hbs`),
      'utf8'
    ).replace(/\r?\n$/, '')
    template = Handlebars.compile(source, { strict: true, noEscape: true })
    templates.set(name, template)
  }
  return template(context)
}
