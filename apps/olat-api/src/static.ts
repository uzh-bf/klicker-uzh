import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { ActivityType, availableActivityConfigurationKeys } from './types.js'

async function readData(): Promise<{
  activityTypesAvailable: ActivityType[]
  activityKeysGeneral: string[]
}> {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const dataPath = path.join(__dirname, '../static/activityTypes.json')
    const data = await fs.readFile(dataPath, 'utf-8')
    const activityTypesAvailable: ActivityType[] = JSON.parse(data)
    const activityKeysGeneral = activityTypesAvailable
      .map((activityType) => activityType.olatConfigurationKey)
      .filter((key) => !availableActivityConfigurationKeys.includes(key))
    return { activityTypesAvailable, activityKeysGeneral }
  } catch (error) {
    console.error('Error reading data:', error)
    process.exit(1)
  }
}

export const { activityTypesAvailable, activityKeysGeneral } = await readData()
