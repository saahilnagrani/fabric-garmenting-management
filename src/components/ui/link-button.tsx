"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export function LinkButton({
  href,
  className,
  variant,
  size,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
} & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={buttonVariants({ variant, size, className })}>
      {children}
    </Link>
  );
}
