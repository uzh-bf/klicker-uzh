export interface User {
  id: string
  email: string
  shortname: string
  provider: string
  providerAccountId: string
}

export interface Course {
  id: string
  owner: User
  name: string
}

export const userOne: User = {
  id: '36aacf24-65d2-41a2-8ccd-b6c870108cd0',
  email: 'first@example.com',
  shortname: 'firstuser',
  provider: 'firstprovider',
  providerAccountId: '1234567890@firstprovider.ch',
}

export const userTwo: User = {
  id: 'a3b09363-f5bd-4358-8359-f3efcb5f7f7f',
  email: 'second@example.com',
  shortname: 'seconduser',
  provider: 'secondprovider',
  providerAccountId: '2345678901@secondprovider.ch',
}

export const courseOne: Course = {
  id: 'ad248322-d357-43bd-8912-52ff6794b94d',
  owner: userOne,
  name: 'Test Course One',
}

export const courseTwo: Course = {
  id: '778011ac-a0e2-4cdb-a95c-1491a515fafc',
  owner: userOne,
  name: 'Test Course Two',
}

export const courseThree: Course = {
  id: '0f99f142-065a-4333-8905-5eba73c2ffdd',
  owner: userTwo,
  name: 'Test Course Three',
}

export const courseFour: Course = {
  id: '35dc67b3-0b27-40b7-840f-57e6e6f9dee2',
  owner: userTwo,
  name: 'Test Course Four',
}

export const courseFive: Course = {
  id: 'b91a3592-24ec-46ab-9957-8793329819e8',
  owner: userTwo,
  name: 'Test Course Five',
}

export const courseArchivedOne: Course = {
  id: 'dc31d03f-0a2a-4d20-8313-a04c62fcfd9a',
  owner: userOne,
  name: 'Archived Course One',
}

export const courseArchivedTwo: Course = {
  id: 'fecbe18f-04ee-43c1-851d-1a811ed5a085',
  owner: userTwo,
  name: 'Archived Course Two',
}
