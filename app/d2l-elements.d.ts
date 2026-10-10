import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "d2l-icon": DetailedHTMLProps<
          HTMLAttributes<HTMLElement> & { icon?: string },
          HTMLElement
        >;
      }
    }
  }
}

export {};
