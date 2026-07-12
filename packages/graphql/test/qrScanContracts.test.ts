import type { GraphQLEnumType, GraphQLObjectType } from 'graphql'
import { describe, expect, it } from 'vitest'
import { schema } from '../src/index.js'

describe('QR scan GraphQL contracts', () => {
  it('serializes QR_SCAN and exposes only safe participant fields', () => {
    const elementType = schema.getType('ElementType')
    const qrScanData = schema.getType('QrScanElementData')

    expect(elementType?.constructor.name).toBe('GraphQLEnumType')
    expect((elementType as GraphQLEnumType).serialize('QR_SCAN')).toBe(
      'QR_SCAN'
    )
    expect(qrScanData?.constructor.name).toBe('GraphQLObjectType')
    expect(Object.keys((qrScanData as GraphQLObjectType).getFields())).toEqual(
      expect.arrayContaining([
        'id',
        'elementId',
        'name',
        'type',
        'content',
        'explanation',
        'basePoints',
        'pointsMultiplier',
      ])
    )
    expect((qrScanData as GraphQLObjectType).getFields()).not.toHaveProperty(
      'qrScanCode'
    )
  })
})
