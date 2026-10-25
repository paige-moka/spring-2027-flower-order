import data from '@/data/products.json';

export type Product = {
  itemNo: number;
  family: string;
  name: string;
  size: string;
  /** Price in cents. Whole cents avoid floating point rounding errors. */
  priceCents: number;
  page: number;
};

type RawItem = { item_no: number; family: string; name: string; size: string; price: number; page: number };

export const PRODUCTS: Product[] = (data.items as RawItem[]).map((it) => ({
  itemNo: it.item_no,
  family: it.family,
  name: it.name,
  size: it.size,
  priceCents: Math.round(it.price * 100),
  page: it.page,
}));

export const PRODUCT_BY_NO: ReadonlyMap<number, Product> = new Map(PRODUCTS.map((p) => [p.itemNo, p]));

/** Full product label as printed in the catalogue, for example "Superbells® Calibrachoa: Blue". */
export function productLabel(p: Pick<Product, 'family' | 'name'>): string {
  return p.name && p.name !== p.family ? `${p.family}: ${p.name}` : p.family;
}

export const CATALOGUE_SHA256: string = data.source_sha256;
