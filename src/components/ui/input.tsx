import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md bg-surface px-3 text-base text-fg shadow-[inset_0_0_0_1px_var(--color-border)] outline-none placeholder:text-muted/70 focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-accent)]",
        className,
      )}
      {...props}
    />
  );
}
