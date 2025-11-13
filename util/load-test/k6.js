import { check, sleep } from 'k6'
import http from 'k6/http'

export const options = {
  //   stages: [
  //     { duration: '10s', target: 10 },
  //     { duration: '20s', target: 25 },
  //     { duration: '30s', target: 100 },
  //     { duration: '1m', target: 250 },
  //     { duration: '30s', target: 50 },
  //     { duration: '10s', target: 0 },
  //   ],

  noConnectionReuse: true,
}

const urls = [
  'https://manage.klicker.stg.df-app.ch',
  'https://control.klicker.stg.df-app.ch',
  'https://pwa.klicker.stg.df-app.ch',
  'https://auth.klicker.stg.df-app.ch',
  'https://chat.klicker.stg.df-app.ch',
  'https://olat-api.klicker.stg.df-app.ch/health',
]

export default function () {
  const res = http.get('https://manage.klicker.stg.df-app.ch')
  check(res, { 'status 200': (r) => r.status === 200 })

  sleep(1)
}
