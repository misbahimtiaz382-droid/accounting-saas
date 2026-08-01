export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="rounded-xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-gray-900">
          Accounting SaaS
        </h1>

        <p className="mt-3 text-gray-600">
          Multi-company accounting software is running.
        </p>

        <button className="mt-6 rounded-lg bg-black px-5 py-3 text-white">
          Get Started
        </button>
      </div>
    </main>
  );
}