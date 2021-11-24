export default function Iframe() {
  return (
    <div>
      this is a text above the frame
      <iframe
        src="https://klicker-landing.vercel.app/"
        width="100%"
        height="700px"
      />
      this is a text below the frame
    </div>
  )
}
