import { Badge } from "@/components/ui/badge";

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <Badge variant="destructive">Out of stock</Badge>;
  }
  if (stock < 15) {
    return <Badge variant="warning">Only {stock} left</Badge>;
  }
  return <Badge variant="success">In stock</Badge>;
}
