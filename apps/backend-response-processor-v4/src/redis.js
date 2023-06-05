import * as Sentry from '@sentry/node';
import Redis from 'ioredis';
let redis;
function getRedis() {
    if (!redis) {
        try {
            redis = new Redis({
                family: 4,
                host: process.env.REDIS_HOST,
                password: process.env.REDIS_PASS ?? '',
                port: Number(process.env.REDIS_PORT) ?? 6379,
                tls: process.env.REDIS_TLS ? {} : undefined,
            });
        }
        catch (e) {
            Sentry.captureException(e);
        }
    }
    return redis;
}
export default getRedis;
