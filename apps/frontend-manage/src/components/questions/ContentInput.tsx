import {
  faBold,
  faCode,
  faItalic,
  faListOl,
  faListUl,
  faQuoteRight,
  faRotateLeft,
  faRotateRight,
  faSuperscript,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tooltip } from '@uzh-bf/design-system'
import isHotkey from 'is-hotkey'
import React, { PropsWithChildren, Ref, useCallback, useMemo } from 'react'
import {
  BaseEditor,
  createEditor,
  Editor,
  Element as SlateElement,
  Transforms,
} from 'slate'
import { HistoryEditor, withHistory } from 'slate-history'
import { Editable, ReactEditor, Slate, useSlate, withReact } from 'slate-react'
import { twMerge } from 'tailwind-merge'

import { convertToMd, convertToSlate } from '../../lib/utils/slateMdConversion'

interface Props {
  error?: any
  onChange: any
  touched: any
  disabled?: boolean
  showToolbarOnFocus?: boolean
  placeholder: string
  autoFocus?: boolean
  content: string
  className?: {
    root?: string
    toolbar?: string
    content?: string
    editor?: string
  }
  key?: string
  id?: string
}

const defaultProps = {
  error: '',
  disabled: false,
  showToolbarOnFocus: false,
}

const HOTKEYS: Record<string, string> = {
  'mod+b': 'bold',
  'mod+i': 'italic',
}
const LIST_TYPES = ['numbered-list', 'bulleted-list']
type OrNull<T> = T | null

