export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-10 text-center">
        
        <div className="text-5xl mb-4">✅</div>

        <h1 className="text-3xl font-semibold text-gray-800 mb-4">
          Thank You!
        </h1>

        <p className="text-gray-600 leading-relaxed mb-6">
          Your responses have been successfully submitted. 
          We truly appreciate the time and effort you took to complete this survey.
        </p>

        <p className="text-gray-500 text-sm">
          You may now close this page.
        </p>

      </div>
    </div>
  );
}