import { Redis } from 'ioredis'
import { logger } from './logger.js'

let redis: Redis
export function getRedis() {
  if (!redis) {
    try {
      redis = new Redis({
        family: 4,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASS ?? '',
        port: Number(process.env.REDIS_PORT) ?? 6379,
        tls: process.env.REDIS_TLS ? {} : undefined,
      })
    } catch {
      logger.error(
        { event: 'dependency.unavailable', dependency: 'redis' },
        'Redis client initialization failed'
      )
      throw new Error('Redis client initialization failed')
    }
  }

  return redis
}

let redisAssessment: Redis
export function getAssessmentRedis() {
  if (!redisAssessment) {
    try {
      redisAssessment = new Redis({
        family: 4,
        host: process.env.REDIS_ASSESSMENT_HOST,
        password: process.env.REDIS_ASSESSMENT_PASS ?? '',
        port: Number(process.env.REDIS_ASSESSMENT_PORT ?? 6381),
        tls: process.env.REDIS_ASSESSMENT_TLS ? {} : undefined,
      })
    } catch {
      logger.error(
        { event: 'dependency.unavailable', dependency: 'redis-assessment' },
        'Assessment Redis client initialization failed'
      )
      throw new Error('Assessment Redis client initialization failed')
    }
  }

  return redisAssessment
}
