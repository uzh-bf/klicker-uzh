import { STUDENT_PRACTICE_QUIZ_TOOL_NAME } from '@/src/services/studentPracticeMcp'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  MoveRightIcon,
} from 'lucide-react'
import { useState, type FC } from 'react'
import { StudentPracticeQuizCard } from './student-practice-quiz-card'

const MAX_PREVIEW_LINES = 10

function TruncatedOutput({ text }: { text: string }) {
  const [showAll, setShowAll] = useState(false)
  const lines = text.split('\n')
  const needsTruncation = lines.length > MAX_PREVIEW_LINES

  if (!needsTruncation || showAll) {
    return (
      <div>
        <pre className="whitespace-pre-wrap text-xs">{text}</pre>
        {needsTruncation && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
          >
            Show less
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <pre className="whitespace-pre-wrap text-xs">
        {lines.slice(0, MAX_PREVIEW_LINES).join('\n')}
      </pre>
      <button
        type="button"
        onClick={() => setShowAll(true)}
        className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
      >
        Show more ({lines.length - MAX_PREVIEW_LINES} more lines)
      </button>
    </div>
  )
}

function formatToolName(raw: string) {
  const sep = raw.indexOf('_')
  if (sep === -1) return { server: null, tool: raw }
  return {
    server: raw.slice(0, sep),
    tool: raw.slice(sep + 1).replace(/_/g, ' '),
  }
}

interface ToolFallbackProps {
  toolName: string
  argsText: string
  result?: unknown
  status: { type: string }
}

export const ToolFallback: FC<ToolFallbackProps> = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const { server, tool } = formatToolName(toolName)

  if (toolName === STUDENT_PRACTICE_QUIZ_TOOL_NAME) {
    return <StudentPracticeQuizCard result={result} status={status} />
  }

  const resultText =
    result === undefined
      ? undefined
      : typeof result === 'string'
        ? result
        : JSON.stringify(result, null, 2)

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        {isCollapsed ? (
          <ChevronRightIcon className="size-3" />
        ) : (
          <ChevronDownIcon className="size-3" />
        )}
        {status.type === 'running' ? (
          <>
            <LoaderCircleIcon className="size-3 animate-spin" />
            {server && (
              <>
                <span className="font-medium uppercase">{server}</span>
                <MoveRightIcon className="size-2.5" />
              </>
            )}
            {tool}...
          </>
        ) : (
          <>
            {server && (
              <>
                <span className="font-medium uppercase">{server}</span>
                <MoveRightIcon className="size-2.5" />
              </>
            )}
            {tool}
          </>
        )}
      </button>

      {!isCollapsed && (
        <div className="mt-1 rounded bg-slate-50 p-2 text-xs">
          <pre className="whitespace-pre-wrap">{argsText}</pre>
          {resultText !== undefined && (
            <div className="mt-2 border-t border-dashed border-slate-200 pt-2">
              <TruncatedOutput text={resultText} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
