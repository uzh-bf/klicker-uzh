import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";

function FeatureSection({ title, description, features }) {
    // Initialize with the hover image of the first feature
    const [hoveredImage, setHoveredImage] = useState(features[0].hoverImage);;
    
  
    const handleMouseEnter = (hoverImage) => {
      setHoveredImage(hoverImage);
    };
  
  
    return (
      <div className="overflow-hidden bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
            <div className="lg:pr-8 lg:pt-4">
              <div className="lg:max-w-lg">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  {title}
                </h2>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  {description}
                </p>
                <dl className="mt-10 max-w-xl space-y-8 text-base leading-7 text-gray-600 lg:max-w-none">
                  {features.map((feature) => (
                    <div
                      key={feature.title}
                      className="relative pl-9"
                      onMouseEnter={() => handleMouseEnter(feature.hoverImage)}
                    >
                      <dt className="inline font-semibold text-gray-900">
                        <FontAwesomeIcon
                          aria-hidden="true"
                          icon={feature.icon}
                          className="text-uzh-red-100 absolute left-1 top-1 h-5 w-5"
                        />
                        {feature.title}
                      </dt>{' '}
                      <dd className="inline">{feature.text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <img
              src={hoveredImage}
              alt="Feature specific screenshot"
              className="w-full max-w-none rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-[57rem] md:-ml-4 md:w-[48rem] lg:-ml-0"
            />
          </div>
        </div>
      </div>
    );
  }

function HoverImage({ features }) {
const [hoveredImage, setHoveredImage] = useState(features[0].hoverImage);
const handleMouseEnter = (hoverImage) => {
    setHoveredImage(hoverImage);
};


return (
    <>
    {features.map((feature) => (
        <div key={feature.title} className="relative pl-9"
        onMouseEnter={() => handleMouseEnter(feature.hoverImage)}>
        <dt className="inline font-semibold text-gray-900">
            {feature.title}
        </dt>{' '}
        <dd className="inline">{feature.text}</dd>
        </div>
    ))}
    <img
        src={hoveredImage}
        alt="Feature specific screenshot"
        className="w-full max-w-none rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-[57rem] md:-ml-4 md:w-[48rem] lg:-ml-0"
    />
    </>
);
}