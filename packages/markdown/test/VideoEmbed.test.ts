import { describe, expect, it } from 'vitest'
import {
  getKalturaId,
  getKalturaPartnerId,
  getKalturaUiConfId,
  getYoutubeId,
} from '../src/VideoEmbed.js'

describe('VideoEmbed parsing utilities', () => {
  describe('getYoutubeId', () => {
    it('extracts ID from standard watch URLs', () => {
      expect(getYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
      expect(
        getYoutubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share')
      ).toBe('dQw4w9WgXcQ')
      expect(getYoutubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
    })

    it('extracts ID from shortened URLs', () => {
      expect(getYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(getYoutubeId('https://www.youtu.be/dQw4w9WgXcQ?t=12')).toBe(
        'dQw4w9WgXcQ'
      )
    })

    it('extracts ID from embed URLs', () => {
      expect(getYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
      expect(
        getYoutubeId('https://youtube.com/embed/dQw4w9WgXcQ?autoplay=1')
      ).toBe('dQw4w9WgXcQ')
    })

    it('returns null for unapproved hosts', () => {
      expect(
        getYoutubeId('https://evil.example/watch?v=dQw4w9WgXcQ')
      ).toBeNull()
      expect(
        getYoutubeId('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')
      ).toBeNull()
      expect(
        getYoutubeId('https://notyoutube.com/embed/dQw4w9WgXcQ')
      ).toBeNull()
    })

    it('returns null for relative or broken URLs', () => {
      expect(getYoutubeId('/embed/dQw4w9WgXcQ')).toBeNull()
      expect(getYoutubeId('watch?v=dQw4w9WgXcQ')).toBeNull()
      expect(getYoutubeId('')).toBeNull()
    })

    it('returns null for invalid or malformed YouTube IDs', () => {
      expect(getYoutubeId('https://youtube.com/watch?v=tooShort')).toBeNull()
      expect(
        getYoutubeId('https://youtube.com/watch?v=tooLong12345')
      ).toBeNull()
      expect(getYoutubeId('https://youtube.com/watch?v=hasSpecial!')).toBeNull()
    })
  })

  describe('getKalturaId', () => {
    it('extracts ID from hosted Kaltura URLs', () => {
      expect(
        getKalturaId(
          'https://uzh.mediaspace.cast.switch.ch/media/10+Untersuchung+Kopf+beim+Hund/0_ipqc15ga/124135'
        )
      ).toBe('0_ipqc15ga')
      expect(
        getKalturaId(
          'https://uzh.mediaspace.cast.switch.ch/media/some-title/0_um01ms1s'
        )
      ).toBe('0_um01ms1s')
    })

    it('extracts ID from raw embed iframe URLs', () => {
      expect(
        getKalturaId(
          'https://uzh.mediaspace.cast.switch.ch/embed/secure/iframe/entryId/0_um01ms1s/uiConfId/23449004/st/0'
        )
      ).toBe('0_um01ms1s')
    })

    it('returns null for unapproved Kaltura hosts', () => {
      expect(
        getKalturaId('https://evil.example/media/some-title/0_um01ms1s')
      ).toBeNull()
    })

    it('returns null for relative or invalid paths', () => {
      expect(getKalturaId('/media/some-title/0_um01ms1s')).toBeNull()
      expect(
        getKalturaId(
          'https://uzh.mediaspace.cast.switch.ch/media/some-title/invalid_id'
        )
      ).toBeNull()
    })
  })

  describe('getKalturaPartnerId', () => {
    it('extracts partner ID from hosted URLs if present or defaults to 106', () => {
      expect(
        getKalturaPartnerId(
          'https://uzh.mediaspace.cast.switch.ch/media/title/0_um01ms1s'
        )
      ).toBe('106')
    })

    it('extracts partner ID from iframe embed query string', () => {
      expect(
        getKalturaPartnerId(
          'https://uzh.mediaspace.cast.switch.ch/embed/secure/iframe/entryId/0_um01ms1s?partnerId=123'
        )
      ).toBe('123')
    })
  })

  describe('getKalturaUiConfId', () => {
    it('extracts uiConfId from raw embed path', () => {
      expect(
        getKalturaUiConfId(
          'https://uzh.mediaspace.cast.switch.ch/embed/secure/iframe/entryId/0_um01ms1s/uiConfId/23449004/st/0'
        )
      ).toBe('23449004')
    })

    it('extracts uiConfId from query parameter if present', () => {
      expect(
        getKalturaUiConfId(
          'https://uzh.mediaspace.cast.switch.ch/embed/secure/iframe/entryId/0_um01ms1s?uiConfId=987654'
        )
      ).toBe('987654')
    })

    it('returns default uiConfId if not present', () => {
      expect(
        getKalturaUiConfId(
          'https://uzh.mediaspace.cast.switch.ch/media/title/0_um01ms1s'
        )
      ).toBe('23449004')
    })
  })
})
