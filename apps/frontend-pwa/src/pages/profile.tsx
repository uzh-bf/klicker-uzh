import { useMutation, useQuery } from '@apollo/client'
import {
  LogoutParticipantDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H2 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Image from 'next/image'
import Router from 'next/router'
import Layout from '../components/Layout'

const Profile = () => {
  const { data, loading } = useQuery(SelfDocument)
  const [logoutParticipant] = useMutation(LogoutParticipantDocument)

  if (loading || !data?.self) return <div>loading...</div>

  const pageInFrame = window && window?.location !== window?.parent.location

  return (
    <Layout courseName="KlickerUZH" displayName="Mein Profil">
      <div className="flex flex-col gap-8 md:max-w-3xl md:border md:rounded md:p-4 md:mx-auto md:w-full">
        <div className="flex flex-row gap-4">
          <div className="relative flex-none border-b-4 w-36 h-36 ">
            <Image
              className="bg-white"
              src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
                data.self.avatar ?? 'placeholder'
              }.svg`}
              alt=""
              fill
            />
          </div>
          <div className="flex-1">
            <H1>{data.self.username}</H1>

            <Button
              fluid
              onClick={() => Router.replace('/editProfile')}
              className={{ root: 'mt-2' }}
            >
              Profil editieren
            </Button>

            {!pageInFrame && (
              <Button
                fluid
                onClick={async () => {
                  await logoutParticipant()
                  Router.replace('/login')
                }}
                className={{ root: 'mt-2' }}
              >
                Ausloggen
              </Button>
            )}
          </div>
        </div>

        <div>
          <H2>Errungenschaften</H2>
          {!data.self.achievements ||
            (data.self.achievements?.length == 0 && (
              <div>Bisher keine Errungenschaften</div>
            ))}
          <div className="grid gap-4 mt-2 md:grid-cols-2">
            {data.self.achievements?.map((achievement) => (
              <div
                key={achievement.id}
                className="flex flex-row gap-6 p-2 pl-4 border rounded"
              >
                <div className="relative flex-initial w-10">
                  <Image
                    src={achievement.achievement.icon}
                    fill
                    alt=""
                    style={{
                      filter: achievement.achievement.iconColor,
                    }}
                  />
                </div>

                <div className="flex-1">
                  <div className="text-sm font-bold text-ellipsis">
                    {achievement.achievement.name}
                  </div>
                  <div className="text-xs">
                    {achievement.achievement.description}
                  </div>
                  <div className="flex flex-row justify-between pt-1 mt-1 text-xs border-t">
                    <div>{achievement.achievedCount}x</div>
                    <div>
                      {dayjs(achievement.achievedAt).format('DD.MM.YYYY')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="self-center mt-8">
          <Image
            src="/KlickerLogo.png"
            width={200}
            height={60}
            alt="KlickerUZH Logo"
          />
        </div>
      </div>
    </Layout>
  )
}
export default Profile
