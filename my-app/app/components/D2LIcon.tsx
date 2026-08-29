"use client";

import { useEffect } from "react";

export default function D2LIcon({
  icon,
  color,
}: {
  icon: string;
  color?: string;
}) {
  useEffect(() => {
    const iconModule = "@brightspace-ui/core/components/icons/icon.js";
    void import(iconModule);
  }, []);

  return <d2l-icon icon={icon} style={color ? { color } : undefined} />;
}
