import { QuestionType, SessionStatus } from '@klicker-uzh/graphql/dist/ops'

export const SMALL_BAR_THRESHOLD: number = 0.05

export const SESSION_STATUS: Record<SessionStatus, string> = {
  PREPARED: 'PREPARED',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
}

export const CHART_TYPES: Record<string, string> = {
  BAR_CHART: 'BAR_CHART',
  CLOUD_CHART: 'CLOUD_CHART',
  HISTOGRAM: 'HISTOGRAM',
  PIE_CHART: 'PIE_CHART',
  STACK_CHART: 'STACK_CHART',
  TABLE: 'TABLE',
}

export const CHART_COLORS: string[] = [
  'rgb(19, 149, 186)', // 1
  'rgb(241, 108, 32)', // 7
  'rgb(13, 60, 85)', // 4
  'rgb(235, 200, 68)', // 10
  'rgb(192, 46, 29)', // 5
  'rgb(162, 184, 108)', // 11
  'rgb(239, 139, 44)', // 8
  'rgb(17, 120, 153)', // 2
  'rgb(217, 78, 31)', // 6
  'rgb(92, 167, 147)', // 12
  'rgb(15, 91, 120)', // 3
  'rgb(236, 170, 56)', // 9
]

export const CHART_SOLUTION_COLORS = {
  correct: '#00de0d',
  incorrect: '#ff0000',
}

export const QUESTION_GROUPS: Record<string, string[]> = {
  CHOICES: [QuestionType.Sc, QuestionType.Mc, QuestionType.Kprim],
  FREE_TEXT: [QuestionType.FreeText],
  NUMERICAL: [QuestionType.Numerical],
  FREE: [QuestionType.FreeText, QuestionType.Numerical],
  WITH_PERCENTAGES: [
    QuestionType.Sc,
    QuestionType.Mc,
    QuestionType.Kprim,
    QuestionType.FreeText,
  ],
  WITH_POSSIBILITIES: [
    QuestionType.Sc,
    QuestionType.Mc,
    QuestionType.Kprim,
    QuestionType.Numerical,
  ],
  WITH_STATISTICS: [QuestionType.Numerical],
}

export const AVATAR_OPTIONS: Record<string, string[]> = {
  hair: ['long', 'bun', 'short', 'buzz', 'afro'],
  hairColor: ['blonde', 'black', 'brown'],
  eyes: ['normal', 'happy', 'content', 'squint', 'heart', 'wink'],
  accessory: ['none', 'roundGlasses', 'tinyGlasses', 'shades'],
  mouth: ['grin', 'openSmile', 'serious'],
  facialHair: ['none', 'stubble', 'mediumBeard'],
  clothing: ['shirt', 'dress', 'dressShirt'],
  clothingColor: ['blue', 'green', 'red'],
  skinTone: ['light', 'dark'],
  // eyebrows: ['raised'],
  // graphic: ['none'],
  // hat: ['none'],
  // body: ['breasts', 'chest'],
}

export const TYPES_SHORT: Record<QuestionType, string> = {
  NUMERICAL: 'NR',
  FREE_TEXT: 'FT',
  MC: 'MC',
  SC: 'SC',
  KPRIM: 'KP',
}

export const ACTIVE_CHART_TYPES: Record<
  string,
  { label: string; value: string }[]
> = {
  FREE_TEXT: [
    { label: 'manage.evaluation.table', value: 'table' },
    { label: 'manage.evaluation.wordCloud', value: 'wordCloud' },
  ],
  NUMERICAL: [
    { label: 'manage.evaluation.histogram', value: 'histogram' },
    { label: 'manage.evaluation.table', value: 'table' },
    { label: 'manage.evaluation.barChart', value: 'barChart' },
    { label: 'manage.evaluation.wordCloud', value: 'wordCloud' },
  ],
  SC: [
    { label: 'manage.evaluation.barChart', value: 'barChart' },
    { label: 'manage.evaluation.table', value: 'table' },
  ],
  MC: [
    { label: 'manage.evaluation.barChart', value: 'barChart' },
    { label: 'manage.evaluation.table', value: 'table' },
  ],
  KPRIM: [
    { label: 'manage.evaluation.barChart', value: 'barChart' },
    { label: 'manage.evaluation.table', value: 'table' },
  ],
}

