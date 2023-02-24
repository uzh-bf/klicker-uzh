import { faStar } from '@fortawesome/free-regular-svg-icons'
import { faShieldHeart, faTrophy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Level } from '@klicker-uzh/graphql/dist/ops'
import { Label } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

interface ProfileProps {
  isSelf?: boolean
  username: string
  xp: number
  level?: Level | null
  achievements?: any[] | null
  avatar?: string | null
}

function ProfileData({
  isSelf = false,
  username,
  xp,
  level,
  achievements,
  avatar,
}: ProfileProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col items-center p-5 mx-auto border rounded-md shadow-md">
      <div className="relative mb-2">
        <div className="w-[180px] h-[180px] rounded-full border border-solid border-black">
          <Image
            src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
              avatar ?? 'placeholder'
            }.svg`}
            alt=""
            className="overflow-hidden w-[180px] h-[180px] rounded-full"
            fill
          />
          {level && (
            <div className="absolute right-0 -bottom-2">
              <Image
                src={`${process.env.NEXT_PUBLIC_IMAGE_BASE_PATH}/levels/level_${level.index}.svg`}
                width={50}
                height={50}
                alt="Level"
                className="object-contain"
              />
            </div>
          )}
        </div>
      </div>
      <Label
        label={username}
        className={{ root: 'text-xl font-bold pb-4 w-full justify-center' }}
      />
      <div className="flex flex-col w-full">
        <div className="flex flex-col justify-between md:flex-row">
          {level && (
            <div className="flex flex-row">
              <FontAwesomeIcon icon={faTrophy} className="pr-2" />
              <Label
                label={`Level: ${level.index}`}
                className={{ root: 'font-bold text-sm' }}
              />
            </div>
          )}
          <div className="flex flex-row">
            <FontAwesomeIcon icon={faStar} className="pr-2" />
            <Label
              label={`Erfahrungspunkte: ${xp}`}
              className={{ root: 'font-bold text-sm' }}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col w-full mt-5">
        <div className="flex flex-row">
          <FontAwesomeIcon icon={faShieldHeart} className="pr-2" />
          <Label
            label="Errungenschaften"
            className={{ root: 'font-bold text-sm' }}
          />
        </div>
        <div>
          {(!achievements || achievements?.length == 0) && (
            <div>{t('pwa.profile.noAchievements')}</div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 pt-3 pb-3 justify-items-center">
          {achievements?.map((achievement) => (
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
    </div>
  )
}

export default ProfileData
