import fs from 'fs'
import hash from 'object-hash'
import React from 'react'
import RDS from 'react-dom/server'

import { BigHead } from '@bigheads/core'
import { AVATAR_OPTIONS } from 'shared-components/src/constants'

async function main() {
  AVATAR_OPTIONS.skinTone.forEach((skinTone) => {
    AVATAR_OPTIONS.eyes.forEach((eyes) => {
      AVATAR_OPTIONS.mouth.forEach((mouth) => {
        AVATAR_OPTIONS.hair.forEach((hair) => {
          AVATAR_OPTIONS.facialHair.forEach((facialHair) => {
            ;['dress', 'shirt', 'dressShirt'].forEach((clothing) => {
              AVATAR_OPTIONS.accessory.forEach((accessory) => {
                AVATAR_OPTIONS.hairColor.forEach((hairColor) => {
                  AVATAR_OPTIONS.clothingColor.forEach((clothingColor) => {
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
