import type { ProductUpdate } from './types.js'

// Newest entry first — consumers present the list in array order, and the
// validation suite enforces the ordering. Entries are never deleted; an entry
// that should stop being shown gets an `expiresAt` instead, so that the history
// of what was announced stays reconstructible.
export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: 'v3-4-release',
    publishedAt: '2026-09-03T00:00:00.000Z',
    audiences: ['lecturer', 'student'],
    surfaces: ['manage', 'pwa', 'chat', 'docs'],
    maturity: 'preview',
    title: {
      de: 'KlickerUZH v3.4: KI-Funktionen in der Beta',
      en: 'KlickerUZH v3.4: AI features in beta',
    },
    summary: {
      de: 'Dozierende können kursbezogene Chatbots mit eigenen Wissensbasen einrichten, Fragen mit KI-Unterstützung erstellen und einen Assistenten in der Verwaltung nutzen. Studierende erhalten im Kurs einen Chat, der auf den freigegebenen Materialien basiert.',
      en: 'Lecturers can set up course chatbots with their own knowledge bases, create questions with AI assistance, and use an assistant in the management interface. Students get an in-course chat grounded in the released course materials.',
    },
    bodyMarkdown: {
      de: [
        'Die KI-Funktionen werden schrittweise für Dozierende freigeschaltet und sind als Beta gekennzeichnet.',
        '',
        '- Kurs-Chatbots mit Wissensbasen aus Dateien und Webseiten, inklusive Entwurf, Vorschau und Freigabe.',
        '- Kursbezogener Chat für Studierende, auch eingebettet im LMS (z. B. OLAT).',
        '- Ein Assistent in der Verwaltung, der Änderungen vorschlägt, die vor der Übernahme geprüft werden.',
        '- KI-gestützte Erstellung von Fragen mit Prüfung jedes einzelnen Vorschlags durch die Dozierenden.',
        '- Wissensgraphen und kuratierte Antwortbeispiele zur Verbesserung der Antworten.',
        '- Nutzungs- und Kostenlimiten, damit der Einsatz planbar bleibt.',
      ].join('\n'),
      en: [
        'The AI features are rolled out to lecturers in stages and are marked as beta.',
        '',
        '- Course chatbots with knowledge bases built from files and web pages, including draft, preview, and publication.',
        '- Course-scoped chat for students, also embedded in the LMS (e.g. OLAT).',
        '- An assistant in the management interface that proposes changes for review before they are applied.',
        '- AI-assisted question generation with lecturer review of every single proposal.',
        '- Knowledge graphs and curated response examples to improve answers.',
        '- Usage and cost limits so adoption stays predictable.',
      ].join('\n'),
    },
    promotions: ['feed'],
    suppressInAssessment: true,
  },
]
