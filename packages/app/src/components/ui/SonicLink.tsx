"use client";

import Link, { LinkProps } from "next/link";
import { ReactNode } from "react";
import { playClick, unlockAudio } from "@/lib/sounds";

interface SonicLinkProps extends Omit<LinkProps, "onClick"> {
  className?: string;
  children: ReactNode;
  title?: string;
  "aria-label"?: string;
}

/**
 * <Link> that plays a click sound on navigation. Drop-in replacement.
 */
export function SonicLink({ children, ...props }: SonicLinkProps) {
  return (
    <Link
      {...props}
      onClick={() => {
        unlockAudio().then(playClick).catch(() => {});
      }}
    >
      {children}
    </Link>
  );
}