export const STATISTICS_ORDER: string[] = [
  'min',
  'max',
  'mean',
  'median',
  'q1',
  'q3',
  'sd',
]

export const LEARNING_ELEMENT_ORDERS: Record<string, string> = {
  SEQUENTIAL: 'Sequenziell',
  SHUFFLED: 'Zufällig',
  LAST_RESPONSE: 'Letzte Antwort zuletzt',
}

export const PRESET_COURSE_COLORS = [
  '#262FAD',
  '#016272',
  '#5FB1F9',
  '#FE7408',
  '#D84B39',
]

export const ANIMAL_NAMES = [
  'Active Aardvark',
  'Active Armadillo',
  'Adaptable Aardvark',
  'Adept Ant',
  'Admirable Ant',
  'Adorable Antelope',
  'Adventurous Antelope',
  'Aesthetic Ant',
  'Affable Alpaca',
  'Affectionate Aardvark',
  'Affectionate Albatross',
  'Agile Anemonefish',
  'Agile Ant',
  'Alluring Albatross',
  'Aloomse Antelope',
  'Ambitious Ant',
  'Amiable Armadillo',
  'Amicable Akita',
  'Amused Albatross',
  'Amusing Ape',
  'Animated Anteater',
  'Animated Antelope',
  'Astonishing Anaconda',
  'Astonishing Anglerfish',
  'Balanced Bat',
  'Beautiful Baboon',
  'Beguiling Butterfly',
  'Benevolent Bear',
  'Benevolent Bongo',
  'Bold Baboon',
  'Bountiful Bat',
  'Brave Bobcat',
  'Brave Booby',
  'Brave Buffalo',
  'Brave Butterfly',
  'Breezy Bee',
  'Bright Butterfly',
  'Brilliant Bullfinch',
  'Brisk Beaver',
  'Bubbly Bobcat',
  'Buoyant Bonobo',
  'Calm Camel',
  'Captivated Crane',
  'Captivating Caracal',
  'Careful Cheetah',
  'Caring Capuchin',
  'Cautious Cat',
  'Charismatic Chameleon',
  'Chased Chinchilla',
  'Cheerful Cat',
  'Cheerful Chinchilla',
  'Cheerful Cobra',
  'Cheerful Coral',
  'Chirpy Chipmunk',
  'Colorful Cuckatoo',
  'Comforting Cheetah',
  'Committed Cheetah',
  'Compassionate Cougar',
  'Compelling Cobra',
  'Composed Cuckoo',
  'Considerate Cockatoo',
  'Cool Cuckoo',
  'Coordinated Cobra',
  'Courageous Coyote',
  'Curious Capybara',
  'Curious Caterpillar',
  'Curious Cheetah',
  'Curious Crocodile',
  'Dapper Dolphin',
  'Dazzling Dingo',
  'Defiant Dugong',
  'Delicate Dik-dik',
  'Delighted Dik-Dik',
  'Delighted Dolphin',
  'Delightful Dingo',
  'Delightful Dolphin',
  'Delightful Dotterel',
  'Determined Dingo',
  'Determined Dolphin',
  'Determined Donkey',
  'Determined Drake',
  'Determined Dugong',
  'Devoted Dachshund',
  'Devoted Dove',
  'Dexterous Deer',
  'Dextrous Dik-dik',
  'Dignified Dugong',
  'Diligent Donkey',
  'Diligent Dugong',
  'Durable Dachshund',
  'Eager Ea',
  'Eager Eagle',
  'Eager Elephant',
  'Eager Elk',
  'Earnest Egret',
  'Earnest Elk',
  'Earnest Emu',
  'Ebullient Echidna',
  'Ebullient Elephant',
  'Eccentric Echidna',
  'Eccentric Eel',
  'Ecstatic Eel',
  'Effervescent Emu',
  'Effulgent Elephant',
  'Elated Eagle',
  'Elated Elephant',
  'Elated Ermine',
  'Electrifying Eel',
  'Elegant Egret',
  'Emboldened Eland',
  'Enchanted Echidna',
  'Enchanting Ermine',
  'Encouraging Emu',
  'Energetic Eel',
  'Energetic Egret',
  'Energetic Elephant',
  'Energetic Ermine',
  'Enthusiastic Echidna',
  'Exciting Eagle',
  'Exciting Egret',
  'Exotic Emu',
  'Exquisite Equestrian',
  'Exuberant Elephant',
  'Exuberant Elk',
  'Faithful Falcon',
  'Faithful Flamingo',
  'Faithful Fox',
  'Fancy Finch',
  'Fantastic Frog',
  'Fast Falcon',
  'Fearless Firefly',
  'Fearless Flamingo',
  'Fearless Frigatebird',
  'Fiesty Ferret',
  'Flexible Flamingo',
  'Friendly Finch',
  'Gallant Giraffe',
  'Gallant Gull',
  'Generous Gorilla',
  'Generous Guinea Pig',
  'Gentle Giraffe',
  'Giddy Gorilla',
  'Giggling Grouse',
  'Gleeful Gnu',
  'Gleeful Gull',
  'Glowing Gazelle',
  'Glowing Guppy',
  'Graceful Gorilla',
  'Graceful Grizzly',
  'Gracious Gorilla',
  'Gracious Grizzly',
  'Grateful Gecko',
  'Grateful Gorilla',
  'Gregarious Goose',
  'Gregarious Gull',
  'Groovy Gorilla',
  'Gutsy Gnus',
  'Happy Hare',
  'Happy Hippo',
  'Happy Hyena',
  'Harmonious Heron',
  'Harmonious Hummingbird',
  'Harmonious Hyena',
  'Harmony Hummingbird',
  'Hasty Hare',
  'Hasty Hyena',
  'Hearty Hamster',
  'Helpful Hamster',
  'Honest Hamster',
  'Honest Horse',
  'Honorable Hawk',
  'Hopeful Hippo',
  'Humble Hyena',
  'Humorous Hippo',
  'Humorous Hummingbird',
  'Icy Ibex',
  'Imaginative Iguana',
  'Imaginative Impala',
  'Imperial Ibis',
  'Impressive Ibex',
  'Impressive Ibis',
  'Impressive Iguana',
  'Impressive Impala',
  'Incredible Icefish',
  'Incredible Inchworm',
  'Incredible Irukandji',
  'Industrious Ibex',
  'Ingenious Ibex',
  'Innovative Iguanodon',
  'Inspired Iguana',
  'Inspired Impala',
  'Inspiring Ibis',
  'Inspiring Impala',
  'Intense Iguana',
  'Intrepid Ibex',
  'Jaunty Jackdaw',
  'Jaunty Jellyfish',
  'Jazzy Jaguar',
  'Jazzy Jay',
  'Jealous Jaguar',
  'Jiggly Jellyfish',
  'Jocund Jerboa',
  'Jolly Jackal',
  'Jolly Jellyfish',
  'Jovial Jaguar',
  'Jovial Jay',
  'Joyful Jackal',
  'Joyful Jackrabbit',
  'Joyful Jaguar',
  'Joyful Jay',
  'Joyful Jerboa',
  'Jubilant Jackal',
  'Jubilant Jackrabbit',
  'Jubilant Jaguar',
  'Jubilant Jay',
  'Jubilant Jellyfish',
  'Jubilant Junebug',
  'Jumpy Jaguar',
  'Keek Kestrel',
  'Keen Kangaroo',
  'Keen Kestrel',
  'Keen Kiwi',
  'Kind Kangaroo',
  'Kind Kingfisher',
  'Kind Kinkajou',
  'Kind Komodo Dragon',
  'Kinetic Kangaroo',
  'Kinetic Kestrel',
  'Kinetoscopic Kookaburra',
  'Kinky Kinkajou',
  'Knowledgeable Koi',
  'Large Lemur',
  'Lavish Lemur',
  'Leisurely Lion',
  'Levitating Lemur',
  'Lighthearted Leopard',
  'Limitless Lemur',
  'Listless Lemming',
  'Lively Lark',
  'Lively Lemur',
  'Lively Loris',
  'Lovable Lemur',
  'Lovely Lemur',
  'Lovely Lionfish',
  'Lovely Lynx',
  'Loyal Labrador',
  'Loyal Lemming',
  'Loyal Leopard',
  'Loyal Lion',
  'Loyal Loon',
  'Loyal Lovebird',
  'Magical Manatee',
  'Magnanimous Magpie',
  'Magnificent Mongoose',
  'Majestic Macaw',
  'Majestic Meerkat',
  'Majestic Moose',
  'Marvelous Macaque',
  'Maternal Meerkat',
  'Merry Magpie',
  'Merry Mantis',
  'Merry Meerkat',
  'Merry Mockingbird',
  'Meticulous Mongoose',
  'Meticulous Moose',
  'Mighty Marmot',
  'Mischievous Mouse',
  'Modest Mongoose',
  'Modest Monkey',
  'Motivated Moose',
  'Mused Mackerel',
  'Mystical Mole',
  'Natural Nyala',
  'Neat Nightingale',
  'Nebulous Numbat',
  'Necessary Nightcrawler',
  'Nervous Newt',
  'Nervy Nuthatch',
  'Neutral Numbat',
  'Nice Nase',
  'Nifty Nighthawk',
  'Nifty Nuthatch',
  'Nimble Numbat',
  'Noble Narwhal',
  'Noble Newt',
  'Noble Newton',
  'Noble Nightcrawler',
  'Noble Nightingale',
  'Noble Nuthatch',
  'Notable Nuthatch',
  'Noteworthy Nandoo',
  'Numerous Newt',
  'Nurturing Nuthatch',
  'Obedient Ocelot',
  'Obliging Otter',
  'Observant Octopus',
  'Observant Oryx',
  'Observant Owl',
  'Observed Oyster',
  'Operatic Otter',
  'Optimistic Okapi',
  'Optimistic Ostrich',
  'Optimistic Otter',
  'Optimistic Owl',
  'Organized Orianne',
  'Outgoing Orca',
  'Passionate Panther',
  'Passionate Puffin',
  'Passionate Puma',
  'Patient Pigeon',
  'Peaceful Parrot',
  'Perky Pangolin',
  'Persevering Platypus',
  'Persistent Penguin',
  'Personable Panther',
  'Playful Panda',
  'Playful Porcupine',
  'Pleasurable Penguin',
  'Poised Porpoise',
  'Polite Penguin',
  'Polite Pigeon',
  'Polite Puffin',
  'Positive Puffin',
  'Powerful Panther',
  'Prancing Pony',
  'Precise Penguin',
  'Prickly Porcupine',
  'Proud Panda',
  'Proud Peacock',
  'Proud Porcupine',
  'Prudent Prawn',
  'Quaint Quagga',
  'Quaint Quetzal',
  'Questioning Quoll',
  'Quick Quail',
  'Quick Quokka',
  'Quiet Quail',
  'Quiet Quetzal',
  'Quiet Quokka',
  'Quirky Quail',
  'Quirky Quetzal',
  'Quirky Quokka',
  'Quixotic Quail',
  'Quixotic Quetzal',
  'Quizzical Quokka',
  'Radiant Rabbit',
  'Radiant Raccoon',
  'Radiant Racoon',
  'Radiant Raven',
  'Radiant Ray',
  'Radiant Rhinoceros',
  'Radiant Roadrunner',
  'Radiant Rottweiler',
  'Rambunctious Raccoon',
  'Rational Rottweiler',
  'Ravishing Robin',
  'Raw Rhinoceros',
  'Realistic Reindeer',
  'Regal Reindeer',
  'Regal Rooster',
  'Rejuvenated Reindeer',
  'Relaxed Raccoon',
  'Relaxed Raven',
  'Relaxed Ringtail',
  'Relaxed Roadrunner',
  'Reliable Rottweiler',
  'Relieved Rhino',
  'Reverent Rabbit',
  'Serene Sparrow',
  'Serene Starfish',
  'Shiny Shark',
  'Sincere Seahorse',
  'Sincere Shrimp',
  'Skilful Swan',
  'Sly Skunk',
  'Smart Shark',
  'Smart Swallow',
  'Snazzy Snipe',
  'Sociable Squirrel',
  'Sociable Starling',
  'Sparkling Sparrow',
  'Spirited Seahorse',
  'Spirited Sparrow',
  'Spunky Squirrel',
  'Steadfast Stingray',
  'Steady Squid',
  'Striking Stingray',
  'Studious Starling',
  'Studious Stoat',
  'Stunning Seahorse',
  'Stunning Starling',
  'Sturdy Stoat',
  'Sunny Salamander',
  'Sunny Sardine',
  'Sweet Sparrow',
  'Swift Seahorse',
  'Swift Snail',
  'Tactful Tarpon',
  'Talented Termite',
  'Talkative Toucan',
  'Tenacious Tamarin',
  'Tenacious Tarantula',
  'Tenacious Tern',
  'Terrific Tiger',
  'Terrific Toucan',
  'Thoughtful Thrush',
  'Tidy Tapir',
  'Titillated Tapir',
  'Titillating Toucan',
  'Tolerant Tadpole',
  'Tolerant Tang',
  'Tolerant Tarsier',
  'Tranquil Tapir',
  'Trusting Tiger',
  'Trusting Tortoise',
  'Trusting Toucan',
  'Trustworthy Trout',
  'Trustworthy Turtle',
  'Twinkling Termite',
  'Ubiquitous Unicorn',
  'Ubiquitous Urial',
  'Unassuming Urial',
  'Unbeatable Urial',
  'Unbelievable Unicorn',
  'Uneasy Uakari',
  'Unique Unicorn',
  'Unstoppable Uakari',
  'Unstoppable Uguisu',
  'Unswerving Urial',
  'Untamed Uakari',
  'Untamed Umbrellabird',
  'Urbane Uakari',
  'Urgent Uguisu',
  'Valiant Vampire bat',
  'Valiant Velociraptor',
  'Valiant Viper',
  'Valiant Vixen',
  'Valiant Vole',
  'Valued Viper',
  'Verdant Viper',
  'Versatile Vampire bat',
  'Versatile Vicuna',
  'Versatile Viper',
  'Versatile Vizsla',
  'Versatile Vole',
  'Versatile Vulture',
  'Vibrant Vole',
  'Vibrant Vulture',
  'Victorious Viper',
  'Victorious Vulture',
  'Vigilant Vervet',
  'Vigilant Viper',
  'Vigilant Vole',
  'Vigorous Vervet',
  'Vigorous Vole',
  'Virtuous Viceroy',
  'Vivacious Vervet',
  'Vivacious Viper',
  'Vivacious Vole',
  'Vivacious Vulture',
  'Vivid Vulture',
  'Vociferous Vulture',
  'Warm Walrus',
  'Wary Walleye',
  'Wary Wombat',
  'Whimsical Weasel',
  'Whimsical Wolf',
  'Whimsical Wombat',
  'Whimsical Woodpecker',
  'Wholesome Walrus',
  'Wise Walrus',
  'Wise Weasel',
  'Wise Weka',
  'Wise Whale',
  'Wistful Warbler',
  'Witty Whale',
  'Witty Whelp',
  'Wonderful Wombat',
  'Wondrous Walrus',
  'Xanthous Xantus',
  'Xantic Xantus',
  'Xenial Xenopus',
  'Xenial Xerus',
  'Xenial Xiphosuran',
  'Xenobiotic Xerophyte',
  'Xenodochial Xerus',
  'Xenodochial Xiphosuran',
  'Xenophilous Xenops',
  'Xenophobic Xenops',
  'Xenophobic Xylophage',
  'Xeric Xantus',
  'Xeric Xiphosuran',
  'Xerophile Xolo',
  'Yappy Yak',
  'Yawning Yabby',
  'Yawning Yaffle',
  'Yawning Yak',
  'Yawning Yawny',
  'Yearning Yeti',
  'Yielding Yaffle',
  'Yielding Yak',
  'Yielding Yowie',
  'Young Yak',
  'Young Yeti',
  'Youthful Yabby',
  'Yummy Yellowhammer',
  'Zany Zebrafish',
  'Zany Zebu',
  'Zappy Zebu',
  'Zealful Zander',
  'Zealful Zebra finch',
  'Zealful Zorilla',
  'Zealous Zebra',
  'Zealous Zebu',
  'Zenful Zebra',
  'Zenithal Zander',
  'Zestful Zebra Shark',
  'Zestful Zebu',
  'Zestful Zokor',
  'Zestful Zorilla',
  'Zesty Zonkey',
  'Zesty Zorilla',
  'Zippy Zokor',
]
