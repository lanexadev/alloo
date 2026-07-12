"use client";

import { MessageSquare } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10">
        <MessageSquare className="h-9 w-9 text-primary" />
      </div>
      <div className="max-w-xs">
        <h2 className="text-xl font-semibold tracking-tight">Alloo&nbsp;!</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sélectionne une conversation dans la liste ou lance une nouvelle
          discussion pour commencer.
        </p>
      </div>
    </div>
  );
}
