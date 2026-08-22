"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";

import { usePal } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";

/**
 * The large "What are you looking for?" composer on the home page.
 * Sends straight to Shopping Pal; a secondary action falls back to search.
 */
export function HomePalComposer() {
  const pal = usePal();
  const router = useRouter();
  const [value, setValue] = React.useState("");

  function submitToPal(text?: string) {
    const prompt = (text ?? value).trim();
    if (!prompt) return;
    router.push("/");
    // Let the route settle, then open the panel and send.
    setTimeout(() => pal.send(prompt), 50);
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitToPal();
        }}
        className="flex items-center gap-2 rounded-xl border-2 border-foreground/15 bg-card p-2 shadow-sm transition-colors focus-within:border-primary/60"
      >
        <label htmlFor="home-pal-input" className="sr-only">
          Tell Shopping Pal what you&apos;re looking for
        </label>
        <textarea
          id="home-pal-input"
          data-testid="home-pal-input"
          rows={1}
          value={value}
          placeholder="e.g. Best headphones under $250 for gym and commuting"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitToPal();
            }
          }}
          className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Ask Shopping Pal"
          disabled={!value.trim()}
          className="h-11 w-11 rounded-lg"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[
          "Home gym setup under $1,000",
          "Monitor for programming under $500",
          "Compare three travel headphones",
        ].map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => submitToPal(prompt)}
            data-testid="example-prompt"
            className="focus-ring rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
