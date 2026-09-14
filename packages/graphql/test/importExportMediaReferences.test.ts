import { ElementType } from '@klicker-uzh/prisma/client'
import {
  collectAnswerCollectionMediaReferences,
  collectElementMediaHrefs,
  collectElementMediaReferences,
  createPackageMediaHref,
  IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER,
  isPackageMediaHref,
  measureAnswerCollectionMediaReferenceWork,
  measureElementMediaReferenceWork,
  MediaReferenceKind,
  omitExternalAutoLoadingAnswerCollectionMediaReferences,
  omitExternalAutoLoadingElementMediaReferences,
  PACKAGE_MEDIA_HREF_PREFIX,
  rewriteAnswerCollectionMediaReferences,
  rewriteElementMediaReferences,
  rewriteExportAnswerCollectionMediaReferences,
  rewriteExportElementMediaReferences,
  rewriteMarkdownMediaReferences,
} from '../src/lib/importExportMediaReferences.js'

type MediaReferenceSource = Parameters<typeof collectElementMediaReferences>[0]

function createElement(
  overrides: Partial<MediaReferenceSource> = {}
): MediaReferenceSource {
  return {
    type: ElementType.SC,
    content: '',
    explanation: null,
    options: {},
    ...overrides,
  }
}

describe('import/export media-reference collection', () => {
  it('measures reference candidates and Markdown syntax work before parsing', () => {
    const element = createElement({
      content: [
        '![image](https://cdn.example.test/image.png)',
        '[link](https://docs.example.test/guide.pdf)',
      ].join('\n'),
    })

    expect(measureElementMediaReferenceWork(element)).toEqual({
      candidateOccurrences: 3,
      markdownWorkUnits: 9,
    })
  })

  it('does not charge Markdown work for plain answer-entry values', () => {
    expect(
      measureAnswerCollectionMediaReferenceWork({
        description: '',
        entries: [
          { value: '*plain* https://docs.example.test/guide.pdf [text]' },
        ],
      })
    ).toEqual({
      candidateOccurrences: 1,
      markdownWorkUnits: 0,
    })
  })

  it('classifies Markdown images as auto-loading and links or raw URLs as links', () => {
    const element = createElement({
      content: [
        '![diagram](https://cdn.example.test/diagram.png)',
        '[handout](https://cdn.example.test/handout.pdf)',
        'Raw: https://cdn.example.test/archive.zip.',
      ].join('\n'),
    })

    expect(collectElementMediaReferences(element)).toEqual([
      {
        href: 'https://cdn.example.test/diagram.png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
      {
        href: 'https://cdn.example.test/handout.pdf',
        kind: MediaReferenceKind.LINK,
      },
      {
        href: 'https://cdn.example.test/archive.zip',
        kind: MediaReferenceKind.LINK,
      },
    ])
  })

  it('resolves reference-style images and links case-insensitively', () => {
    const element = createElement({
      content: [
        '![Lecture image][Hero]',
        '[Read the manual][GUIDE]',
        '',
        '[hero]: https://cdn.example.test/hero.png "Hero title"',
        '[guide]: https://docs.example.test/manual.pdf "Manual title"',
      ].join('\n'),
    })

    expect(collectElementMediaReferences(element)).toEqual([
      {
        href: 'https://cdn.example.test/hero.png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
      {
        href: 'https://docs.example.test/manual.pdf',
        kind: MediaReferenceKind.LINK,
      },
    ])
  })

  it('uses the first duplicate reference definition, matching CommonMark', () => {
    const element = createElement({
      content: [
        '![Lecture image][hero]',
        '',
        '[hero]: https://cdn.example.test/first.png',
        '[hero]: https://cdn.example.test/ignored.png',
      ].join('\n'),
    })

    expect(collectElementMediaReferences(element)).toEqual([
      {
        href: 'https://cdn.example.test/first.png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
    ])
  })

  it('visits content, explanation, and rendered choice fields', () => {
    const element = createElement({
      content: 'https://content.example.test/content.txt',
      explanation: '![explanation](https://explanation.example.test/image.png)',
      options: {
        choices: [
          {
            ix: 0,
            value: 'https://options.example.test/prompt.txt',
            feedback: '![feedback](https://options.example.test/feedback.png)',
          },
        ],
      },
    })

    expect(collectElementMediaReferences(element)).toEqual([
      {
        href: 'https://content.example.test/content.txt',
        kind: MediaReferenceKind.LINK,
      },
      {
        href: 'https://explanation.example.test/image.png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
      {
        href: 'https://options.example.test/prompt.txt',
        kind: MediaReferenceKind.LINK,
      },
      {
        href: 'https://options.example.test/feedback.png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
    ])
  })

  it('deduplicates hrefs and lets auto-loading usage take precedence', () => {
    const href = 'https://cdn.example.test/shared.png'
    const element = createElement({
      content: [`[open](${href})`, href, `![preview](${href})`].join('\n'),
      options: {
        choices: [{ ix: 0, value: `[open again](${href})` }],
      },
    })

    expect(collectElementMediaReferences(element)).toEqual([
      { href, kind: MediaReferenceKind.AUTO_LOAD },
    ])
    expect(collectElementMediaHrefs(element)).toEqual([href])
    expect(
      collectElementMediaHrefs(element, MediaReferenceKind.AUTO_LOAD)
    ).toEqual([href])
    expect(collectElementMediaHrefs(element, MediaReferenceKind.LINK)).toEqual(
      []
    )
  })

  it('ignores URLs inside inline and fenced code', () => {
    const element = createElement({
      content: [
        '`https://ignored.example.test/inline.png`',
        '',
        '```text',
        'https://ignored.example.test/fenced.png',
        '```',
        '',
        'https://included.example.test/outside.png',
      ].join('\n'),
    })

    expect(collectElementMediaReferences(element)).toEqual([
      {
        href: 'https://included.example.test/outside.png',
        kind: MediaReferenceKind.LINK,
      },
    ])
  })

  it('uses mdast destination values for queries, titles, and parentheses', () => {
    const element = createElement({
      content: [
        '![query](https://cdn.example.test/image.png?width=640&format=webp "Preview")',
        '[nested](https://docs.example.test/a_(b))',
        '![escaped](https://cdn.example.test/a\\(b\\).png)',
      ].join('\n'),
    })

    expect(collectElementMediaReferences(element)).toEqual([
      {
        href: 'https://cdn.example.test/image.png?width=640&format=webp',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
      {
        href: 'https://docs.example.test/a_(b)',
        kind: MediaReferenceKind.LINK,
      },
      {
        href: 'https://cdn.example.test/a(b).png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
    ])
  })

  it('classifies scheme-relative Markdown images as external auto-loads', () => {
    const element = createElement({
      content: '![tracking pixel](//attacker.example.test/pixel.png)',
    })

    expect(collectElementMediaReferences(element)).toEqual([
      {
        href: '//attacker.example.test/pixel.png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
    ])
  })

  it('walks deeply nested Markdown iteratively', () => {
    const element = createElement({
      content: `${'> '.repeat(3000)}![deep](https://cdn.example.test/deep.png)`,
    })

    expect(collectElementMediaReferences(element)).toEqual([
      {
        href: 'https://cdn.example.test/deep.png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
    ])
  })

  it('omits external inline images while preserving same-URL links and package images', () => {
    const externalHref = 'https://cdn.example.test/a(b).png'
    const schemeRelativeHref = '//attacker.example.test/pixel.png'
    const packageHref = createPackageMediaHref('packaged-image')
    const element = createElement({
      content: [
        '![escaped diagram](https://cdn.example.test/a\\(b\\).png "Diagram")',
        '[open diagram](https://cdn.example.test/a\\(b\\).png)',
        '![tracking pixel](//attacker.example.test/pixel.png)',
        `![packaged](<${packageHref}>)`,
      ].join('\n'),
    })

    const omitted = omitExternalAutoLoadingElementMediaReferences(element)

    expect(omitted.content).toContain(IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER)
    expect(omitted.content).not.toContain('![escaped diagram]')
    expect(omitted.content).not.toContain('![tracking pixel]')
    expect(omitted.content).toContain(
      '[open diagram](https://cdn.example.test/a\\(b\\).png)'
    )
    expect(omitted.content).toContain(`![packaged](<${packageHref}>)`)
    expect(collectElementMediaReferences(omitted)).toEqual([
      { href: externalHref, kind: MediaReferenceKind.LINK },
      { href: packageHref, kind: MediaReferenceKind.AUTO_LOAD },
    ])
    expect(collectElementMediaReferences(omitted)).not.toContainEqual({
      href: schemeRelativeHref,
      kind: MediaReferenceKind.AUTO_LOAD,
    })
  })

  it('omits image references without changing shared definitions or ordinary links', () => {
    const href = 'https://cdn.example.test/reference.png'
    const element = createElement({
      content: [
        '![external preview][Shared]',
        '[open original][shared]',
        '',
        `[shared]: ${href} "Shared media"`,
      ].join('\n'),
    })

    const omitted = omitExternalAutoLoadingElementMediaReferences(element)

    expect(omitted.content).not.toContain('![external preview][Shared]')
    expect(omitted.content).toContain('[open original][shared]')
    expect(omitted.content).toContain(`[shared]: ${href} "Shared media"`)
    expect(collectElementMediaReferences(omitted)).toEqual([
      { href, kind: MediaReferenceKind.LINK },
    ])
  })

  it('removes an external definition that becomes unused after image omission', () => {
    const href = 'https://cdn.example.test/private.png?sig=secret'
    const omitted = omitExternalAutoLoadingElementMediaReferences(
      createElement({
        content: ['![secret][img]', '', `[img]: ${href}`].join('\n'),
      })
    )

    expect(omitted.content).toContain(IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER)
    expect(omitted.content).not.toContain(href)
    expect(omitted.content).not.toContain('[img]:')
  })

  it('rewrites only export image uses and removes image-only source definitions', () => {
    const bundledHref = 'https://cdn.example.test/bundled.png?sig=source'
    const omittedImageOnlyHref =
      'https://tracker.example.test/private.png?sig=secret'
    const omittedSharedHref =
      'https://tracker.example.test/shared.png?sig=keep-as-link'
    const packageHref = createPackageMediaHref('bundled')
    const element = createElement({
      content: [
        `![inline bundled](${bundledHref})`,
        `[open bundled](${bundledHref})`,
        `Raw source: ${bundledHref}`,
        '![shared bundled image][bundled-source]',
        '[shared bundled link][bundled-source]',
        '![omitted private image][private-source]',
        '![omitted shared image][shared-omitted]',
        '[open omitted source][shared-omitted]',
        '',
        `[bundled-source]: ${bundledHref} "Bundled source"`,
        `[private-source]: ${omittedImageOnlyHref}`,
        `[shared-omitted]: ${omittedSharedHref}`,
      ].join('\n'),
      explanation: `![omitted explanation](${omittedImageOnlyHref})`,
      options: {
        choices: [
          {
            ix: 0,
            value: `![bundled choice](${bundledHref})`,
            feedback: `![omitted feedback](${omittedImageOnlyHref})`,
          },
        ],
      },
    })

    const rewritten = rewriteExportElementMediaReferences(
      element,
      new Map([[bundledHref, packageHref]])
    )

    expect(rewritten.content).toContain(`![inline bundled](<${packageHref}>)`)
    expect(rewritten.content).toContain(
      `![shared bundled image](<${packageHref}>)`
    )
    expect(rewritten.content).toContain(`[open bundled](${bundledHref})`)
    expect(rewritten.content).toContain(`Raw source: ${bundledHref}`)
    expect(rewritten.content).toContain('[shared bundled link][bundled-source]')
    expect(rewritten.content).toContain(
      `[bundled-source]: ${bundledHref} "Bundled source"`
    )
    expect(rewritten.content).toContain('[open omitted source][shared-omitted]')
    expect(rewritten.content).toContain(
      `[shared-omitted]: ${omittedSharedHref}`
    )
    expect(rewritten.content).not.toContain(omittedImageOnlyHref)
    expect(rewritten.content).not.toContain('[private-source]:')
    expect(rewritten.explanation).toContain(
      IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER
    )
    expect((rewritten.options as any).choices[0].value).toBe(
      `![bundled choice](<${packageHref}>)`
    )
    expect((rewritten.options as any).choices[0].feedback).toContain(
      IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER
    )
    expect(collectElementMediaReferences(rewritten)).toEqual(
      expect.arrayContaining([
        { href: packageHref, kind: MediaReferenceKind.AUTO_LOAD },
        { href: bundledHref, kind: MediaReferenceKind.LINK },
        { href: omittedSharedHref, kind: MediaReferenceKind.LINK },
      ])
    )
    expect(collectElementMediaReferences(rewritten)).not.toContainEqual({
      href: bundledHref,
      kind: MediaReferenceKind.AUTO_LOAD,
    })
  })

  it('applies the export image contract to collection and case descriptions only', () => {
    const bundledHref = 'https://cdn.example.test/description.png'
    const omittedHref = 'https://tracker.example.test/description.png?sig=x'
    const packageHref = createPackageMediaHref('description')
    const replacements = new Map([[bundledHref, packageHref]])
    const collection = rewriteExportAnswerCollectionMediaReferences(
      {
        description: [
          `![bundled](${bundledHref})`,
          `[ordinary link](${bundledHref})`,
          `![omitted](${omittedHref})`,
        ].join('\n'),
        entries: [{ value: `Plain authored URL: ${bundledHref}` }],
      },
      replacements
    )
    const caseStudy = rewriteExportElementMediaReferences(
      createElement({
        type: ElementType.CASE_STUDY,
        options: {
          cases: [
            {
              title: `![literal title](${omittedHref})`,
              description: `![bundled case](${bundledHref}) ![omitted case](${omittedHref})`,
            },
          ],
        },
      }),
      replacements
    )

    expect(collection.description).toContain(`![bundled](<${packageHref}>)`)
    expect(collection.description).toContain(`[ordinary link](${bundledHref})`)
    expect(collection.description).not.toContain(omittedHref)
    expect(collection.entries).toEqual([
      { value: `Plain authored URL: ${bundledHref}` },
    ])
    expect((caseStudy.options as any).cases[0].description).toContain(
      `![bundled case](<${packageHref}>)`
    )
    expect((caseStudy.options as any).cases[0].description).not.toContain(
      omittedHref
    )
    expect((caseStudy.options as any).cases[0].title).toBe(
      `![literal title](${omittedHref})`
    )
  })

  it('omits external images in rendered option fields and collection descriptions', () => {
    const externalHref = 'https://cdn.example.test/nested.png'
    const options = {
      choices: [
        {
          feedback: `![nested feedback](${externalHref})`,
          value: `[open feedback](${externalHref})`,
          ix: 0,
        },
      ],
    }

    const element = omitExternalAutoLoadingElementMediaReferences(
      createElement({
        content: 'Question',
        explanation: `![external explanation](${externalHref})`,
        options,
      })
    )
    const collection = omitExternalAutoLoadingAnswerCollectionMediaReferences({
      description: [
        `![collection image](${externalHref})`,
        `[collection link](${externalHref})`,
      ].join('\n'),
      entries: [{ value: `![plain entry value](${externalHref})` }],
    })

    expect(collectElementMediaReferences(element)).toEqual([
      { href: externalHref, kind: MediaReferenceKind.LINK },
    ])
    expect((element.options as any).choices[0].feedback).toContain(
      IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER
    )
    expect((element.options as any).choices[0].value).toBe(
      `[open feedback](${externalHref})`
    )
    expect(collection.description).toContain(
      IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER
    )
    expect(collection.description).toContain(
      `[collection link](${externalHref})`
    )
    expect(collectAnswerCollectionMediaReferences(collection)).toEqual([
      { href: externalHref, kind: MediaReferenceKind.LINK },
    ])
    expect(collection.entries).toEqual([
      { value: `![plain entry value](${externalHref})` },
    ])
  })

  it('rewrites normalized inline and reference destinations by source span', () => {
    const sourceHref = 'https://cdn.example.test/a(b).png'
    const packageHref = createPackageMediaHref('escaped-image')
    const element = createElement({
      content: [
        '![inline](https://cdn.example.test/a\\(b\\).png "Inline")',
        '![reference][hero]',
        '',
        '[hero]: <https://cdn.example.test/a\\(b\\).png> "Reference"',
      ].join('\n'),
      explanation: '`https://cdn.example.test/a(b).png`',
      options: {
        choices: [
          {
            ix: 0,
            value: 'Choice',
            feedback: '![nested](https://cdn.example.test/a\\(b\\).png)',
          },
        ],
      },
    })

    const rewritten = rewriteElementMediaReferences(
      element,
      new Map([[sourceHref, packageHref]])
    )

    expect(rewritten.content).toBe(
      [
        `![inline](<${packageHref}> "Inline")`,
        '![reference][hero]',
        '',
        `[hero]: <${packageHref}> "Reference"`,
      ].join('\n')
    )
    expect(rewritten.explanation).toBe('`https://cdn.example.test/a(b).png`')
    expect(rewritten.options).toEqual({
      choices: [
        {
          ix: 0,
          value: 'Choice',
          feedback: `![nested](<${packageHref}>)`,
        },
      ],
    })
  })

  it('rewrites only the active duplicate definition', () => {
    const firstHref = 'https://cdn.example.test/first.png'
    const secondHref = 'https://cdn.example.test/ignored.png'
    const packageHref = createPackageMediaHref('first')
    const source = [
      '![Lecture image][hero]',
      '',
      `[hero]: ${firstHref}`,
      `[hero]: ${secondHref}`,
    ].join('\n')

    expect(
      rewriteMarkdownMediaReferences(
        source,
        new Map([[firstHref, packageHref]])
      )
    ).toBe(
      [
        '![Lecture image][hero]',
        '',
        `[hero]: <${packageHref}>`,
        `[hero]: ${secondHref}`,
      ].join('\n')
    )
  })

  it('creates and identifies package-media hrefs', () => {
    expect(PACKAGE_MEDIA_HREF_PREFIX).toBe('klicker-package-media://')
    expect(createPackageMediaHref('media-42')).toBe(
      'klicker-package-media://media-42'
    )
    expect(isPackageMediaHref(createPackageMediaHref('media-42'))).toBe(true)
    expect(isPackageMediaHref('https://cdn.example.test/media-42')).toBe(false)
  })

  it('detects package-media refs across every supported Markdown form', () => {
    const packageHrefs = [
      createPackageMediaHref('inline-image'),
      createPackageMediaHref('inline-link'),
      createPackageMediaHref('raw-link'),
      createPackageMediaHref('reference-image'),
      createPackageMediaHref('nested-option'),
    ]
    const element = createElement({
      content: [
        `![image](${packageHrefs[0]})`,
        `[link](${packageHrefs[1]})`,
        `Raw: ${packageHrefs[2]}.`,
        '![reference][package-image]',
        '',
        `[package-image]: ${packageHrefs[3]}`,
      ].join('\n'),
      options: {
        choices: [
          {
            ix: 0,
            value: 'Choice',
            feedback: `![nested](${packageHrefs[4]})`,
          },
        ],
      },
    })

    const references = collectElementMediaReferences(element)
    const detectedPackageHrefs = references
      .map(({ href }) => href)
      .filter(isPackageMediaHref)

    expect(new Set(detectedPackageHrefs)).toEqual(new Set(packageHrefs))
    expect(references).toEqual(
      expect.arrayContaining([
        { href: packageHrefs[0], kind: MediaReferenceKind.AUTO_LOAD },
        { href: packageHrefs[1], kind: MediaReferenceKind.LINK },
        { href: packageHrefs[2], kind: MediaReferenceKind.LINK },
        { href: packageHrefs[3], kind: MediaReferenceKind.AUTO_LOAD },
        { href: packageHrefs[4], kind: MediaReferenceKind.AUTO_LOAD },
      ])
    )
    expect(references).toHaveLength(packageHrefs.length)
  })

  it('never treats plain grading or structural option strings as Markdown', () => {
    const literal = '![literal](https://cdn.example.test/literal.png)'
    const replacement = createPackageMediaHref('should-not-be-used')
    const replacements = new Map([
      ['https://cdn.example.test/literal.png', replacement],
    ])
    const freeText = createElement({
      type: ElementType.FREE_TEXT,
      options: { solutions: [literal] },
    })
    const numerical = createElement({
      type: ElementType.NUMERICAL,
      options: { unit: literal, placeholder: literal },
    })
    const caseStudy = createElement({
      type: ElementType.CASE_STUDY,
      options: {
        criteria: [
          {
            id: literal,
            name: literal,
            min: 0,
            max: 1,
            step: 1,
            unit: literal,
            labels: { min: literal, max: literal },
          },
        ],
        cases: [
          {
            id: literal,
            title: literal,
            description: '![rendered](https://cdn.example.test/rendered.png)',
          },
        ],
      },
    })

    for (const element of [freeText, numerical]) {
      expect(collectElementMediaReferences(element)).toEqual([])
      expect(rewriteElementMediaReferences(element, replacements).options).toBe(
        element.options
      )
      expect(
        omitExternalAutoLoadingElementMediaReferences(element).options
      ).toBe(element.options)
    }

    expect(collectElementMediaReferences(caseStudy)).toEqual([
      {
        href: 'https://cdn.example.test/rendered.png',
        kind: MediaReferenceKind.AUTO_LOAD,
      },
    ])
    const omittedCase = omitExternalAutoLoadingElementMediaReferences(caseStudy)
    expect((omittedCase.options as any).criteria[0]).toEqual(
      (caseStudy.options as any).criteria[0]
    )
    expect((omittedCase.options as any).cases[0].title).toBe(literal)
    expect((omittedCase.options as any).cases[0].description).toContain(
      IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER
    )
  })

  it('classifies answer-collection descriptions as Markdown and entries as plain text', () => {
    const descriptionHref = '//attacker.example.test/description.png'
    const entryHref = 'https://cdn.example.test/plain-entry.png'

    expect(
      collectAnswerCollectionMediaReferences({
        description: `![description](${descriptionHref})`,
        entries: [{ value: `![plain entry](${entryHref})` }],
      })
    ).toEqual([
      {
        href: descriptionHref,
        kind: MediaReferenceKind.AUTO_LOAD,
      },
      {
        href: entryHref,
        kind: MediaReferenceKind.LINK,
      },
    ])
  })

  it('rewrites collection Markdown destinations and plain entry URLs', () => {
    const packageHref = createPackageMediaHref('collection-image')
    const finalizedHref =
      'https://testaccount.blob.core.windows.net/importer/final.png'
    const rewritten = rewriteAnswerCollectionMediaReferences(
      {
        description:
          '![description](klicker\\-package\\-media://collection\\-image)',
        entries: [{ value: `Source URL: ${packageHref}` }],
      },
      new Map([[packageHref, finalizedHref]])
    )

    expect(rewritten).toEqual({
      description: `![description](<${finalizedHref}>)`,
      entries: [{ value: `Source URL: ${finalizedHref}` }],
    })
  })
})
