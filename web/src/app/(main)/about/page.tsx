export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="container px-4 py-20 md:px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
              About <span className="text-purple-600">Surtopya</span>
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400">
              Bridging the gap between researchers and respondents through a fair, transparent, and rewarding marketplace.
            </p>
          </div>

          <div className="prose prose-lg dark:prose-invert mx-auto text-gray-600 dark:text-gray-300">
            <p>
              Surtopya was born from a simple observation: getting high-quality survey responses is hard, and filling out surveys often feels unrewarding. We set out to change that.
            </p>
            
            <h3 className="text-gray-900 dark:text-white font-bold text-2xl mt-8 mb-4">Our Mission</h3>
            <p>
              To democratize access to high-quality data for researchers while ensuring every respondent's time and attention is valued. We believe in a data economy where everyone benefits.
            </p>

            <h3 className="text-gray-900 dark:text-white font-bold text-2xl mt-8 mb-4">Why Choose Us?</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Quality First:</strong> Our verification systems ensure you get real answers from real people.
              </li>
              <li>
                <strong>Fair Rewards:</strong> We pass on the majority of fees directly to the respondents.
              </li>
              <li>
                <strong>Data Assets:</strong> Your data isn't just a one-time report; it's an asset that grows in value.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
