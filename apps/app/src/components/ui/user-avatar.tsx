"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Users } from "lucide-react";

interface UserAvatarProps {
  src?: string | null;
  fallback: string;
  isOnline?: boolean;
  isGroup?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const textSizeMap = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
};

const dotSizeMap = {
  xs: "h-1.5 w-1.5 border",
  sm: "h-2.5 w-2.5 border-2",
  md: "h-3 w-3 border-2",
  lg: "h-3.5 w-3.5 border-2",
};

const iconSizeMap = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function UserAvatar({
  src,
  fallback,
  isOnline,
  isGroup,
  size = "md",
  className,
}: UserAvatarProps) {
  const initial = fallback?.[0]?.toUpperCase() ?? "?";

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <Avatar className={cn(sizeMap[size], "relative overflow-hidden rounded-full")}>
        {src ? (
          <Image
            src={src}
            alt={fallback}
            fill
            className="rounded-full object-cover"
          />
        ) : (
          <AvatarFallback
            className={cn(
              "bg-primary/10 text-primary",
              textSizeMap[size]
            )}
          >
            {isGroup ? (
              <Users className={iconSizeMap[size]} />
            ) : (
              initial
            )}
          </AvatarFallback>
        )}
      </Avatar>
      {isOnline !== undefined && !isGroup && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-card",
            dotSizeMap[size],
            isOnline ? "bg-green-500" : "bg-muted-foreground/40"
          )}
        />
      )}
    </div>
  );
}
