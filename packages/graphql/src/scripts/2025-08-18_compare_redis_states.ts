/**
 * Script to compare Redis states between lq: and lqV2: prefixes
 * This enables verification that Azure Functions and Hatchet processors
 * are producing identical results during parallel testing.
 *
 * Usage: pnpm run script src/scripts/2025-08-18_compare_redis_states.ts [quizId]
 */

import { prisma } from '@klicker-uzh/prisma'
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASS,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
})

interface ComparisonResult {
  quizId: string
  timestamp: Date
  keyComparison: {
    lqOnly: string[]
    lqV2Only: string[]
    common: string[]
  }
  valueDifferences: {
    key: string
    lqValue: any
    lqV2Value: any
    difference: string
  }[]
  summary: {
    totalKeys: number
    matchingKeys: number
    matchingValues: number
    discrepancies: number
  }
}

async function getKeysWithPrefix(prefix: string): Promise<string[]> {
  const keys = await redis.keys(`${prefix}:*`)
  return keys.sort()
}

async function compareHashValues(key1: string, key2: string): Promise<boolean> {
  const [hash1, hash2] = await Promise.all([
    redis.hgetall(key1),
    redis.hgetall(key2),
  ])

  // Sort keys for consistent comparison
  const keys1 = Object.keys(hash1).sort()
  const keys2 = Object.keys(hash2).sort()

  if (keys1.length !== keys2.length) {
    return false
  }

  for (const key of keys1) {
    if (!keys2.includes(key) || hash1[key] !== hash2[key]) {
      return false
    }
  }

  return true
}

async function getDetailedDifference(key1: string, key2: string): Promise<any> {
  const type = await redis.type(key1)

  if (type === 'hash') {
    const [hash1, hash2] = await Promise.all([
      redis.hgetall(key1),
      redis.hgetall(key2),
    ])

    const allKeys = new Set([...Object.keys(hash1), ...Object.keys(hash2)])
    const differences: any = {}

    for (const key of allKeys) {
      if (hash1[key] !== hash2[key]) {
        differences[key] = {
          lq: hash1[key] || 'undefined',
          lqV2: hash2[key] || 'undefined',
        }
      }
    }

    return differences
  }

  // For other types, just get the values
  const [val1, val2] = await Promise.all([redis.get(key1), redis.get(key2)])

  return {
    lq: val1,
    lqV2: val2,
  }
}

async function compareQuizStates(quizId: string): Promise<ComparisonResult> {
  console.log(`\n🔍 Comparing Redis states for quiz: ${quizId}\n`)

  const lqKeys = await getKeysWithPrefix(`lq:${quizId}`)
  const lqV2Keys = await getKeysWithPrefix(`lqV2:${quizId}`)

  // Convert to relative keys (without prefix) for comparison
  const lqRelativeKeys = lqKeys.map((k) => k.replace(`lq:${quizId}:`, ''))
  const lqV2RelativeKeys = lqV2Keys.map((k) => k.replace(`lqV2:${quizId}:`, ''))

  const lqSet = new Set(lqRelativeKeys)
  const lqV2Set = new Set(lqV2RelativeKeys)

  const lqOnly = lqRelativeKeys.filter((k) => !lqV2Set.has(k))
  const lqV2Only = lqV2RelativeKeys.filter((k) => !lqSet.has(k))
  const common = lqRelativeKeys.filter((k) => lqV2Set.has(k))

  console.log(`📊 Key Analysis:`)
  console.log(`  - Total lq: keys: ${lqKeys.length}`)
  console.log(`  - Total lqV2: keys: ${lqV2Keys.length}`)
  console.log(`  - Common keys: ${common.length}`)
  console.log(`  - lq: only: ${lqOnly.length}`)
  console.log(`  - lqV2: only: ${lqV2Only.length}`)

  // Compare values for common keys
  const valueDifferences: ComparisonResult['valueDifferences'] = []
  let matchingValues = 0

  for (const relativeKey of common) {
    const lqKey = `lq:${quizId}:${relativeKey}`
    const lqV2Key = `lqV2:${quizId}:${relativeKey}`

    const matching = await compareHashValues(lqKey, lqV2Key)

    if (matching) {
      matchingValues++
    } else {
      const difference = await getDetailedDifference(lqKey, lqV2Key)
      valueDifferences.push({
        key: relativeKey,
        lqValue: null,
        lqV2Value: null,
        difference: JSON.stringify(difference, null, 2),
      })
    }
  }

  const result: ComparisonResult = {
    quizId,
    timestamp: new Date(),
    keyComparison: {
      lqOnly,
      lqV2Only,
      common,
    },
    valueDifferences,
    summary: {
      totalKeys: lqKeys.length + lqV2Keys.length,
      matchingKeys: common.length,
      matchingValues,
      discrepancies: valueDifferences.length + lqOnly.length + lqV2Only.length,
    },
  }

  return result
}

