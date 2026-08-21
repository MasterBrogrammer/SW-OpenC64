import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-[var(--shadow-border)]">
        <Link
          to="/"
          className="font-mono text-xs text-muted no-underline hover:text-fg"
        >
          Back
        </Link>
        <h1 className="mt-4 text-xl font-medium tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Optional. Stars already save in this browser without an account.
          Sign-in is for the hosted build.
        </p>
        <div className="mt-6 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>
      </div>
    </main>
  );
}
