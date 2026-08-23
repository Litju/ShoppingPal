import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Local order records were removed; Medusa owns order detail state. */
export default function OrderDetailPage() {
  notFound();
}
