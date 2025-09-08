"use client";
// @ts-nocheck
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function DashboardTabs() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const slug = (sp.get("slug") || "").trim();
  /* === VYAPR: lang param support START (22.19) === */
  const lang = (sp.get("lang") || "").trim();
  /* === VYAPR: lang param support END (22.19) === */

  const mk = (path: string) => {
    const params = new URLSearchParams();
    if (slug) params.set("slug", slug);
    /* === VYAPR: lang param support START (22.19) === */
    if (lang) params.set("lang", lang);
    /* === VYAPR: lang param support END (22.19) === */
    const q = params.toString();
    return q ? `${path}?${q}` : path;
  };

  const isActive = (path: string) => pathname?.startsWith(path);

  const Tab = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      className={[
        "px-3 py-1.5 text-sm rounded-lg border",
        isActive(href.split("?")[0]) ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );

  return (
    <nav className="flex items-center gap-2">
      <Tab href={mk("/dashboard/leads")} label="Leads" />
      <Tab href={mk("/dashboard/nudges")} label="Nudges" />
      <Tab href={mk("/dashboard/templates")} label="Templates" />
      <Tab href={mk("/dashboard/settings")} label="Settings" />
    </nav>
  );
}
