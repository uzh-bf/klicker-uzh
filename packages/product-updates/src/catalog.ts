import type { ProductUpdate } from './types.js'

// Newest entry first — consumers present the list in array order, and the
// validation suite enforces the ordering. Entries are never deleted; an entry
// that should stop being shown gets an `expiresAt` instead, so that the history
// of what was announced stays reconstructible.
export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: 'v3-3-release',
    // The publication time of the Community release topic linked below.
    publishedAt: '2025-08-21T14:03:50.131Z',
    audiences: ['lecturer', 'student'],
    surfaces: ['manage', 'pwa', 'docs'],
    maturity: 'released',
    title: {
      de: 'KlickerUZH v3.3 ist erschienen',
      en: 'KlickerUZH v3.3 has been released',
    },
    summary: {
      de: 'Gamifizierte Live-Quiz laufen neu auch ohne Kurs und mit temporären Teilnahmekonten. Die neuen Fragetypen Auswahl und Fallstudie stehen allen zur Verfügung.',
      en: 'Gamified live quizzes now also run without a course and with temporary participant accounts. The new selection and case study question types are available to everyone.',
    },
    bodyMarkdown: {
      de: [
        'Diese Version entstand aus der Zusammenarbeit mit der Medizinischen Fakultät der UZH.',
        '',
        '- Gamifizierte Live-Quiz können eigenständig oder in nicht gamifizierten Kursen durchgeführt werden.',
        '- Temporäre Teilnahmekonten erlauben die Teilnahme mit Pseudonym und Avatar ohne reguläres Konto.',
        '- Basis-, Korrektheits- und Bonuspunkte der Live-Quiz-Bewertung sind frei konfigurierbar.',
        '- Die Fragetypen Auswahl und Fallstudie sind für alle freigeschaltet.',
      ].join('\n'),
      en: [
        'This release grew out of the collaboration with the UZH Faculty of Medicine.',
        '',
        '- Gamified live quizzes can run standalone or inside otherwise non-gamified courses.',
        '- Temporary participant accounts allow joining with a pseudonym and avatar, without a regular account.',
        '- Base, correctness, and bonus points of the live quiz grading are fully configurable.',
        '- The selection and case study question types are available to all users.',
      ].join('\n'),
    },
    detailsUrl:
      'https://community.klicker.uzh.ch/t/klickeruzh-v3-3-release-information/439',
    promotions: ['feed'],
    suppressInAssessment: true,
  },
]