function ContentInput({
  content,
  onChange,
  disabled,
  showToolbarOnFocus,
  placeholder,
  autoFocus,
  error,
  touched,
  className,
  key,
  id,
}: Props): React.ReactElement {
  const renderElement = useCallback((props: any) => <Element {...props} />, [])
  const renderLeaf = useCallback((props: any) => <Leaf {...props} />, [])
  const editor = useMemo(() => withHistory(withReact(createEditor())), [])

  const editorValue = useMemo(() => {
    return convertToSlate(content)
  }, [content])

  return (
    <div
      className={twMerge(
        disabled && 'pointer-events-none opacity-70',
        'border border-solid rounded flex-1',
        showToolbarOnFocus && 'group',
        className?.root
      )}
    >
      {/* eslint-disable-next-line react/no-children-prop */}
      <Slate
        key={key}
        editor={editor}
        value={editorValue}
        onChange={(newValue) => onChange(convertToMd(newValue))}
      >
        <div
          className={twMerge(
            'toolbar flex flex-row w-full px-1.5 mr-10 h-10 bg-uzh-grey-20',
            showToolbarOnFocus && 'group-focus-within:flex hidden'
          )}
        >
          <div
            className={twMerge(
              'flex flex-row flex-1 gap-3',
              className?.toolbar
            )}
          >
            <Tooltip
              tooltip="Wählen Sie diese Einstellung für fetten Text. Das gleiche kann auch mit der Standard Tastenkombination cmd/ctrl+b erreicht werden."
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <MarkButton format="bold" icon={faBold} />
            </Tooltip>

            <Tooltip
              tooltip="Wählen Sie diese Einstellung für kursiven Text. Das gleiche kann auch mit der Standard Tastenkombination cmd/ctrl+i erreicht werden."
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <MarkButton format="italic" icon={faItalic} />
            </Tooltip>

            <Tooltip
              tooltip="Wählen Sie diese Einstellung für Code-Styling. Das gleiche kann auch mit der Standard Tastenkombination cmd/ctrl+c erreicht werden."
              className={{
                tooltip: 'text-sm md:text-base max-w-full md:max-w-full',
              }}
              withIndicator={false}
            >
              <MarkButton format="code" icon={faCode} />
            </Tooltip>

            <Tooltip
              tooltip="Wählen Sie diese Option, um ein Zitat einzufügen. Beachten Sie hier, dass aktuell neue Paragraphen (durch einen Zeilenumbruch / Enter) als separate Zitate dargestellt werden."
              className={{
                tooltip: 'text-sm md:text-base max-w-[35%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <BlockButton format="block-quote" icon={faQuoteRight} />
            </Tooltip>

            <Tooltip
              tooltip="Diese Option erzeug eine nummerierte Liste. Um neue Punkte zu erstellen, fügen Sie einfach nach einem bestehenden Element eine neue Zeile ein. Um zu Standard-Text zurückzukehren, drücken Sie diesen Knopf erneut."
              className={{
                tooltip: 'text-sm md:text-base max-w-[35%] md:max-w-[50%]',
              }}
              withIndicator={false}
            >
              <BlockButton format="numbered-list" icon={faListOl} />
            </Tooltip>

            <Tooltip
              tooltip="Diese Option erzeug eine nicht-nummerierte Liste. Um neue Punkte zu erstellen, fügen Sie einfach nach einem bestehenden Element eine neue Zeile ein. Um zu Standard-Text zurückzukehren, drücken Sie diesen Knopf erneut."
              className={{
                tooltip: 'text-sm md:text-base max-w-[40%] md:max-w-[50%]',
              }}
              withIndicator={false}
            >
              <BlockButton format="bulleted-list" icon={faListUl} />
            </Tooltip>

            <Tooltip
              tooltip="Wählen Sie diese Einstellung, um eine LaTeX-Formel inline einzubinden. Benutzen Sie dieselbe Schreibweise, um Formeln in Antortmöglichkeiten einzubinden."
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <Button
                active={false}
                editor={editor}
                format="paragraph"
                onClick={(e: any) => {
                  e.preventDefault()
                  Transforms.insertText(editor, '$$1 + 2$$')
                }}
              >
                <div className="ml-1 mt-0.5">
                  <FontAwesomeIcon icon={faSuperscript} color="grey" />
                </div>
              </Button>
            </Tooltip>

            <Tooltip
              tooltip="Wählen Sie diese Einstellung, um eine LaTeX-Formel zentriert auf einer separaten Zeile einzubinden."
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <Button
                active={false}
                editor={editor}
                format="paragraph"
                onClick={(e: any) => {
                  e.preventDefault()
                  Transforms.insertNodes(editor, {
                    type: 'paragraph',
                    children: [{ text: '$$' }],
                  })
                  Transforms.insertNodes(editor, {
                    type: 'paragraph',
                    children: [{ text: '1 + 2' }],
                  })
                  Transforms.insertNodes(editor, {
                    type: 'paragraph',
                    children: [{ text: '$$' }],
                  })
                }}
              >
                <div className="ml-1 mt-0.5">
                  <FontAwesomeIcon icon={faSuperscript} color="grey" />
                </div>
              </Button>
            </Tooltip>
          </div>
          <Button
            active={false}
            editor={editor}
            format="paragraph"
            onClick={() => editor.undo()}
            type="button"
            className="mr-3"
          >
            <div className="flex items-center">
              <FontAwesomeIcon icon={faRotateLeft} color="grey" />
            </div>
          </Button>
          <Button
            active={false}
            editor={editor}
            format="paragraph"
            onClick={() => editor.redo()}
            type="button"
            className="mr-0.5"
          >
            <div className="flex items-center">
              <FontAwesomeIcon icon={faRotateRight} color="grey" />
            </div>
          </Button>
        </div>
        <div className={twMerge('p-3', className?.content)}>
          <Editable
            className={twMerge(
              'leading-7 prose prose-blockquote:text-gray-500 max-w-none',
              className?.editor
            )}
            autoFocus={autoFocus}
            spellCheck
            placeholder={placeholder}
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            onKeyDown={(event) => {
              // eslint-disable-next-line no-restricted-syntax
              for (const hotkey in HOTKEYS) {
                if (isHotkey(hotkey, event as any)) {
                  event.preventDefault()
                  const mark = HOTKEYS[hotkey]
                  toggleMark(editor, mark)
                }
              }
            }}
            id={id}
          />
        </div>
      </Slate>
    </div>
  )
}

const toggleBlock = (
  editor: BaseEditor & ReactEditor & HistoryEditor,
  format: string
) => {
  const isActive = isBlockActive(editor, format)
  const isList = LIST_TYPES.includes(format)

  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      LIST_TYPES.includes(n.type),
    split: true,
  })
  const newProperties: Partial<SlateElement> = {
    // eslint-disable-next-line no-nested-ternary
    type: isActive ? 'paragraph' : isList ? 'list-item' : format,
  }
  Transforms.setNodes<SlateElement>(editor, newProperties)

  if (!isActive && isList) {
    const block = { type: format, children: [] }
    Transforms.wrapNodes(editor, block)
  }
}

