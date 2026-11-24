import Link from "next/link";

export const metadata = { title: "Terms of Service · GymBuddy" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-relaxed text-gray-800">
      <Link href="/" className="text-xs font-semibold text-emerald-800">← Back to GymBuddy</Link>
      <h1 className="mt-4 text-3xl font-bold text-emerald-950">Terms of Service</h1>
      <p className="mt-1 text-xs text-gray-500">Last updated: November 23, 2026</p>
      <ul className="mt-6 list-disc space-y-2 pl-5">
        <li>GymBuddy gives general fitness and nutrition information. It is not medical advice; check with a doctor before starting a new program, especially with injuries or health conditions.</li>
        <li>AI coach answers can be wrong. Use your own judgment and train safely.</li>
        <li>You are responsible for your account and for keeping your password private.</li>
        <li>Don&apos;t misuse the service (abuse, scraping, attacking the system).</li>
        <li>The service is provided &quot;as is&quot; and may change or be discontinued.</li>
        <li>See our <Link href="/privacy" className="underline">Privacy Policy</Link> for how we handle your data.</li>
      </ul>
    </main>
  );
}
