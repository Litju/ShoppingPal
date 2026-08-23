"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { ChatMessages } from "@/components/chat/chat-messages";
import { Composer } from "@/components/chat/composer";
import { usePal } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";

export function AssistantConversation({
  suggestions,
  autoFocus = false,
}: {
  suggestions?: string[];
  autoFocus?: boolean;
}) {
  const { chat } = usePal();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold leading-tight">Shopping Pal</p>
          <p className="text-[11px] text-muted-foreground">
            Searches the real catalog · grounded prices only
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => chat.reset()}
          aria-label="Start a new conversation"
        >
          <Plus /> New
        </Button>
      </div>

      <ChatMessages className="flex-1" />

      <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Composer suggestions={suggestions} autoFocus={autoFocus} />
      </div>
    </div>
  );
}
