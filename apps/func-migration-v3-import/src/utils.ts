import { QuestionType } from "@klicker-uzh/prisma"

export function sliceIntoChunks(array: any[], chunkSize: number) {
    const result = []
    let index = 0
    while (index < array.length) {
        result.push(array.slice(index, index + chunkSize))
        index += chunkSize
    }
    return result
}

// used to extract the string (e.g., objectId, createdAt, etc.) inside "\"...\""
export const extractString = (stringItem: string) => {
    const pattern = /"(.*)"/
    const match = stringItem.match(pattern)
  
    return match ? match[1] : stringItem
}

export const QuestionTypeMap: Record<string, QuestionType> = {
    SC: 'SC',
    MC: 'MC',
    FREE_RANGE: 'NUMERICAL',
    FREE: 'FREE_TEXT',
}

