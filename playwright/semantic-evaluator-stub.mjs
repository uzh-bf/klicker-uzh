import { createServer } from 'node:http'

const DEFAULT_PORT = 7099
const HOST = '127.0.0.1'

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateRequest(value) {
  if (
    !isRecord(value) ||
    value.contract_version !== '1' ||
    typeof value.task_bundle_id !== 'string' ||
    !isRecord(value.question) ||
    typeof value.question.content !== 'string' ||
    !['en', 'de'].includes(value.question.language) ||
    !isRecord(value.response) ||
    typeof value.response.text !== 'string' ||
    !isRecord(value.rubric_schema) ||
    !Array.isArray(value.rubric_schema.rubrics) ||
    value.rubric_schema.rubrics.length === 0
  ) {
    return false
  }

  return value.rubric_schema.rubrics.every(
    (rubric) =>
      isRecord(rubric) &&
      typeof rubric.id === 'string' &&
      typeof rubric.name === 'string' &&
      Array.isArray(rubric.achievement_levels) &&
      rubric.achievement_levels.length > 0 &&
      rubric.achievement_levels.every(
        (level) =>
          isRecord(level) &&
          typeof level.name === 'string' &&
          Number.isFinite(level.normalized_score)
      )
  )
}

function selectScenario(answer) {
  if (answer.includes('[semantic:correct]')) return 'correct'
  if (answer.includes('[semantic:partial]')) return 'partial'
  if (answer.includes('[semantic:incorrect]')) return 'incorrect'
  if (answer.includes('[semantic:uncertain]')) return 'uncertain'
  if (answer.includes('[semantic:failure]')) return 'failure'
  return 'partial'
}

function selectLevel(rubric, scenario) {
  const levels = [...rubric.achievement_levels].sort(
    (a, b) => Number(a.normalized_score) - Number(b.normalized_score)
  )
  if (scenario === 'correct') return levels.at(-1)
  if (scenario === 'incorrect') return levels[0]

  const partialTargetByRubric = {
    'risk-reduction': 100,
    'diversification-mechanism': 100,
    correlation: 60,
    'risk-scope': 0,
  }
  const targetScore = partialTargetByRubric[rubric.id] ?? 60

  return levels.reduce((closest, level) =>
    Math.abs(Number(level.normalized_score) - targetScore) <
    Math.abs(Number(closest.normalized_score) - targetScore)
      ? level
      : closest
  )
}

const PARTIAL_COPY_BY_RUBRIC = {
  'risk-reduction': {
    rationale: {
      de: 'Die Antwort erkennt korrekt, dass Diversifikation das anlagespezifische Risiko reduziert.',
      en: 'The answer correctly recognizes that diversification reduces asset-specific risk.',
    },
    feedback: {
      de: 'Ergänze, dass sich unternehmensspezifische Schwankungen im Portfolio teilweise ausgleichen.',
      en: 'Add that company-specific fluctuations partially offset each other within a portfolio.',
    },
  },
  'diversification-mechanism': {
    rationale: {
      de: 'Die Antwort beschreibt zutreffend, dass das Risiko auf mehrere Anlagen verteilt wird.',
      en: 'The answer correctly describes how risk is distributed across several investments.',
    },
    feedback: {
      de: 'Nenne zusätzlich, dass die Anlagen unterschiedlichen Risikotreibern ausgesetzt sein sollten.',
      en: 'Also mention that the investments should be exposed to different risk drivers.',
    },
  },
  correlation: {
    rationale: {
      de: 'Die Risikostreuung wird genannt, aber der Zusammenhang mit nicht perfekt korrelierten Renditen fehlt.',
      en: 'Risk spreading is mentioned, but the connection to imperfectly correlated returns is missing.',
    },
    feedback: {
      de: 'Erkläre, dass der Diversifikationseffekt stärker ist, wenn sich die Renditen nicht vollständig gleich bewegen.',
      en: 'Explain that diversification is stronger when the returns do not move completely in lockstep.',
    },
  },
  'risk-scope': {
    rationale: {
      de: 'Die Antwort unterscheidet nicht zwischen unsystematischem und systematischem Risiko.',
      en: 'The answer does not distinguish between unsystematic and systematic risk.',
    },
    feedback: {
      de: 'Stelle klar, dass Diversifikation vor allem unsystematisches Risiko reduziert, nicht das allgemeine Marktrisiko.',
      en: 'Clarify that diversification primarily reduces unsystematic risk, not general market risk.',
    },
  },
}

