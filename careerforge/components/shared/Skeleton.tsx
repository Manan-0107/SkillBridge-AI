import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "node" | "text" | "badge" | "circle" | "rect";
}

export function Skeleton({ className = "", variant = "rect" }: SkeletonProps) {
  const baseClasses = "animate-pulse bg-ink/8 rounded-xl border border-ink/5";

  if (variant === "node") {
    return (
      <div className={`w-[260px] h-[86px] rounded-xl p-4 flex flex-col justify-between ${baseClasses} ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="h-3.5 w-3/4 bg-ink/12 rounded" />
          <div className="h-4 w-4 bg-ink/12 rounded-full" />
        </div>
        <div className="h-2.5 w-1/2 bg-ink/8 rounded" />
      </div>
    );
  }

  if (variant === "badge") {
    return <div className={`h-5 w-20 rounded-full bg-ink/10 ${className}`} />;
  }

  if (variant === "circle") {
    return <div className={`rounded-full bg-ink/10 ${className}`} />;
  }

  return <div className={`${baseClasses} ${className}`} />;
}
