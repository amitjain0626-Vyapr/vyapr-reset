// @ts-nocheck
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Minimal layout to avoid any auth/cookie logic from the root layout
export default function DentistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
