import { faStar } from '@fortawesome/free-regular-svg-icons'
import { faShieldHeart, faTrophy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Achievement,
  Level,
  ParticipantAchievementInstance,
} from '@klicker-uzh/graphql/dist/ops'
import { Label, Progress, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useMemo } from 'react'
import PossibleAchievementsTile from './PossibleAchievementsTile'
import ReceivedAchievementTile from './ReceivedAchievementTile'

interface ProfileProps {
  isSelf?: boolean
  username: string
  xp: number
  level?: Level | null
  achievements?: ParticipantAchievementInstance[] | null
  possibleAchievements?: Achievement[] | null
  avatar?: string | null
  showProfileDetails?: boolean | null
}

function ProfileData({
  isSelf = false,
  username,
  xp,
  level,
  achievements,
  possibleAchievements,
  avatar,
  showProfileDetails,
}: ProfileProps) {
  const t = useTranslations()

  const remainingAchievements = useMemo(
    () =>
      possibleAchievements?.filter(
        (a) => !achievements?.some((b) => b.achievement.id === a.id)
      ),
    [achievements, possibleAchievements]
  )

  return (
    <div className="flex flex-col items-center w-full max-w-xl p-4 mx-auto md:min-w-[400px]">
      <div className="relative mb-2">
        <div className="w-[200px] h-[200px] rounded-full border border-solid border-black">
          <Image
            src={
              avatar
                ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`
                : '/user-solid.svg'
            }
            alt=""
            className="overflow-hidden w-[200px] h-[200px] rounded-full"
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
      {showProfileDetails ? (
        <div className="flex flex-col w-full gap-4 text-md">
          {level && (
            <div className="flex flex-row items-center">
              <FontAwesomeIcon icon={faTrophy} className="pr-2" />
              <Label
                label={t('shared.generic.levelX', { number: level.index })}
                className={{ root: 'font-bold' }}
              />
            </div>
          )}
          <div>
            <div className="flex flex-row items-center mb-2">
              <FontAwesomeIcon icon={faStar} className="pr-2" />
              <Label
                label={t('shared.generic.experiencePoints')}
                className={{ root: 'font-bold' }}
              />
            </div>
            <div>
              {level?.nextLevel?.requiredXp && (
                <Progress
                  value={xp}
                  max={level.nextLevel.requiredXp}
                  formatter={Number}
                  offset={level.requiredXp}
                  className={{ indicator: 'min-w-[55px]' }}
                />
              )}
            </div>
          </div>
          <div>
            <div className="flex flex-row items-center mb-2">
              <FontAwesomeIcon icon={faShieldHeart} className="pr-2" />
              <Label
                label={t('pwa.profile.achievements')}
                className={{ root: 'font-bold' }}
              />
            </div>
            <div>
              {((!isSelf && (!achievements || achievements.length === 0)) ||
                (isSelf &&
                  (!achievements || achievements.length === 0) &&
                  (!possibleAchievements ||
                    possibleAchievements.length === 0))) && (
                <div>{t('pwa.achievements.noAchievements')}</div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 pt-3 pb-3 md:grid-cols-2 justify-items-center">
              {achievements?.map((achievement) => (
                <ReceivedAchievementTile
                  key={achievement.id}
                  instance={achievement}
                />
              ))}
              {isSelf &&
                remainingAchievements?.map((achievement) => (
                  <PossibleAchievementsTile
                    key={achievement.id}
                    achievement={achievement}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : (
        <UserNotification type="info">
          {t.rich('pwa.courses.profileAnonymous', { username: username })}
        </UserNotification>
      )}
    </div>
  )
}

export default ProfileData
