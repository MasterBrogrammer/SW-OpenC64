import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full resize-y rounded-lg bg-surface px-3 py-3 text-base leading-relaxed text-fg shadow-[inset_0_0_0_1px_var(--color-border)] outline-none placeholder:text-muted/70 focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-accent)]",
        className,
      )}
      {...props}
    />
  );
}
