"use client";

import Link from "next/link";

export type Crumb = { label: string; href?: string };

/**
 * Breadcrumb trail used across the student and instructor page trees,
 * replacing the old single "Back to …" links. The last item is the current
 * page (not a link); every ancestor with an `href` is clickable.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${index}-${item.label}`}
              className="flex items-center gap-1.5"
            >
              {index > 0 && (
                <span aria-hidden="true" className="text-foreground/40">
                  &rsaquo;
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-brand-light hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-medium text-foreground" : "text-foreground/60"}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
