import {
  cleanupDatabase,
  ensureDatabaseViews,
  seedDatabase,
} from '../global-setup.js'

export async function cleanupTest() {
  await ensureDatabaseViews()
  await cleanupDatabase()
  await seedDatabase()
}
