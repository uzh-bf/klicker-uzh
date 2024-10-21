import fs from 'fs'
import hash from 'object-hash'
import React from 'react'
import RDS from 'react-dom/server'

import { BigHead } from '@bigheads/core'
import { AvatarOptions } from '@klicker-uzh/shared-components/src/constants'

async function main() {
  AvatarOptions.skinTone.forEach((skinTone) => {
    AvatarOptions.eyes.forEach((eyes) => {
      AvatarOptions.mouth.forEach((mouth) => {
        AvatarOptions.hair.forEach((hair) => {
          AvatarOptions.facialHair.forEach((facialHair) => {
            ;['dress', 'shirt', 'dressShirt'].forEach((clothing) => {
              AvatarOptions.accessory.forEach((accessory) => {
                AvatarOptions.hairColor.forEach((hairColor) => {
                  AvatarOptions.clothingColor.forEach((clothingColor) => {
                    const definition = {
                      skinTone,
                      eyes,
                      mouth,
                      hair,
                      facialHair,
                      body: 'chest',
                      accessory,
                      hairColor,
                      clothingColor,
                      eyebrows: 'raised',
                      faceMask: false,
                      lashes: false,
                      mask: false,
                      clothing,
                      graphic: 'none',
                      hat: 'none',
                    } as any

                    const hashedProps = hash(definition)

                    const avatarString = RDS.renderToString(
                      React.createElement(BigHead, definition)
                    )

                    // const promises = Promise.all([
                    //   sharp(Buffer.from(avatarString))
                    //     .resize({
                    //       height: 200,
                    //     })
                    //     .webp({
                    //       lossless: true,
                    //     })
                    //     .toFile(`public/avatars/${hashedProps}.webp`),
                    //   sharp(Buffer.from(avatarString))
                    //     .resize({
                    //       height: 50,
                    //     })
                    //     .webp({
                    //       lossless: true,
                    //     })
                    //     .toFile(`public/avatars/${hashedProps}_small.webp`),
                    // ])

                    fs.writeFileSync(
                      `public/avatars3/${hashedProps}.svg`,
                      avatarString
                    )
                  })
                })
              })
            })
          })
        })
      })
    })
  })
}

main()

process.exit(0)
