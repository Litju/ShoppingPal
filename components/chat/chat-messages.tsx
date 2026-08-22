"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, User } from "lucide-react";

import { Composer } from "@/components/chat/composer";
import { MessageParts } from "@/components/chat/message-parts";
import { usePal } from "@/components/chat/chat-context";
import type { ShoppingPalMessage } from "@/components/chat/types";
import { cn } from "@/lib/utils";

function AssistantAvatar() {
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
    >
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  );
}

function MessageRow({ message }: { message: ShoppingPalMessage }) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text)
      .join(" ");
    return (
      <div className="flex items-start justify-end gap-2.5">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
          {text}
        </div>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary"
        >
          <User className="h-3.5 w-3.5" />
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <MessageParts message={message} />
      </div>
    </div>
  );
}

export function ChatMessages({ className }: { className?: string }) {
  const { chat } = usePal();
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const messages = chat.messages;

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, chat.status]);

  return (
    <div
      role="log"
      aria-label="Shopping Pal conversation"
      aria-live="polite"
      className={cn("flex flex-col gap-5 overflow-y-auto p-4", className)}
    >
      {messages.length === 0 && (
        <div className="mx-auto mt-8 max-w-xs text-center">
          <AssistantAvatar />
          <p className="mt-3 text-sm font-medium">What are you looking for?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Describe what you need — budget, use case, must-haves — and I&apos;ll search the real catalog,
            compare the contenders, and build your cart.
          </p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {messages.map((message, i) => (
          <motion.div
            key={message.id ?? `m-${i}`}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <MessageRow message={message} />
          </motion.div>
        ))}
      </AnimatePresence>

      {chat.status === "submitted" && (
        <div className="flex items-center gap-2.5" aria-live="polite">
          <AssistantAvatar />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="dot-pulse">Shopping Pal is thinking</span>
          </span>
        </div>
      )}
      <div ref={bottomRef} aria-hidden="true" className="h-px" />

      <style jsx global>{`
        .dot-pulse::after {
          content: "";
          display: inline-block;
          width: 1em;
          text-align: left;
          animation: dotpulse 1.2s steps(4, end) infinite;
        }
        @keyframes dotpulse {
          0% { content: ""; }
          25% { content: "."; }
          50% { content: ".."; }
          75% { content: "..."; }
        }
      `}</style>
    </div>
  );
}
