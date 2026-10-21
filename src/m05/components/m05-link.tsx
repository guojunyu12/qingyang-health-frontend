"use client";
import NextLink from "next/link";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextLink>;
const modulePaths = new Set([
  "points",
  "rewards",
  "activities",
  "bookings",
  "redemptions",
  "community",
  "blocks",
]);
export function m05Href(href: Props["href"]): Props["href"] {
  if (
    typeof href !== "string" ||
    !href.startsWith("/") ||
    href.startsWith("//")
  )
    return href;
  if (href === "/health") return "/dashboard";
  const first = href.split(/[/?#]/)[1];
  return modulePaths.has(first) ? "/m05" + href : href;
}
export default function Link({ href, ...rest }: Props) {
  return <NextLink href={m05Href(href)} {...rest} />;
}
