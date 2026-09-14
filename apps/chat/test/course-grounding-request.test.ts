import { describe, expect, it } from 'vitest'
import {
  requestsCourseGrounding,
  shouldSearchCourseMaterial,
} from '../src/lib/server/courseGroundingRequest'

describe('explicit course grounding request', () => {
  it.each([
    'Please ground that explanation in the course material.',
    'Can you help? Please ground that explanation in the course materia Please answer in English.',
    'Explain using the lecture notes.',
    'Please search the course notes.',
    'Bitte erkläre das anhand der Kursunterlagen.',
    'Nutze die Vorlesungsunterlagen.',
  ])('recognizes an explicit request: %s', (text) => {
    expect(requestsCourseGrounding(text)).toBe(true)
  })
  it.each([
    'Where does a company get its money?',
    'What are course materials?',
    "Don't use the course material.",
    'Do not search the course notes.',
    'Explain without using the lecture notes.',
    'Bitte nutze keine Kursunterlagen.',
    'Suche nicht in den Kursmaterialien.',
    '',
  ])('leaves ordinary or opted-out requests alone: %s', (text) => {
    expect(requestsCourseGrounding(text)).toBe(false)
  })
})

describe('default course search', () => {
  it.each([
    'Hi!',
    'THANK YOU.',
    'Okay…',
    '  Vielen Dank!  ',
    'Alles klar',
    'Do not use the course material.',
    'Nutze keine Kursunterlagen.',
  ])('does not require search for %s', (text) => {
    expect(shouldSearchCourseMaterial(text)).toBe(false)
  })
  it.each([
    'Why?',
    'Yes',
    'Explain that again.',
    'I don’t understand where company money comes from.',
    'Hi, where does company money come from?',
    'Thanks, but why?',
    'What does okay mean?',
    'Bitte erkläre das.',
    '',
  ])('defaults to search for %s', (text) => {
    expect(shouldSearchCourseMaterial(text)).toBe(true)
  })
})
