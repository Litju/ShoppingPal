export const CATEGORY_SLUGS = [
  "computers",
  "computer-accessories",
  "audio",
  "phones-accessories",
  "fitness",
  "home",
  "kitchen",
  "outdoors",
  "everyday-carry",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  computers: "Computers",
  "computer-accessories": "Computer Accessories",
  audio: "Audio",
  "phones-accessories": "Phones & Accessories",
  fitness: "Fitness",
  home: "Home",
  kitchen: "Kitchen",
  outdoors: "Outdoors",
  "everyday-carry": "Everyday Carry",
};

export type SortOption =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "popular";

/** Full product entity. Prices are integer minor units (cents). */
export interface Product {
  id: string;
  slug: string;
  title: string;
  brand: string;
  category: CategorySlug;
  description: string;
  price: number;
  currency: string;
  images: string[];
  /** Units on hand. 0 means out of stock. */
  stock: number;
  /** Rating in tenths of a star: 48 => 4.8 */
  ratingTenths: number;
  reviewCount: number;
  tags: string[];
  specs: Record<string, string>;
  featured: boolean;
}

export interface CatalogQuery {
  q?: string;
  categories?: CategorySlug[];
  brands?: string[];
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRatingTenths?: number;
  inStockOnly?: boolean;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface CatalogPage {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CatalogProvider {
  readonly name: string;
  search(query: CatalogQuery): Promise<CatalogPage>;
  getById(id: string): Promise<Product | null>;
  getBySlug(slug: string): Promise<Product | null>;
  getByIds(ids: string[]): Promise<Product[]>;
  featured(): Promise<Product[]>;
  related(product: Product, limit?: number): Promise<Product[]>;
  categories(): Promise<
    Array<{ slug: CategorySlug; label: string; count: number }>
  >;
}