async function compareAllQuizzes(): Promise<ComparisonResult[]> {
  // Find all quiz IDs in Redis
  const allKeys = await redis.keys('lq:*:meta')
  const quizIds = allKeys.map((k) => k.split(':')[1])

  console.log(`\n🎯 Found ${quizIds.length} quizzes to compare\n`)

  const results: ComparisonResult[] = []

  for (const quizId of quizIds) {
    const result = await compareQuizStates(quizId)
    results.push(result)
  }

  return results
}

function generateReport(results: ComparisonResult[]): void {
  console.log('\n' + '='.repeat(80))
  console.log('📋 REDIS STATE COMPARISON REPORT')
  console.log('='.repeat(80) + '\n')

  let totalDiscrepancies = 0
  let perfectMatches = 0

  for (const result of results) {
    const { quizId, summary, keyComparison, valueDifferences } = result

    console.log(`\n📌 Quiz: ${quizId}`)
    console.log('-'.repeat(40))

    if (summary.discrepancies === 0) {
      console.log('PERFECT MATCH - No discrepancies found')
      perfectMatches++
    } else {
      console.log(` DISCREPANCIES FOUND: ${summary.discrepancies}`)
      totalDiscrepancies += summary.discrepancies

      if (keyComparison.lqOnly.length > 0) {
        console.log('\n  Keys only in lq:')
        keyComparison.lqOnly
          .slice(0, 5)
          .forEach((k) => console.log(`    - ${k}`))
        if (keyComparison.lqOnly.length > 5) {
          console.log(`    ... and ${keyComparison.lqOnly.length - 5} more`)
        }
      }

      if (keyComparison.lqV2Only.length > 0) {
        console.log('\n  Keys only in lqV2:')
        keyComparison.lqV2Only
          .slice(0, 5)
          .forEach((k) => console.log(`    - ${k}`))
        if (keyComparison.lqV2Only.length > 5) {
          console.log(`    ... and ${keyComparison.lqV2Only.length - 5} more`)
        }
      }

      if (valueDifferences.length > 0) {
        console.log('\n  Value differences:')
        valueDifferences.slice(0, 3).forEach((diff) => {
          console.log(`    - ${diff.key}:`)
          console.log(`      ${diff.difference.split('\n').join('\n      ')}`)
        })
        if (valueDifferences.length > 3) {
          console.log(
            `    ... and ${valueDifferences.length - 3} more differences`
          )
        }
      }
    }

    console.log(`\n  Summary:`)
    console.log(`    - Total keys: ${summary.totalKeys}`)
    console.log(`    - Matching keys: ${summary.matchingKeys}`)
    console.log(`    - Matching values: ${summary.matchingValues}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 OVERALL SUMMARY')
  console.log('='.repeat(80))
  console.log(`  - Total quizzes analyzed: ${results.length}`)
  console.log(`  - Perfect matches: ${perfectMatches}`)
  console.log(
    `  - Quizzes with discrepancies: ${results.length - perfectMatches}`
  )
  console.log(`  - Total discrepancies: ${totalDiscrepancies}`)
  console.log()

  if (totalDiscrepancies === 0) {
    console.log('🎉 SUCCESS: All Redis states match perfectly!')
  } else {
    console.log(
      ' WARNING: Discrepancies detected. Review the differences above.'
    )
  }
}

async function main() {
  try {
    const quizId = process.argv[2]

    let results: ComparisonResult[]

    if (quizId) {
      // Compare specific quiz
      const result = await compareQuizStates(quizId)
      results = [result]
    } else {
      // Compare all quizzes
      results = await compareAllQuizzes()
    }

    generateReport(results)

    // Save detailed results to file if needed
    if (process.env.SAVE_COMPARISON_REPORT === 'true') {
      const fs = await import('fs/promises')
      const filename = `redis-comparison-${new Date().toISOString().split('T')[0]}.json`
      await fs.writeFile(filename, JSON.stringify(results, null, 2))
      console.log(`\n💾 Detailed report saved to: ${filename}`)
    }
  } catch (error) {
    console.error('Error during comparison:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    redis.disconnect()
  }
}

main()
