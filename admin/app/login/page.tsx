import { headers } from "next/headers";
import { signIn } from "@/lib/actions.ts";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; refused?: string }> }) {
  const params = await searchParams;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  return (
    <main className="login">
      <h1>Éclaircie — back-office</h1>
      {params.sent ? <p className="ok">Lien envoyé. Ouvre l'email pour te connecter.</p> : null}
      {params.refused ? <p className="error">Ce compte n'est pas autorisé.</p> : null}
      <form action={signIn} className="stack">
        <input type="hidden" name="origin" value={origin} />
        <label>Email <input name="email" type="email" required autoComplete="email" /></label>
        <button className="btn primary" type="submit">Recevoir un lien de connexion</button>
      </form>
    </main>
  );
}
