import { Redis } from 'ioredis'

let redis: Redis
export function getRedis() {
  if (!redis) {
    try {
      redis = new Redis({
        family: 4,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASS ?? '',
        port: Number(process.env.REDIS_PORT ?? 6379),
        tls: process.env.REDIS_TLS ? {} : undefined,
      })
    } catch (e) {
      console.error('Redis connection error', e)
      throw e
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
    } catch (e) {
      console.error('Redis connection error', e)
      throw e
    }
  }

  return redisAssessment
}
