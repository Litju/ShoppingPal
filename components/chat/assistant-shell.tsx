"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { MessageCircle, Sparkles, X } from "lucide-react";

import { usePal } from "@/components/chat/chat-context";
import { SUGGESTED_PROMPTS_HOME } from "@/components/chat/types";
import { cn } from "@/lib/utils";

const AssistantConversation = dynamic(
  () =>
    import("@/components/chat/assistant-conversation").then(
      (m) => m.AssistantConversation,
    ),
  { ssr: false },
);

/**
 * Global Shopping Pal surface: collapsible split-screen rail on desktop,
 * bottom-sheet drawer on mobile.
 */
export function AssistantShell({ children }: { children: React.ReactNode }) {
  const pal = usePal();
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const open = pal.isOpen;

  return (
    <div className="flex min-h-[calc(100dvh-var(--header-h))] w-full">
      <main
        id="main-content"
        className={cn("min-w-0 flex-1 transition-[margin] duration-200")}
      >
        {children}
      </main>

      {/* Desktop split-screen rail */}
      <aside
        aria-hidden={!open}
        aria-label="Shopping Pal assistant panel"
        className={cn(
          "sticky top-[var(--header-h)] hidden h-[calc(100dvh-var(--header-h))] shrink-0 overflow-hidden border-l border-border bg-background lg:block",
          open ? "w-[420px] xl:w-[460px]" : "w-0 border-l-0",
        )}
      >
        {open && (
          <AssistantConversation suggestions={SUGGESTED_PROMPTS_HOME} />
        )}
      </aside>

      {/* Mobile bottom sheet */}
      {!isDesktop && (
        <>
          <button
            type="button"
            onClick={pal.open}
            aria-expanded={open}
            aria-controls="pal-mobile-panel"
            data-testid="assistant-launcher"
            className="focus-ring fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/15 lg:hidden"
          >
            {open ? <X aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {open ? "Close Pal" : "Ask your Pal"}
          </button>

          {open && (
            <div
              id="pal-mobile-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Shopping Pal assistant"
              className="fixed inset-x-0 bottom-0 z-50 flex h-[86dvh] flex-col rounded-t-xl border-t border-border bg-background shadow-2xl animate-in slide-in-from-bottom duration-300"
            >
              <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted" aria-hidden="true" />
              <div className="min-h-0 flex-1">
                <AssistantConversation autoFocus suggestions={SUGGESTED_PROMPTS_HOME} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Desktop launcher when rail is closed */}
      {isDesktop && !open && (
        <button
          type="button"
          onClick={pal.open}
          data-testid="assistant-launcher-desktop"
          className="focus-ring fixed bottom-6 right-6 z-40 hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold shadow-lg hover:border-primary/40 lg:inline-flex"
        >
          <MessageCircle aria-hidden="true" className="h-4 w-4 text-primary" />
          Ask your Pal
        </button>
      )}

      {isDesktop && (
        <button
          type="button"
          onClick={pal.close}
          className={cn(
            "sr-only",
          )}
          tabIndex={open ? 0 : -1}
        >
          Close assistant panel
        </button>
      )}
    </div>
  );
}
