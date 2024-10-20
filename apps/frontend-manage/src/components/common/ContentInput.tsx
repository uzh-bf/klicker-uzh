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
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  convertToMd,
  convertToSlate,
} from '@klicker-uzh/shared-components/src/utils/slateMdConversion'
import { Tooltip } from '@uzh-bf/design-system'
import isHotkey from 'is-hotkey'
import { useTranslations } from 'next-intl'
import React, {
  PropsWithChildren,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react'
import {
  BaseEditor,
  createEditor,
  Descendant,
  Editor,
  Element as SlateElement,
  Transforms,
} from 'slate'
import { HistoryEditor, withHistory } from 'slate-history'
import { Editable, ReactEditor, Slate, useSlate, withReact } from 'slate-react'
import { twMerge } from 'tailwind-merge'
import MediaLibrary from './MediaLibrary'

// ! START SLATE TYPE DEFINITIONS
type CustomEditor = BaseEditor & ReactEditor & HistoryEditor

type ParagraphElement = {
  type: 'paragraph'
  children: CustomText[]
}

type ListItemElement = {
  type: 'list-item'
  children: CustomText[]
}

type BlockType = 'block-quote' | 'bulleted-list' | 'numbered-list'
type BlockElement = {
  type: BlockType
  children: CustomElement[]
}

type FormatType = 'bold' | 'italic' | 'code'
type CustomText = {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
}

type CustomElement = ParagraphElement | ListItemElement | BlockElement
type CustomElementTypes = CustomElement['type']

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor
    Element: CustomElement
    Text: CustomText
  }
}
// ! END SLATE TYPE DEFINITIONS

export interface ContentInputClassName {
  root?: string
  toolbar?: string
  content?: string
  editor?: string
}

interface Props {
  error?: any
  onChange: any
  touched: any
  disabled?: boolean
  showToolbarOnFocus?: boolean
  placeholder: string
  autoFocus?: boolean
  content: string
  className?: ContentInputClassName
  data?: {
    test?: string
    cy?: string
  }
}