function getEvaluationCopy({ rubric, level, scenario, isGerman }) {
  const language = isGerman ? 'de' : 'en'
  const partialCopy = PARTIAL_COPY_BY_RUBRIC[rubric.id]
  if (scenario === 'partial' && partialCopy) {
    return {
      rationale: partialCopy.rationale[language],
      feedback: partialCopy.feedback[language],
    }
  }

  const levelDescription =
    typeof level.description === 'string' && level.description.trim().length > 0
      ? level.description.trim()
      : rubric.description
  return isGerman
    ? {
        rationale: `Die Stufe „${level.name}“ wurde gewählt, weil die Antwort folgendes Kriterium erfüllt: ${levelDescription}`,
        feedback:
          scenario === 'correct'
            ? 'Behalte diese präzise Begründung in zukünftigen Antworten bei.'
            : `Ergänze deine Antwort gezielt zu diesem Kriterium: ${rubric.description}`,
      }
    : {
        rationale: `The “${level.name}” level was selected because the answer meets this criterion: ${levelDescription}`,
        feedback:
          scenario === 'correct'
            ? 'Keep using this precise reasoning in future answers.'
            : `Extend your answer specifically for this criterion: ${rubric.description}`,
      }
}

function createEvaluation(request, scenario) {
  const isGerman = request.question.language === 'de'
  const uncertain = scenario === 'uncertain'
  const rubricEvaluations = request.rubric_schema.rubrics.map((rubric) => {
    const level = selectLevel(rubric, scenario)
    return {
      rubric,
      level,
      copy: getEvaluationCopy({ rubric, level, scenario, isGerman }),
    }
  })

  return {
    contract_version: '1',
    task_bundle_id: request.task_bundle_id,
    evaluator_version: 'playwright-semantic-evaluator-v1',
    model_version: 'deterministic-fixture-v1',
    rubric_assessments: rubricEvaluations.map(({ rubric, level, copy }) => {
      return {
        task_bundle_id: request.task_bundle_id,
        rubric_id: rubric.id,
        rubric_name: rubric.name,
        proposed_level: level.name,
        normalized_score: Number(level.normalized_score),
        justification: isGerman
          ? 'Deterministische Playwright-Bewertung.'
          : 'Deterministic Playwright evaluation.',
        evidence_ids: [],
        confidence: uncertain ? 0.2 : 1,
        needs_review: uncertain,
        review_flags: uncertain ? ['synthetic-uncertainty'] : [],
        used_evidence_ids: [],
        unsupported_claims: [],
        uncertainty_reason: uncertain
          ? isGerman
            ? 'Synthetische Unsicherheit.'
            : 'Synthetic uncertainty.'
          : null,
        rationale: copy.rationale,
      }
    }),
    feedback_proposals: rubricEvaluations.map(({ rubric, copy }) => ({
      task_bundle_id: request.task_bundle_id,
      rubric_id: rubric.id,
      rubric_name: rubric.name,
      feedback: copy.feedback,
      strengths: [],
      improvements: [copy.feedback],
      action_items: [copy.feedback],
      evidence_ids: [],
      confidence: uncertain ? 0.2 : 1,
    })),
  }
}

if (process.env.NODE_ENV !== 'test') {
  throw new Error('The semantic evaluator stub only runs with NODE_ENV=test')
}

const port = Number(
  process.env.PLAYWRIGHT_SEMANTIC_EVALUATOR_PORT ?? DEFAULT_PORT
)
const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') {
    sendJson(response, 200, { status: 'ok' })
    return
  }

  if (request.method !== 'POST' || request.url !== '/evaluate') {
    sendJson(response, 404, { error: 'not_found' })
    return
  }

  let body = ''
  request.setEncoding('utf8')
  request.on('data', (chunk) => {
    body += chunk
  })
  request.on('end', () => {
    let value
    try {
      value = JSON.parse(body)
    } catch {
      sendJson(response, 400, { error: 'invalid_json' })
      return
    }

    if (!validateRequest(value)) {
      sendJson(response, 400, { error: 'invalid_contract' })
      return
    }

    const scenario = selectScenario(value.response.text)
    if (scenario === 'failure') {
      sendJson(response, 503, { error: 'synthetic_failure' })
      return
    }

    setTimeout(() => {
      sendJson(response, 200, createEvaluation(value, scenario))
    }, 300)
  })
})

server.listen(port, HOST, () => {
  process.stdout.write(
    `[semantic-evaluator-stub] listening on http://${HOST}:${port}\n`
  )
})

const shutdown = () => server.close(() => process.exit(0))
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
