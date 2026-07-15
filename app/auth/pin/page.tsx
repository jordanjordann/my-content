"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStatusQuery } from "@/lib/api/auth";
import { PinScreen } from "@/components/PinScreen";
import { LoaderCircleIcon } from "lucide-react";

export default function PinPage() {
  const router = useRouter();
  const { data: authData, status } = useAuthStatusQuery();

  useEffect(() => {
    if (authData?.authenticated) {
      router.push("/analyses");
    }
  }, [authData?.authenticated, router]);

  if (status === "pending") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <PinScreen />;
}
