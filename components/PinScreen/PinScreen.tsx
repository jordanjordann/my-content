"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LockKeyholeIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  SparklesIcon,
  LoaderCircleIcon,
  FingerprintIcon,
  BadgeCheckIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStatusQuery, useSubmitPinMutation } from "@/lib/api/auth";

const capabilities = [
  "PIN-gated workspace",
  "Persistent analysis history",
  "Video-native Gemini analysis",
];

/** Full-screen authentication gate with PIN setup and unlock modes. */
export function PinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: authData, isSuccess: authSuccess } = useAuthStatusQuery();
  const { mutate: submitPin, isPending } = useSubmitPinMutation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(pin)) {
      setError("Enter a 4-digit PIN.");
      setPin("");
      return;
    }

    submitPin(
      { pin, pinConfigured: authData?.pinConfigured ?? false },
      {
        onSuccess: () => router.push("/analyses"),
        onError: (err) => {
          setError(err.message ?? "PIN failed.");
          setPin("");
        },
      },
    );
  }

  const mode = authData?.pinConfigured ? "unlock" : "setup";
  const title = mode === "setup" ? "Initialize content analysis vault" : "Unlock content analysis vault";
  const description =
    mode === "setup"
      ? "Create the operator PIN before any content, prompts, or model outputs are stored."
      : "Authenticate to resume the content intelligence workspace.";
  const modeLabel = mode === "setup" ? "Create vault PIN" : "Unlock workspace";
  const buttonLabel = isPending ? "Verifying secure session" : modeLabel;

  return (
    <div className="relative min-h-dvh overflow-hidden p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <Card className="w-full max-w-xl">
        <CardHeader className="gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl border bg-secondary text-accent">
              <LockKeyholeIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="rounded-full border bg-secondary px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {authSuccess ? "Secure route ready" : "Syncing status"}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <CardTitle className="font-heading text-3xl tracking-[-0.04em] sm:text-4xl">{title}</CardTitle>
            <CardDescription className="text-base leading-7">{description}</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="pin" className="text-sm font-medium">4-digit operator PIN</label>
              <Input
                id="pin"
                className="h-14 font-mono text-xl tracking-[0.8em]"
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                placeholder="0000"
                type="password"
                value={pin}
                aria-invalid={Boolean(error)}
                disabled={!authData || isPending}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <p className="text-sm text-muted-foreground">
                Bcrypt-hashed in the local database, then exchanged for an HTTP-only session cookie.
              </p>
              {error && (
                <p className="text-sm text-destructive" aria-live="polite">{error}</p>
              )}
            </div>

            <div className="grid gap-2 rounded-2xl border bg-secondary/50 p-3">
              {capabilities.map((capability, index) => (
                <div className="flex items-center gap-3 text-sm text-muted-foreground" key={capability}>
                  {index === 0 ? (
                    <ShieldCheckIcon className="size-4 text-accent" aria-hidden="true" />
                  ) : index === 1 ? (
                    <DatabaseIcon className="size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
                  )}
                  <span>{capability}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="h-12 w-full" disabled={!authData || isPending || pin.length !== 4} type="submit">
              {isPending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : null}
              {buttonLabel}
            </Button>
            <div className="flex w-full items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <FingerprintIcon className="size-3.5" aria-hidden="true" />
                Local operator access
              </span>
              <span className="flex items-center gap-2">
                <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
                No telemetry
              </span>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
