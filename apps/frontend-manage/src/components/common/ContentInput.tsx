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
  faTable,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import { useTranslations } from 'next-intl'
import React, { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import MediaLibrary from './MediaLibrary'

const lowlight = createLowlight(common)

const ToolbarContext = React.createContext<{ disabled: boolean }>({
  disabled: false,
})

const normalizeMarkdown = (str: string) =>
  str.replace(/\r\n/g, '\n').replace(/\n+$/, '')

const normalizeLegacyEmptyContent = (content?: string) => {
  const currentContent = content ?? ''
  return /^\s*(<br\s*\/?>\s*)+$/i.test(currentContent) ? '' : currentContent
}

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
  content?: string
  className?: ContentInputClassName
  data?: {
    test?: string
    cy?: string
  }
}

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
  const placeholderRef = useRef(placeholder)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Image,
      Markdown,
      Placeholder.configure({
        placeholder: () => placeholderRef.current,
        emptyEditorClass: 'is-editor-empty',
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      TableKit,
    ],
    content: normalizeLegacyEmptyContent(content),
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown())
    },
    editorProps: {
      attributes: {
        'data-cy': data?.cy || '',
        'data-test': data?.test || '',
        class: twMerge(
          'prose prose-sm prose-blockquote:text-gray-500 focus:outline-none! max-w-none leading-6 min-h-[80px]',
          className?.editor
        ),
      },
    },
  })

  // Placeholder extension options are created once. Refresh its decorations
  // when the translated placeholder changes without recreating the editor.
  useEffect(() => {
    placeholderRef.current = placeholder
    if (!editor) return

    editor.view.dispatch(editor.state.tr)
  }, [editor, placeholder])

  // Sync content prop when it changes externally
  useEffect(() => {
    if (!editor) return

    const normalizedContent = normalizeLegacyEmptyContent(content)
    if (
      normalizeMarkdown(normalizedContent) !==
      normalizeMarkdown(editor.getMarkdown())
    ) {
      editor.commands.setContent(normalizedContent, {
        emitUpdate: false,
        contentType: 'markdown',
      })
    }
  }, [content, editor])

  // Sync disabled/editable state
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled, false)
  }, [disabled, editor])

  if (!editor) {
    return (
      <div
        className={twMerge(
          disabled && 'pointer-events-none opacity-70',
          'relative min-h-[120px] flex-1 rounded border border-solid',
          error && touched && 'border-red-500',
          className?.root
        )}
      >
        <div className={twMerge('p-3 text-gray-400', className?.content)}>
          {placeholder}
        </div>
      </div>
    )
  }

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
      <div className={twMerge('p-3', className?.content)}>
        <EditorContent editor={editor} />
      </div>

      <div
        className={twMerge(
          'toolbar bg-uzh-grey-20 mr-10 flex h-8 w-full flex-row px-1 text-sm',
          showToolbarOnFocus && 'hidden group-focus-within:flex'
        )}
      >
        <ToolbarContext.Provider value={{ disabled }}>
          <div
            className={twMerge(
              'flex flex-1 flex-row gap-1',
              className?.toolbar
            )}
          >
            <ToolbarButton
              title={t('shared.contentInput.boldStyle')}
              aria-label={t('shared.contentInput.boldStyle')}
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <FontAwesomeIcon
                icon={faBold}
                color={editor.isActive('bold') ? 'black' : 'grey'}
              />
            </ToolbarButton>

            <ToolbarButton
              title={t('shared.contentInput.italicStyle')}
              aria-label={t('shared.contentInput.italicStyle')}
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <FontAwesomeIcon
                icon={faItalic}
                color={editor.isActive('italic') ? 'black' : 'grey'}
              />
            </ToolbarButton>

            <ToolbarButton
              title={t('shared.contentInput.codeStyle')}
              aria-label={t('shared.contentInput.codeStyle')}
              active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <FontAwesomeIcon
                icon={faCode}
                color={editor.isActive('code') ? 'black' : 'grey'}
              />
            </ToolbarButton>

            <ToolbarButton
              title={t('shared.contentInput.citationStyle')}
              aria-label={t('shared.contentInput.citationStyle')}
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <FontAwesomeIcon
                icon={faQuoteRight}
                color={editor.isActive('blockquote') ? 'black' : 'grey'}
              />
            </ToolbarButton>

            <ToolbarButton
              title={t('shared.contentInput.numberedList')}
              aria-label={t('shared.contentInput.numberedList')}
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <FontAwesomeIcon
                icon={faListOl}
                color={editor.isActive('orderedList') ? 'black' : 'grey'}
              />
            </ToolbarButton>

            <ToolbarButton
              title={t('shared.contentInput.unnumberedList')}
              aria-label={t('shared.contentInput.unnumberedList')}
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <FontAwesomeIcon
                icon={faListUl}
                color={editor.isActive('bulletList') ? 'black' : 'grey'}
              />
            </ToolbarButton>

            <ToolbarButton
              title={t('shared.contentInput.image')}
              aria-label={t('shared.contentInput.image')}
              active={isImageDropzoneOpen}
              onClick={() => setIsImageDropzoneOpen((prev) => !prev)}
            >
              <FontAwesomeIcon icon={faImage} color="grey" />
            </ToolbarButton>

            <ToolbarButton
              title={t('shared.contentInput.latex')}
              aria-label={t('shared.contentInput.latex')}
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertContent('$$1 + 2$$', { contentType: 'markdown' })
                  .run()
              }}
            >
              <FontAwesomeIcon icon={faSuperscript} color="grey" />
            </ToolbarButton>

            <ToolbarButton
              title={t('shared.contentInput.latexCentered')}
              aria-label={t('shared.contentInput.latexCentered')}
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertContent('\n$$\n1 + 2\n$$\n', {
                    contentType: 'markdown',
                  })
                  .run()
              }}
            >
              <div className="flex flex-row items-center gap-0.5">
                <FontAwesomeIcon icon={faSuperscript} color="grey" />
                <span className="text-[9px] font-bold text-gray-500">C</span>
              </div>
            </ToolbarButton>

            <ToolbarButton
              data-cy="toolbar-code-block"
              title={t('shared.contentInput.codeBlock')}
              aria-label={t('shared.contentInput.codeBlock')}
              active={editor.isActive('codeBlock')}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
              <FontAwesomeIcon
                icon={faTerminal}
                color={editor.isActive('codeBlock') ? 'black' : 'grey'}
              />
            </ToolbarButton>

            <ToolbarButton
              data-cy="toolbar-table"
              title={t('shared.contentInput.table')}
              aria-label={t('shared.contentInput.table')}
              active={editor.isActive('table')}
              onClick={() => {
                if (!editor.isActive('table')) {
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              }}
            >
              <FontAwesomeIcon
                icon={faTable}
                color={editor.isActive('table') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </div>

          {editor.isActive('table') && (
            <div className="border-uzh-grey-40 mr-3 flex flex-row items-center gap-1 border-l pl-2">
              <ToolbarButton
                data-cy="table-add-row"
                title={t('shared.contentInput.addRow')}
                aria-label={t('shared.contentInput.addRow')}
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                <span className="text-[10px] font-bold">+R</span>
              </ToolbarButton>
              <ToolbarButton
                data-cy="table-delete-row"
                title={t('shared.contentInput.deleteRow')}
                aria-label={t('shared.contentInput.deleteRow')}
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                <span className="text-[10px] font-bold text-red-500">-R</span>
              </ToolbarButton>
              <ToolbarButton
                data-cy="table-add-column"
                title={t('shared.contentInput.addColumn')}
                aria-label={t('shared.contentInput.addColumn')}
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                <span className="text-[10px] font-bold">+C</span>
              </ToolbarButton>
              <ToolbarButton
                data-cy="table-delete-column"
                title={t('shared.contentInput.deleteColumn')}
                aria-label={t('shared.contentInput.deleteColumn')}
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                <span className="text-[10px] font-bold text-red-500">-C</span>
              </ToolbarButton>
              <ToolbarButton
                data-cy="table-delete"
                title={t('shared.contentInput.deleteTable')}
                aria-label={t('shared.contentInput.deleteTable')}
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                <span className="text-[10px] font-bold text-red-700">Del</span>
              </ToolbarButton>
            </div>
          )}

          <ToolbarButton
            title={t('shared.contentInput.undo')}
            aria-label={t('shared.contentInput.undo')}
            onClick={() => editor.chain().focus().undo().run()}
            className="mr-3"
          >
            <FontAwesomeIcon icon={faRotateLeft} color="grey" />
          </ToolbarButton>

          <ToolbarButton
            title={t('shared.contentInput.redo')}
            aria-label={t('shared.contentInput.redo')}
            onClick={() => editor.chain().focus().redo().run()}
            className="mr-0.5"
          >
            <FontAwesomeIcon icon={faRotateRight} color="grey" />
          </ToolbarButton>
        </ToolbarContext.Provider>
      </div>

      {isImageDropzoneOpen && (
        <div
          className={twMerge(
            'border-t-0! absolute z-10 flex w-full flex-col rounded-b-md border-2 border-solid bg-white md:flex-row',
            showToolbarOnFocus && 'hidden group-focus-within:flex'
          )}
        >
          <MediaLibrary
            onImageClick={(href, name) => {
              editor.chain().focus().setImage({ src: href, alt: name }).run()
              setIsImageDropzoneOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    {
      className,
      active,
      children,
      disabled: buttonDisabled,
      onClick,
      ...props
    },
    ref
  ) {
    const { disabled: editorDisabled } = React.useContext(ToolbarContext)
    const isDisabled = editorDisabled || buttonDisabled
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-pressed={active}
        disabled={isDisabled}
        className={twMerge(
          'focus-visible:outline-uzh-blue-80 my-auto flex h-7 w-7 items-center justify-center rounded border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-1',
          isDisabled
            ? 'cursor-not-allowed opacity-50'
            : 'hover:bg-uzh-grey-20 cursor-pointer',
          active && 'bg-uzh-grey-40',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ToolbarButton.displayName = 'ToolbarButton'

export default ContentInput
