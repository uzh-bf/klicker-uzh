import { faImage } from '@fortawesome/free-regular-svg-icons'
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
import { useTranslations } from 'next-intl'
import React, {
  PropsWithChildren,
  Ref,
  useCallback,
  useMemo,
  useState,
} from 'react'
import {
  BaseEditor,
  Editor,
  Element as SlateElement,
  Transforms,
  createEditor,
} from 'slate'
import { HistoryEditor, withHistory } from 'slate-history'
import { Editable, ReactEditor, Slate, useSlate, withReact } from 'slate-react'
import { twMerge } from 'tailwind-merge'

import {
  convertToMd,
  convertToSlate,
} from '@klicker-uzh/shared-components/src/utils/slateMdConversion'
import MediaLibrary from './MediaLibrary'

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
  data?: {
    test?: string
    cy?: string
  }
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
  disabled = false,
  showToolbarOnFocus = false,
  placeholder,
  autoFocus,
  error = '',
  touched,
  className,
  data,
}: Props): React.ReactElement {
  const t = useTranslations()

  const [isImageDropzoneOpen, setIsImageDropzoneOpen] = useState(false)

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
        'border border-solid rounded flex-1 relative',
        showToolbarOnFocus && 'group',
        className?.root
      )}
    >
      {/* eslint-disable-next-line react/no-children-prop */}
      <Slate
        editor={editor}
        value={editorValue}
        onChange={(newValue) => onChange(convertToMd(newValue))}
      >
        <div className={twMerge('p-3', className?.content)}>
          <Editable
            className={twMerge(
              'prose prose-sm leading-6 prose-blockquote:text-gray-500 max-w-none focus:!outline-none',
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
            data-test={data?.test}
            data-cy={data?.cy}
          />
        </div>
        <div
          className={twMerge(
            'toolbar flex flex-row w-full px-1 mr-10 h-8 bg-uzh-grey-20 text-sm',
            showToolbarOnFocus && 'group-focus-within:flex hidden'
          )}
        >
          <div
            className={twMerge(
              'flex flex-row flex-1 gap-1',
              className?.toolbar
            )}
          >
            <Tooltip
              tooltip={t('shared.contentInput.boldStyle')}
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <MarkButton format="bold" icon={faBold} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.italicStyle')}
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <MarkButton format="italic" icon={faItalic} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.codeStyle')}
              className={{
                tooltip: 'text-sm md:text-base max-w-full md:max-w-full',
              }}
              withIndicator={false}
            >
              <MarkButton format="code" icon={faCode} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.citationStyle')}
              className={{
                tooltip: 'text-sm md:text-base max-w-[35%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <BlockButton format="block-quote" icon={faQuoteRight} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.numberedList')}
              className={{
                tooltip: 'text-sm md:text-base max-w-[35%] md:max-w-[50%]',
              }}
              withIndicator={false}
            >
              <BlockButton format="numbered-list" icon={faListOl} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.unnumberedList')}
              className={{
                tooltip: 'text-sm md:text-base max-w-[40%] md:max-w-[50%]',
              }}
              withIndicator={false}
            >
              <BlockButton format="bulleted-list" icon={faListUl} />
            </Tooltip>

            <Tooltip
              delay={2000}
              tooltip={t('shared.contentInput.image')}
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <SlateButton
                active={isImageDropzoneOpen}
                editor={editor}
                format="paragraph"
                onClick={(e: any) => {
                  setIsImageDropzoneOpen((prev) => !prev)
                }}
              >
                <div className="ml-1 mt-0.5">
                  <FontAwesomeIcon icon={faImage} color="grey" />
                </div>
              </SlateButton>
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.latex')}
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <SlateButton
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
              </SlateButton>
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.latexCentered')}
              className={{
                tooltip: 'text-sm md:text-base max-w-[45%] md:max-w-[70%]',
              }}
              withIndicator={false}
            >
              <SlateButton
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
              </SlateButton>
            </Tooltip>
          </div>
          <SlateButton
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
          </SlateButton>
          <SlateButton
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
          </SlateButton>
        </div>
      </Slate>

      {isImageDropzoneOpen && (
        <div
          className={twMerge(
            'flex flex-col md:flex-row bg-white absolute z-10 border-2 border-solid w-full rounded-b-md !border-t-0 ',
            showToolbarOnFocus && 'group-focus-within:flex hidden'
          )}
        >
          <MediaLibrary
            onImageClick={(href, name) => {
              Transforms.insertNodes(editor, {
                type: 'paragraph',
                children: [{ text: `![${name}](${href})` }],
              })
              setIsImageDropzoneOpen(false)
            }}
          />
        </div>
      )}
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
    <SlateButton
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
    </SlateButton>
  )
}

const MarkButton = ({ format, icon, className }: any) => {
  const editor = useSlate()
  return (
    <SlateButton
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
    </SlateButton>
  )
}

export const SlateButton = React.forwardRef(
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
SlateButton.displayName = 'Button'

export default ContentInput
