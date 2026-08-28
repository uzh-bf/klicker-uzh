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
  faVideo,
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
import VideoEmbedInput from './VideoEmbedInput'

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

type BlockType =
  | 'block-quote'
  | 'bulleted-list'
  | 'numbered-list'
  | 'heading_one'
  | 'heading_two'
  | 'heading_three'
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

export type ContentInputToolbarPreset = 'full' | 'basic'

interface Props {
  error?: any
  onChange: any
  touched: any
  disabled?: boolean
  showToolbarOnFocus?: boolean
  placeholder: string
  autoFocus?: boolean
  content: string
  allowVideoEmbedding?: boolean
  toolbarPreset?: ContentInputToolbarPreset
  id?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
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
  allowVideoEmbedding = false,
  toolbarPreset = 'full',
  id,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-required': ariaRequired,
  'aria-invalid': ariaInvalid,
  className,
  data,
}: Props): React.ReactElement {
  const t = useTranslations()
  const hasFullToolbar = toolbarPreset === 'full'

  const [isImageDropzoneOpen, setIsImageDropzoneOpen] = useState(false)
  const [isVideoInputOpen, setIsVideoInputOpen] = useState(false)

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
        onChange={(newValue) => {
          if (!disabled) {
            onChange(convertToMd(newValue))
          }
        }}
      >
        <div className={twMerge('p-3', className?.content)}>
          <Editable
            className={twMerge(
              'prose prose-sm prose-blockquote:text-gray-500 focus:outline-none! max-w-none leading-6',
              className?.editor
            )}
            autoFocus={autoFocus}
            id={id}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-required={ariaRequired}
            aria-invalid={ariaInvalid}
            aria-disabled={disabled}
            readOnly={disabled}
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
            hasFullToolbar && allowVideoEmbedding && 'h-auto min-h-8',
            showToolbarOnFocus && 'hidden group-focus-within:flex'
          )}
        >
          <div
            className={twMerge(
              'flex flex-1 flex-row gap-1',
              hasFullToolbar && allowVideoEmbedding && 'flex-wrap',
              className?.toolbar
            )}
          >
            {/* Tooltip renders its own button trigger without asChild; keep the
                basic preset native and use its title instead of nesting buttons. */}
            {hasFullToolbar ? (
              <>
                <Tooltip
                  tooltip={t('shared.contentInput.boldStyle')}
                  className={{
                    tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
                  }}
                >
                  <MarkButton
                    format="bold"
                    icon={faBold}
                    dataCy="content-input-bold"
                    label={t('shared.contentInput.boldStyle')}
                  />
                </Tooltip>

                <Tooltip
                  tooltip={t('shared.contentInput.italicStyle')}
                  className={{
                    tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
                  }}
                >
                  <MarkButton
                    format="italic"
                    icon={faItalic}
                    dataCy="content-input-italic"
                    label={t('shared.contentInput.italicStyle')}
                  />
                </Tooltip>
              </>
            ) : (
              <>
                <MarkButton
                  native
                  format="bold"
                  icon={faBold}
                  dataCy="content-input-bold"
                  label={t('shared.contentInput.boldStyle')}
                />

                <MarkButton
                  native
                  format="italic"
                  icon={faItalic}
                  dataCy="content-input-italic"
                  label={t('shared.contentInput.italicStyle')}
                />
              </>
            )}

            {hasFullToolbar ? (
              <>
                <Tooltip
                  tooltip={t('shared.contentInput.codeStyle')}
                  className={{
                    tooltip: 'max-w-full text-sm md:max-w-full md:text-base',
                  }}
                >
                  <MarkButton
                    format="code"
                    icon={faCode}
                    dataCy="content-input-code"
                    label={t('shared.contentInput.codeStyle')}
                  />
                </Tooltip>

                <Tooltip
                  tooltip={t('shared.contentInput.citationStyle')}
                  className={{
                    tooltip: 'max-w-[35%] text-sm md:max-w-[70%] md:text-base',
                  }}
                >
                  <BlockButton
                    format="block-quote"
                    icon={faQuoteRight}
                    dataCy="content-input-quote"
                    label={t('shared.contentInput.citationStyle')}
                  />
                </Tooltip>
              </>
            ) : null}

            {hasFullToolbar ? (
              <>
                <Tooltip
                  tooltip={t('shared.contentInput.numberedList')}
                  className={{
                    tooltip: 'max-w-[35%] text-sm md:max-w-[50%] md:text-base',
                  }}
                >
                  <BlockButton
                    format="numbered-list"
                    icon={faListOl}
                    dataCy="content-input-numbered-list"
                    label={t('shared.contentInput.numberedList')}
                  />
                </Tooltip>

                <Tooltip
                  tooltip={t('shared.contentInput.unnumberedList')}
                  className={{
                    tooltip: 'max-w-[40%] text-sm md:max-w-[50%] md:text-base',
                  }}
                >
                  <BlockButton
                    format="bulleted-list"
                    icon={faListUl}
                    dataCy="content-input-bulleted-list"
                    label={t('shared.contentInput.unnumberedList')}
                  />
                </Tooltip>
              </>
            ) : (
              <>
                <BlockButton
                  native
                  format="numbered-list"
                  icon={faListOl}
                  dataCy="content-input-numbered-list"
                  label={t('shared.contentInput.numberedList')}
                />

                <BlockButton
                  native
                  format="bulleted-list"
                  icon={faListUl}
                  dataCy="content-input-bulleted-list"
                  label={t('shared.contentInput.unnumberedList')}
                />
              </>
            )}

            {/* TODO: Add heading buttons */}
            {/* <Tooltip
              tooltip="Heading 1"
              className={{
                tooltip:
                  'max-w-[40%] whitespace-nowrap text-sm md:max-w-[50%] md:text-base',
              }}
            >
              <BlockButton
                format="heading_one"
                icon={faHeading}
                className="text-lg font-bold"
              />
            </Tooltip>

            <Tooltip
              tooltip="Heading 2"
              className={{
                tooltip: 'max-w-[40%] text-sm md:max-w-[50%] md:text-base',
              }}
            >
              <BlockButton
                format="heading_two"
                icon={faHeading}
                className="text-base font-bold"
              />
            </Tooltip>

            <Tooltip
              tooltip="Heading 3"
              className={{
                tooltip: 'max-w-[40%] text-sm md:max-w-[50%] md:text-base',
              }}
            >
              <BlockButton
                format="heading_three"
                icon={faHeading}
                className="text-xs font-normal"
              />
            </Tooltip> */}

            {hasFullToolbar ? (
              <Tooltip
                delay={2000}
                tooltip={t('shared.contentInput.image')}
                className={{
                  tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
                }}
              >
                <SlateButton
                  active={isImageDropzoneOpen}
                  data-cy="open-image-input"
                  aria-label={t('shared.contentInput.image')}
                  onClick={() => {
                    setIsVideoInputOpen(false)
                    setIsImageDropzoneOpen((prev) => !prev)
                  }}
                >
                  <div className="ml-1 mt-0.5">
                    <FontAwesomeIcon icon={faImage} color="grey" />
                  </div>
                </SlateButton>
              </Tooltip>
            ) : null}

            {hasFullToolbar && allowVideoEmbedding ? (
              <button
                type="button"
                title={t('shared.contentInput.video')}
                aria-label={t('shared.contentInput.video')}
                aria-controls="video-embed-panel"
                aria-expanded={isVideoInputOpen}
                data-cy="open-video-embed-input"
                className={twMerge(
                  'my-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded',
                  isVideoInputOpen && 'bg-uzh-grey-40'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setIsImageDropzoneOpen(false)
                  setIsVideoInputOpen((prev) => !prev)
                }}
              >
                <FontAwesomeIcon
                  icon={faVideo}
                  color={isVideoInputOpen ? 'black' : 'grey'}
                />
              </button>
            ) : null}

            {hasFullToolbar ? (
              <>
                <Tooltip
                  tooltip={t('shared.contentInput.latex')}
                  className={{
                    tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
                  }}
                >
                  <SlateButton
                    active={false}
                    data-cy="insert-inline-latex"
                    aria-label={t('shared.contentInput.latex')}
                    onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
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
                >
                  <SlateButton
                    active={false}
                    data-cy="insert-block-latex"
                    aria-label={t('shared.contentInput.latexCentered')}
                    onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
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
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => editor.undo()}
            onMouseDown={(event) => event.preventDefault()}
            className="my-auto mr-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded"
            data-cy="content-input-undo"
            aria-label={t('shared.contentInput.undo')}
          >
            <div className="flex items-center">
              <FontAwesomeIcon icon={faRotateLeft} color="grey" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => editor.redo()}
            onMouseDown={(event) => event.preventDefault()}
            className="my-auto mr-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded"
            data-cy="content-input-redo"
            aria-label={t('shared.contentInput.redo')}
          >
            <div className="flex items-center">
              <FontAwesomeIcon icon={faRotateRight} color="grey" />
            </div>
          </button>
        </div>
      </Slate>

      {hasFullToolbar && isImageDropzoneOpen && (
        <div
          className={twMerge(
            'border-t-0! absolute z-10 flex w-full flex-col rounded-b-md border-2 border-solid bg-white md:flex-row',
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

      {hasFullToolbar && allowVideoEmbedding && isVideoInputOpen ? (
        <div
          id="video-embed-panel"
          className={twMerge(
            'border-t-0! absolute z-10 flex w-full rounded-b-md border-2 border-solid bg-white',
            showToolbarOnFocus && 'hidden group-focus-within:flex'
          )}
        >
          <VideoEmbedInput
            onInsert={(url) => {
              Transforms.insertNodes(
                editor,
                {
                  type: 'paragraph',
                  children: [{ text: `[video](${url})` }],
                },
                {
                  select: true,
                }
              )
              setIsVideoInputOpen(false)
              ReactEditor.focus(editor)
            }}
          />
        </div>
      ) : null}
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
    case 'heading_one':
      return (
        <h1 {...attributes} className="mb-2 mt-4 text-2xl font-bold">
          {children}
        </h1>
      )
    case 'heading_two':
      return (
        <h2 {...attributes} className="mb-2 mt-3 text-xl font-bold">
          {children}
        </h2>
      )
    case 'heading_three':
      return (
        <h3 {...attributes} className="mb-2 mt-2 text-lg font-semibold">
          {children}
        </h3>
      )
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
  dataCy,
  label,
  native = false,
}: {
  format: BlockType
  icon: IconDefinition
  className?: string
  dataCy: string
  label: string
  native?: boolean
}) => {
  const editor = useSlate()
  const isActive = isBlockActive(editor, format)
  const content = (
    <div className={twMerge('mt-0.5', className)}>
      <FontAwesomeIcon icon={icon} color={isActive ? 'black' : 'grey'} />
      <span className="sr-only">{label}</span>
    </div>
  )
  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    toggleBlock(editor, format)
  }

  return native ? (
    <NativeSlateButton
      active={isActive}
      title={label}
      data-cy={dataCy}
      aria-label={label}
      aria-pressed={isActive}
      onClick={onClick}
    >
      {content}
    </NativeSlateButton>
  ) : (
    <SlateButton
      active={isActive}
      title={label}
      data-cy={dataCy}
      aria-label={label}
      onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
        event.preventDefault()
        toggleBlock(editor, format)
      }}
    >
      {content}
    </SlateButton>
  )
}

