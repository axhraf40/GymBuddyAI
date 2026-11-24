import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GymBuddy AI",
  description: "How GymBuddy AI collects, uses and protects your data.",
};

const UPDATED = "23 November 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-ink sm:px-6">
      <Link href="/" className="text-sm font-bold text-forest hover:underline">
        ← Back to GymBuddy AI
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold text-forest-deep sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-secondary">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-bold text-forest-deep">Who we are</h2>
          <p className="mt-2">
            GymBuddy AI is an AI gym and nutrition coach built as a university project (course &quot;Generative Text
            AI&quot;). It is a non-commercial prototype. No payment is taken and we do not sell or rent your data.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-forest-deep">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Account data:</strong> your email, username and name. If you use email and password, your
              password is stored only as a salted hash. If you use &quot;Continue with Google&quot;, we receive your
              Google account&apos;s email address, name and profile picture, and nothing else.
            </li>
            <li>
              <strong>Fitness profile:</strong> the details you enter, such as age, sex, height, weight, goal, training
              days, equipment, diet, allergies and injuries.
            </li>
            <li>
              <strong>Usage data:</strong> your chat conversations with the coach, the ratings you give answers, problem
              reports you send, and photos or barcodes you choose to scan.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-forest-deep">How we use it</h2>
          <p className="mt-2">
            Only to run the app: to sign you in, compute your calorie and macro targets, personalise the coach&apos;s
            answers, keep your conversation history, send verification or password-reset codes and, if you opt in, a
            daily coaching email. Ratings and problem reports are used to improve the chatbot.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-forest-deep">Services that process your data</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Our AI model provider</strong> receives your chat messages, your
              fitness profile summary and scanned images, to generate the answer.
            </li>
            <li>
              <strong>Vercel</strong> hosts the website and the API.
            </li>
            <li>
              <strong>Google</strong>, only if you choose to sign in with Google.
            </li>
            <li>
              <strong>An email delivery service</strong> (Brevo, Resend or Gmail SMTP) sends verification codes and
              optional coaching emails.
            </li>
            <li>
              <strong>Open Food Facts and OpenStreetMap</strong> receive barcodes you scan and the location you share for
              nearby restaurants. No account information is sent to them.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-forest-deep">Health information</h2>
          <p className="mt-2">
            GymBuddy AI is not a medical service and its answers are not medical advice. Only enter injuries, allergies or
            conditions you are comfortable sharing; they are used solely to keep the coach&apos;s suggestions safe for you.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-forest-deep">Retention and your rights</h2>
          <p className="mt-2">
            You can delete any conversation from the coach page. To have your account and all associated data deleted,
            or to ask what we hold about you, send a request with the &quot;Report a problem&quot; button in the app and
            we will handle it within 30 days. As a prototype, the service and its data may be reset at the end of the
            project.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-forest-deep">Security</h2>
          <p className="mt-2">
            Traffic is encrypted with HTTPS, passwords are hashed, and API keys are kept on the server. No system is
            perfectly secure, so please use a password you do not use elsewhere.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-forest-deep">Changes</h2>
          <p className="mt-2">If this policy changes, we will update the date at the top of this page.</p>
        </section>
      </div>
    </main>
  );
}
