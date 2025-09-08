// components/Footer.tsx
// @ts-nocheck
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-600 flex flex-wrap items-center justify-between gap-3">
        <div>© {new Date().getFullYear()} Korekko</div>
        <nav className="flex items-center gap-4">
          <Link href="/directory" className="hover:underline">
            Directory
          </Link>
          <Link href="/onboarding" className="hover:underline">
            Get your microsite
          </Link>
        </nav>
      </div>
    </footer>
  );
}
