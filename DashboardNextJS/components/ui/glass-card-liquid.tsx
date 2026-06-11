import * as React from "react";
import { cn } from "@/lib/utils";

type DivProps = React.ComponentProps<"div">;

export function GlassCardLiquid({ className, children, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl glass p-6",
        "border-primary/10 shadow-lg",
        className
      )}
      {...props}
    >
      {/* subtle lighting sweep */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "linear-gradient(120deg, var(--primary) 0%, transparent 40%, var(--accent) 60%, transparent 100%)",
          filter: "blur(40px)",
          transform: "translate3d(0,0,0)",
        }}
      />
      {/* content */}
      <div className="relative">{children}</div>
    </div>
  );
}