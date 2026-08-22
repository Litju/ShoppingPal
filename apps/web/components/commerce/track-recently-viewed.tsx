"use client";

import * as React from "react";

import { pushRecentlyViewed } from "@/components/commerce/recently-viewed";

export function TrackRecentlyViewed({ slug }: { slug: string }) {
  React.useEffect(() => {
    pushRecentlyViewed(slug);
  }, [slug]);
  return null;
}
