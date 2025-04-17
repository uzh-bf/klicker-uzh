import { ObjectAccess } from '@klicker-uzh/prisma'

// answer collection 1
export const answerCollection1 = {
  name: 'Answer Collection 1',
  description: 'This is the first answer collection',
  entries: ['entry1', 'entry2', 'entry3', 'entry4'],
}

// answer collection 2
export const answerCollection2 = {
  name: 'Answer Collection 2',
  description: 'This is the second answer collection',
  entries: ['entry5', 'entry6', 'entry7', 'entry8'],
}

// catalog collection 1 (public)
export const catalogCollection1 = {
  name: 'Public Catalog Collection',
  access: ObjectAccess.PUBLIC,
}

// catalog collection 2 (restricted)
export const catalogCollection2 = {
  name: 'Restricted Catalog Collection',
  access: ObjectAccess.RESTRICTED,
}