const HOTKEYS: Record<string, FormatType> = {
  'mod+b': 'bold',
  'mod+i': 'italic',
}
const LIST_TYPES = ['numbered-list', 'bulleted-list']

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

  const renderElement = useCallback(
    (props: ElementProps) => <Element {...props} />,
    []
  )
  const renderLeaf = useCallback((props: LeafProps) => <Leaf {...props} />, [])
  const editor = useMemo(() => withHistory(withReact(createEditor())), [])

  const editorValue = useMemo(() => {
    return convertToSlate(content) as Descendant[]
  }, [content])

  return (
    <div
      className={twMerge(
        disabled && 'pointer-events-none opacity-70',
        'relative flex-1 rounded border border-solid',
        showToolbarOnFocus && 'group',
        error && touched && 'border-red-500',
        className?.root
      )}
    >
      <Slate
        editor={editor}
        initialValue={editorValue}
        onChange={(newValue) => onChange(convertToMd(newValue))}
      >
        <div className={twMerge('p-3', className?.content)}>
          <Editable
            className={twMerge(
              'prose prose-sm prose-blockquote:text-gray-500 max-w-none leading-6 focus:!outline-none',
              className?.editor
            )}
            autoFocus={autoFocus}
            spellCheck
            placeholder={placeholder}
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            onKeyDown={(event) => {
              for (const hotkey in HOTKEYS) {
                if (isHotkey(hotkey, event)) {
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
            'toolbar bg-uzh-grey-20 mr-10 flex h-8 w-full flex-row px-1 text-sm',
            showToolbarOnFocus && 'hidden group-focus-within:flex'
          )}
        >
          <div
            className={twMerge(
              'flex flex-1 flex-row gap-1',
              className?.toolbar
            )}
          >
            <Tooltip
              tooltip={t('shared.contentInput.boldStyle')}
              className={{
                tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
              }}
              withIndicator={false}
            >
              <MarkButton format="bold" icon={faBold} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.italicStyle')}
              className={{
                tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
              }}
              withIndicator={false}
            >
              <MarkButton format="italic" icon={faItalic} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.codeStyle')}
              className={{
                tooltip: 'max-w-full text-sm md:max-w-full md:text-base',
              }}
              withIndicator={false}
            >
              <MarkButton format="code" icon={faCode} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.citationStyle')}
              className={{
                tooltip: 'max-w-[35%] text-sm md:max-w-[70%] md:text-base',
              }}
              withIndicator={false}
            >
              <BlockButton format="block-quote" icon={faQuoteRight} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.numberedList')}
              className={{
                tooltip: 'max-w-[35%] text-sm md:max-w-[50%] md:text-base',
              }}
              withIndicator={false}
            >
              <BlockButton format="numbered-list" icon={faListOl} />
            </Tooltip>

            <Tooltip
              tooltip={t('shared.contentInput.unnumberedList')}
              className={{
                tooltip: 'max-w-[40%] text-sm md:max-w-[50%] md:text-base',
              }}
              withIndicator={false}
            >
              <BlockButton format="bulleted-list" icon={faListUl} />
            </Tooltip>

            <Tooltip
              delay={2000}
              tooltip={t('shared.contentInput.image')}
              className={{
                tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
              }}
              withIndicator={false}
            >
              <SlateButton
                active={isImageDropzoneOpen}
                editor={editor}
                format="paragraph"
                onClick={() => {
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
                tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
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
                tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
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
            'absolute z-10 flex w-full flex-col rounded-b-md border-2 !border-t-0 border-solid bg-white md:flex-row',
            showToolbarOnFocus && 'hidden group-focus-within:flex'
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
  format: BlockType
) => {
  const isActive = isBlockActive(editor, format)
  const isList = LIST_TYPES.includes(format)

  Transforms.unwrapNodes(editor, {
    match: (node) =>
      !Editor.isEditor(node) &&
      SlateElement.isElement(node) &&
      LIST_TYPES.includes(node.type),
    split: true,
  })
  const newProperties: { type: CustomElementTypes } = {
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
  format: FormatType
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
  format: FormatType
) => {
  const marks = Editor.marks(editor)
  return marks ? marks[format] === true : false
}

interface ElementProps {
  attributes: any
  children: ReactNode
  element: CustomElement
}

const Element = ({ attributes, children, element }: ElementProps) => {
  switch (element.type) {
    case 'block-quote':
      return (
        <blockquote {...attributes}>
          <p>{children}</p>
        </blockquote>
      )
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>
    // case 'heading-one':
    //   return <h1 {...attributes}>{children}</h1>
    // case 'heading-two':
    //   return <h2 {...attributes}>{children}</h2>
    case 'list-item':
      return <li {...attributes}>{children}</li>
    case 'numbered-list':
      return <ol {...attributes}>{children}</ol>
    default:
      return <p {...attributes}>{children}</p>
  }
}

interface LeafProps {
  attributes: any
  children: ReactNode
  leaf: CustomText
}

const Leaf = ({ attributes, children, leaf }: LeafProps) => {
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

const BlockButton = ({
  format,
  icon,
  className,
}: {
  format: BlockType
  icon: IconDefinition
  className?: string
}) => {
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

const MarkButton = ({
  format,
  icon,
  className,
}: {
  format: FormatType
  icon: IconDefinition
  className?: string
}) => {
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

export const SlateButton = React.forwardRef<
  HTMLSpanElement,
  PropsWithChildren<{
    active: boolean
    reversed: boolean
    className: string
    [key: string]: any
  }>
>(({ className, active, reversed, ...props }, ref) => (
  <span
    {...props}
    className={twMerge(
      className,
      'my-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded',
      active && !reversed && 'bg-uzh-grey-40',
      !active && reversed && 'bg-uzh-grey-40'
    )}
    ref={ref}
  />
))
SlateButton.displayName = 'Button'

export default ContentInput
