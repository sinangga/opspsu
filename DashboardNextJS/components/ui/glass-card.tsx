import * as React from "react";
import { cn } from "@/lib/utils";

type DivProps = React.ComponentProps<"div">;

export function GlassCard({ className, children, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl glass p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}