const toggleMark = (
  editor: BaseEditor & ReactEditor & HistoryEditor,
  format: string
) => {
  const isActive = isMarkActive(editor, format)

  if (isActive) {
    Editor.removeMark(editor, format)
  } else {
    Editor.addMark(editor, format, true)
  }
}

const isBlockActive = (
  editor: BaseEditor & ReactEditor & HistoryEditor,
  format: string
) => {
  const { selection } = editor
  if (!selection) return false

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) =>
        !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
    })
  )

  return !!match
}

const isMarkActive = (
  editor: BaseEditor & ReactEditor & HistoryEditor,
  format: string
) => {
  const marks = Editor.marks(editor)
  return marks ? marks[format] === true : false
}

const Element = ({ attributes, children, element }: any) => {
  switch (element.type) {
    case 'block-quote':
      return (
        <blockquote {...attributes}>
          <p>{children}</p>
        </blockquote>
      )
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>
    case 'heading-one':
      return <h1 {...attributes}>{children}</h1>
    case 'heading-two':
      return <h2 {...attributes}>{children}</h2>
    case 'list-item':
      return <li {...attributes}>{children}</li>
    case 'numbered-list':
      return <ol {...attributes}>{children}</ol>
    default:
      return <p {...attributes}>{children}</p>
  }
}

const Leaf = ({ attributes, children, leaf }: any) => {
  let formattedChildren = children
  if (leaf.bold) {
    formattedChildren = <strong>{formattedChildren}</strong>
  }

  if (leaf.code) {
    formattedChildren = (
      <code className="bg-uzh-grey-40 opacity-80">{formattedChildren}</code>
    )
  }

  if (leaf.italic) {
    formattedChildren = <em>{formattedChildren}</em>
  }

  return <span {...attributes}>{formattedChildren}</span>
}

const BlockButton = ({ format, icon, className }: any) => {
  const editor = useSlate()
  return (
    <Button
      active={isBlockActive(editor, format)}
      editor={editor}
      format={format}
      onClick={(event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault()
        toggleBlock(editor, format)
      }}
    >
      <div className={twMerge('mt-0.5', className)}>
        <FontAwesomeIcon
          icon={icon}
          color={isBlockActive(editor, format) ? 'black' : 'grey'}
        />
      </div>
    </Button>
  )
}

const MarkButton = ({ format, icon, className }: any) => {
  const editor = useSlate()
  return (
    <Button
      active={isMarkActive(editor, format)}
      onClick={(event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault()
        toggleMark(editor, format)
      }}
    >
      <div className={twMerge('mt-0.5', className)}>
        <FontAwesomeIcon
          icon={icon}
          color={isMarkActive(editor, format) ? 'black' : 'grey'}
        />
      </div>
    </Button>
  )
}

export const Button = React.forwardRef(
  (
    {
      className,
      active,
      reversed,
      ...props
    }: PropsWithChildren<{
      active: boolean
      reversed: boolean
      className: string
      [key: string]: unknown
    }>,
    ref: Ref<OrNull<HTMLSpanElement>>
  ) => (
    <span
      {...props}
      className={twMerge(
        className,
        'cursor-pointer h-7 flex justify-center items-center w-7 rounded my-auto',
        active && !reversed && 'bg-uzh-grey-40',
        !active && reversed && 'bg-uzh-grey-40'
      )}
      ref={ref}
    />
  )
)
Button.displayName = 'Button'

ContentInput.defaultProps = defaultProps

export default ContentInput
