import { python } from '@codemirror/lang-python'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  language?: 'plain' | 'python'
  ariaLabel: string
  placeholder?: string
  minHeight?: string
  maxHeight?: string
  dataCy?: string
}

function CodeEditor({
  value,
  onChange,
  onBlur,
  disabled = false,
  language = 'python',
  ariaLabel,
  placeholder,
  minHeight = '160px',
  maxHeight = '360px',
  dataCy,
}: CodeEditorProps) {
  const extensions = useMemo(
    () => (language === 'python' ? [python()] : []),
    [language]
  )

  return (
    <CodeMirror
      value={value}
      editable={!disabled}
      readOnly={disabled}
      extensions={extensions}
      minHeight={minHeight}
      maxHeight={maxHeight}
      placeholder={placeholder}
      aria-label={ariaLabel}
      indentWithTab={false}
      basicSetup={{
        bracketMatching: true,
        closeBrackets: true,
        foldGutter: false,
        highlightActiveLine: !disabled,
        highlightActiveLineGutter: !disabled,
        lineNumbers: true,
      }}
      onChange={(newValue) => onChange?.(newValue)}
      onBlur={onBlur}
      data-cy={dataCy}
      className="overflow-hidden rounded border border-gray-300 text-sm"
    />
  )
}

export default CodeEditor
