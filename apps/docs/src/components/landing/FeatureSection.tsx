import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState, useEffect } from 'react';
interface Feature {
  title: string;
  icon: any;
  text: string;
  hoverImage: string;
  shadow?: boolean; 
}
interface FeatureSectionProps {
  title: string;
  description: string;
  features: Feature[];
}

function FeatureSection({ title, description, features }: FeatureSectionProps) { 
  const [hoveredImage, setHoveredImage] = useState(features[0]?.hoverImage || '');
  const [hoveredFeature, setHoveredFeature] = useState<Feature | null>(null); 

  useEffect(() => {
    if (features.length > 0) {
      setHoveredImage(features[0].hoverImage);
      setHoveredFeature(features[0]);
    }
  }, [features]);

  const handleMouseEnter = (feature: Feature) => {
    setHoveredImage(feature.hoverImage);
    setHoveredFeature(feature);
  };

  const handleMouseLeave = () => {
    setHoveredFeature(null); 
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
                    className={`relative pl-9 p-6 ${hoveredFeature === feature ? 'shadow-xl' : ''}`} // Add shadow if hovered
                    onMouseEnter={() => handleMouseEnter(feature)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <dt className="inline font-semibold text-gray-900">
                      <FontAwesomeIcon
                        aria-hidden="true"
                        icon={feature.icon}
                        className="text-uzh-red-100 absolute left-1 top-7 h-5 w-5"
                      />
                      {feature.title}
                    </dt>{' '}
                    <dd className="inline">{feature.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="flex justify-center items-center p-0">
            <div className=''>
              <img
                src={hoveredImage}
                alt="Feature specific screenshot"
                className={`object-contain max-h-[400px] p-4   w-full h-auto 
                  ${hoveredFeature?.shadow ? 'shadow-xl ring-1 ring-gray-400/10 sm:w-[57rem] md:-ml-4 lg:-ml-0' : ''}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeatureSection;
