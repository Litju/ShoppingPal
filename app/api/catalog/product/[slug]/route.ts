import { NextResponse } from "next/server";

import { getCatalogProvider } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only product lookup used by client widgets (recently viewed, etc.). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const catalog = await getCatalogProvider();
    const product = await catalog.getBySlug(slug);
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    console.error("[api/catalog/product]", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
