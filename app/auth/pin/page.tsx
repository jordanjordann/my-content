"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/lib/api/auth";
import { PinScreen } from "@/components/PinScreen";
import { LoaderCircleIcon } from "lucide-react";

export default function PinPage() {
  const router = useRouter();
  const authStatus = useAuthStatus();

  useEffect(() => {
    if (authStatus.data?.authenticated) {
      router.push("/analyses");
    }
  }, [authStatus.data?.authenticated, router]);

  if (authStatus.status === "pending") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <PinScreen />;
}
