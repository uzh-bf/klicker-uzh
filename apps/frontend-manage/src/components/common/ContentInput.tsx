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
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { PropsWithChildren, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import MediaLibrary from './MediaLibrary'

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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Markdown,
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: normalizeLegacyEmptyContent(content),
    contentType: 'markdown',
    immediatelyRender: false,
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
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #a3adb7;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>

      <div className={twMerge('p-3', className?.content)}>
        <EditorContent editor={editor} />
      </div>

      <div
        className={twMerge(
          'toolbar bg-uzh-grey-20 mr-10 flex h-8 w-full flex-row px-1 text-sm',
          showToolbarOnFocus && 'hidden group-focus-within:flex'
        )}
      >
        <div
          className={twMerge('flex flex-1 flex-row gap-1', className?.toolbar)}
        >
          <Tooltip
            tooltip={t('shared.contentInput.boldStyle')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('bold')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleBold().run()
              }}
            >
              <FontAwesomeIcon
                icon={faBold}
                color={editor.isActive('bold') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.italicStyle')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('italic')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleItalic().run()
              }}
            >
              <FontAwesomeIcon
                icon={faItalic}
                color={editor.isActive('italic') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.codeStyle')}
            className={{
              tooltip: 'max-w-full text-sm md:max-w-full md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('code')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleCode().run()
              }}
            >
              <FontAwesomeIcon
                icon={faCode}
                color={editor.isActive('code') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.citationStyle')}
            className={{
              tooltip: 'max-w-[35%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('blockquote')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleBlockquote().run()
              }}
            >
              <FontAwesomeIcon
                icon={faQuoteRight}
                color={editor.isActive('blockquote') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.numberedList')}
            className={{
              tooltip: 'max-w-[35%] text-sm md:max-w-[50%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('orderedList')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleOrderedList().run()
              }}
            >
              <FontAwesomeIcon
                icon={faListOl}
                color={editor.isActive('orderedList') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.unnumberedList')}
            className={{
              tooltip: 'max-w-[40%] text-sm md:max-w-[50%] md:text-base',
            }}
          >
            <ToolbarButton
              active={editor.isActive('bulletList')}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().toggleBulletList().run()
              }}
            >
              <FontAwesomeIcon
                icon={faListUl}
                color={editor.isActive('bulletList') ? 'black' : 'grey'}
              />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            delay={2000}
            tooltip={t('shared.contentInput.image')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={isImageDropzoneOpen}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                setIsImageDropzoneOpen((prev) => !prev)
              }}
            >
              <FontAwesomeIcon icon={faImage} color="grey" />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.latex')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={false}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                editor.chain().focus().insertContent('$$1 + 2$$').run()
              }}
            >
              <FontAwesomeIcon icon={faSuperscript} color="grey" />
            </ToolbarButton>
          </Tooltip>

          <Tooltip
            tooltip={t('shared.contentInput.latexCentered')}
            className={{
              tooltip: 'max-w-[45%] text-sm md:max-w-[70%] md:text-base',
            }}
          >
            <ToolbarButton
              active={false}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
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
          </Tooltip>
        </div>

        <ToolbarButton
          active={false}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault()
            editor.chain().focus().undo().run()
          }}
          className="mr-3"
        >
          <FontAwesomeIcon icon={faRotateLeft} color="grey" />
        </ToolbarButton>

        <ToolbarButton
          active={false}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault()
            editor.chain().focus().redo().run()
          }}
          className="mr-0.5"
        >
          <FontAwesomeIcon icon={faRotateRight} color="grey" />
        </ToolbarButton>
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

const ToolbarButton = React.forwardRef<
  HTMLSpanElement,
  PropsWithChildren<{
    active: boolean
    onClick?: (e: React.MouseEvent<HTMLElement>) => void
    className?: string
    [key: string]: any
  }>
>(({ className, active, onClick, children, ...props }, ref) => (
  <span
    {...props}
    onClick={onClick}
    className={twMerge(
      className,
      'hover:bg-uzh-grey-20 my-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded',
      active && 'bg-uzh-grey-40'
    )}
    ref={ref}
  >
    {children}
  </span>
))
ToolbarButton.displayName = 'ToolbarButton'

export default ContentInput
