"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { usePal } from "@/components/chat/chat-context";
import { cn } from "@/lib/utils";

export function Composer({
  suggestions,
  placeholder = "Ask your pal to find something…",
  autoFocus = false,
  compact = false,
}: {
  suggestions?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const { chat, send } = usePal();
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const busy = chat.status === "submitted" || chat.status === "streaming";

  React.useEffect(() => {
    if (chat.error) {
      toast.error(
        "Shopping Pal couldn't finish that. Your cart and the store are unaffected — try again.",
      );
      chat.setMessages((prev) => {
        // Drop an empty assistant message left behind by a failed stream.
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.parts.length === 0) return prev.slice(0, -1);
        return prev;
      });
      chat.clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.error]);

  function submit() {
    if (!value.trim() || busy) return;
    send(value);
    setValue("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const showSuggestions =
    !compact && suggestions !== undefined && chat.messages.length === 0 && !busy;

  return (
    <div className="space-y-2">
      {showSuggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Suggested prompts">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="focus-ring rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "flex items-end gap-2 rounded-lg border border-input bg-card p-2 shadow-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
        )}
      >
        <label htmlFor="pal-composer" className="sr-only">
          Message Shopping Pal
        </label>
        <textarea
          id="pal-composer"
          ref={textareaRef}
          value={value}
          rows={compact ? 1 : 2}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-36 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {busy ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Stop generating"
            onClick={() => void chat.stop()}
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!value.trim()}
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </form>
      {!compact && (
        <p className="text-center text-[11px] leading-tight text-muted-foreground">
          Enter to send · Shift+Enter for a new line
        </p>
      )}
    </div>
  );
}
