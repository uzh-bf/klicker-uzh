import fs from 'fs'
import hash from 'object-hash'
import React from 'react'
import RDS from 'react-dom/server'
import sharp from 'sharp'

import type { NextApiRequest, NextApiResponse } from 'next'

import { BigHead } from '@bigheads/core'
import { AVATAR_OPTIONS } from 'src/constants'

function getRandomOptions(rng) {
  function selectRandomKey(options) {
    return options[Math.floor(rng() * options.length)]
  }

  const skinTone = selectRandomKey(AVATAR_OPTIONS.skinTone)
  const eyes = selectRandomKey(AVATAR_OPTIONS.eyes)
  const eyebrows = selectRandomKey(AVATAR_OPTIONS.eyebrows)
  const mouth = selectRandomKey(AVATAR_OPTIONS.mouths)
  const hair = selectRandomKey(AVATAR_OPTIONS.hair)
  const facialHair = selectRandomKey(AVATAR_OPTIONS.facialHair)
  const clothing = selectRandomKey(AVATAR_OPTIONS.clothing)
  const accessory = selectRandomKey(AVATAR_OPTIONS.accessory)
  const graphic = selectRandomKey(AVATAR_OPTIONS.graphic)
  const hat = selectRandomKey(AVATAR_OPTIONS.hat)
  const body = selectRandomKey(AVATAR_OPTIONS.body)

  const hairColor = selectRandomKey(AVATAR_OPTIONS.hairColor)
  const clothingColor = selectRandomKey(AVATAR_OPTIONS.clothingColor)
  const lipColor = selectRandomKey(AVATAR_OPTIONS.lipColor)
  const hatColor = selectRandomKey(AVATAR_OPTIONS.clothingColor)

  const faceMask = false
  const faceMaskColor = 'white'

  const mask = false
  const circleColor = 'blue'

  const lashes = false

  return {
    skinTone,
    eyes,
    eyebrows,
    mouth,
    hair,
    facialHair,
    clothing,
    accessory,
    graphic,
    hat,
    body,
    hairColor,
    clothingColor,
    circleColor,
    lipColor,
    hatColor,
    faceMaskColor,
    mask,
    faceMask,
    lashes,
  }
}

type Data = {
  img: string
}

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  try {
    const rng = Math.random

    const mergedProps = {
      body: 'breasts',
      skinTone: 'light',
      eyes: 'happy',
      mouth: 'openSmile',
      hair: 'afro',
      clothingColor: 'white',
      accessory: 'roundGlasses',
      hairColor: 'black',
      eyebrows: 'raised',
      faceMask: false,
      lashes: false,
      mask: false,
      clothing: 'shirt',
      facialHair: 'none',
      graphic: 'none',
      hat: 'none',
    }

    const hashedProps = hash(mergedProps)

    const avatarString = RDS.renderToString(
      React.createElement(BigHead, mergedProps)
    )

    fs.writeFileSync(`public/avatars/${hashedProps}.svg`, avatarString)

    const png = await sharp(Buffer.from(avatarString))
      .resize({
        height: 200,
      })
      .png({})
      .toFile(`public/avatars/${hashedProps}.png`)

    const webp = await sharp(Buffer.from(avatarString))
      .resize({
        height: 200,
      })
      .webp({
        lossless: true,
      })
      .toFile(`public/avatars/${hashedProps}.webp`)

    const webpSmall = await sharp(Buffer.from(avatarString))
      .resize({
        height: 50,
      })
      .webp({
        lossless: true,
      })
      .toFile(`public/avatars/${hashedProps}_small.webp`)

    res.status(200).json({ img: avatarString })
  } catch (err) {
    res.status(500)
  }
}

export default handler
