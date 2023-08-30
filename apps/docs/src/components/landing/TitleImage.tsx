import { H1, H2 } from '@uzh-bf/design-system'

function TitleImage() {
  return (
    <div className="relative">
      <div className="relative w-full max-w-[1500px] mx-auto">
        <img className="object-cover md:h-full h-64" src="/img_v3/hero_1.png" />
        <div className="absolute bottom-4 left-0 right-0 md:right-auto md:bottom-[50px] md:left-[50px] bg-slate-100 bg-opacity-80 px-4 py-2 md:rounded">
          <H1 className={{ root: 'text-2xl md:text-6xl m-0' }}>KlickerUZH</H1>
          <H2 className={{ root: 'text-xl md:text-3xl m-0' }}>
            Enhance your classroom experience.
          </H2>
        </div>
        <div className="text-lg md:text-2xl w-2/3"></div>
      </div>
    </div>
  )
}

export default TitleImage
