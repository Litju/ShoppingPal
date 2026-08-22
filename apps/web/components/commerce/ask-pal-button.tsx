"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";

import { usePal } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "Ask Shopping Pal about this product" — gives the assistant the current
 * product as context and opens the panel with contextual prompts.
 */
export function AskPalButton({
  productName,
  productSlug,
}: {
  productName: string;
  productSlug: string;
}) {
  const pal = usePal();

  const prompts = [
    `Is the ${productName} worth it?`,
    `Find me a cheaper alternative to this`,
    `What should I compare it with?`,
    `Add this to my cart`,
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          data-testid="ask-pal-button"
          onClick={() => {
            pal.setPageContext({
              source: "product-page",
              productName,
              productSlug,
            });
          }}
        >
          <MessageCircle aria-hidden="true" />
          Ask Shopping Pal about this
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Ask about {productName}</DropdownMenuLabel>
        {prompts.map((prompt) => (
          <DropdownMenuItem
            key={prompt}
            onClick={() => {
              pal.setPageContext({
                source: "product-page",
                productName,
                productSlug,
              });
              pal.send(prompt);
            }}
          >
            {prompt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
