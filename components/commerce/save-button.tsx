"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getSavedIdsAction,
  saveProductAction,
  unsaveProductAction,
} from "@/lib/actions/saved";
import { cn } from "@/lib/utils";

const GUEST_SAVED_KEY = "sp_guest_saved";

export function readGuestSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function writeGuestSaved(ids: string[]) {
  try {
    window.localStorage.setItem(GUEST_SAVED_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
}

export function SaveButton({
  productId,
  title,
  variant = "ghost",
  className,
}: {
  productId: string;
  title: string;
  variant?: "ghost" | "outline" | "secondary";
  className?: string;
}) {
  const [saved, setSaved] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([getSavedIdsAction(), Promise.resolve(readGuestSaved())]).then(
      ([serverIds, guestIds]) => {
        if (!cancelled) setSaved(serverIds.includes(productId) || guestIds.includes(productId));
        if (!cancelled) setChecked(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function toggle() {
    const next = !saved;
    setSaved(next);
    if (!next) {
      const remaining = readGuestSaved().filter((id) => id !== productId);
      writeGuestSaved(remaining);
    }
    const result = await saveProductAction(productId);
    if (!result.ok) {
      toast.error("Could not update your saved list.");
      setSaved(!next);
      return;
    }
    if (next && typeof window !== "undefined") {
      // Persist for guests; harmless when signed in.
      const ids = readGuestSaved();
      if (!ids.includes(productId)) writeGuestSaved([...ids, productId]);
    }
    if (!result.saved && next === false) {
      await unsaveProductAction(productId);
    }
    toast.success(saved ? `Removed ${title} from saved items` : `Saved ${title}`);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-pressed={checked ? saved : undefined}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      onClick={(e) => {
        e.preventDefault();
        void toggle();
      }}
      className={cn(className)}
    >
      <Heart
        className={cn("h-4 w-4 transition-colors", saved && "fill-destructive text-destructive")}
      />
    </Button>
  );
}
