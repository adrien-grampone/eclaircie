import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/lib/actions.ts";
import { requireAdmin } from "@/lib/auth.ts";

const NAV = [
  ["/images", "Images à faire"],
  ["/review", "À valider"],
  ["/stock", "Stock"],
  ["/reports", "Signalements"],
  ["/health", "Santé"],
] as const;

/** Cadre commun des pages protégées : vérifie l'administrateur, affiche la navigation. */
export async function Shell({ title, children }: { title: string; children: ReactNode }) {
  const email = await requireAdmin();
  return (
    <>
      <nav className="nav">
        <strong>Éclaircie</strong>
        {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        <form action={signOut} className="nav-end"><span className="meta">{email}</span><button className="btn small" type="submit">Déconnexion</button></form>
      </nav>
      <main>
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}