const MarkButton = ({
  format,
  icon,
  className,
  dataCy,
  label,
  native = false,
}: {
  format: FormatType
  icon: IconDefinition
  className?: string
  dataCy: string
  label: string
  native?: boolean
}) => {
  const editor = useSlate()
  const isActive = isMarkActive(editor, format)
  const content = (
    <div className={twMerge('mt-0.5', className)}>
      <FontAwesomeIcon icon={icon} color={isActive ? 'black' : 'grey'} />
      <span className="sr-only">{label}</span>
    </div>
  )
  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    toggleMark(editor, format)
  }

  return native ? (
    <NativeSlateButton
      active={isActive}
      title={label}
      data-cy={dataCy}
      aria-label={label}
      aria-pressed={isActive}
      onClick={onClick}
    >
      {content}
    </NativeSlateButton>
  ) : (
    <SlateButton
      active={isActive}
      title={label}
      data-cy={dataCy}
      aria-label={label}
      onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
        event.preventDefault()
        toggleMark(editor, format)
      }}
    >
      {content}
    </SlateButton>
  )
}

const SlateButton = React.forwardRef<
  HTMLSpanElement,
  PropsWithChildren<
    React.HTMLAttributes<HTMLSpanElement> & { active?: boolean }
  >
>(({ className, active = false, ...props }, ref) => {
  return (
    <span
      {...props}
      className={twMerge(
        className,
        'my-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded',
        active && 'bg-uzh-grey-40'
      )}
      ref={ref}
    />
  )
})
SlateButton.displayName = 'Button'

const NativeSlateButton = React.forwardRef<
  HTMLButtonElement,
  PropsWithChildren<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
  >
>(
  (
    { className, active = false, type = 'button', onMouseDown, ...props },
    ref
  ) => {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        onMouseDown={(event) => {
          event.preventDefault()
          onMouseDown?.(event)
        }}
        className={twMerge(
          className,
          'my-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded',
          active && 'bg-uzh-grey-40'
        )}
      />
    )
  }
)
NativeSlateButton.displayName = 'NativeSlateButton'

export default ContentInput
