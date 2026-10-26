'use client';

import { useEffect, useState } from 'react';
import { money } from '@/lib/money';
import { LIMITS } from '@/lib/config';
import type { CatalogueItem } from './OrderForm';

export type GalleryFamily = { id: string; title: string; desc: string; chips: string[]; pw: boolean; hero: string | null };
export type GalleryCard = { family: string; name: string; photo: string; w: number; h: number; itemNos: number[] };

type QtyProps = {
  qty: Record<number, string>;
  parseQty: (raw: string | undefined) => number | null;
  setOne: (no: number, v: string) => void;
  bump: (no: number, d: number) => void;
};

/** One row per pot size: size, item #, price and a quantity stepper. Each size keeps its own item number. */
function SizeRows({ items, qty, parseQty, setOne, bump, idPrefix }: QtyProps & { items: CatalogueItem[]; idPrefix: string }) {
  return (
    <div className="g-sizes">
      {items.map((it) => {
        const raw = qty[it.itemNo] ?? '';
        const q = parseQty(raw);
        const bad = q === null;
        return (
          <div className={`g-size${q && q > 0 ? ' on' : ''}`} key={it.itemNo}>
            <div className="g-size-top">
              <span>
                <b className="g-no">#{it.itemNo}</b> {it.size}
              </span>
              <b className="g-price">{money(it.priceCents)}</b>
            </div>
            <div className="qty-wrap">
              <button type="button" aria-label={`One less ${it.name} item ${it.itemNo}`} onClick={() => bump(it.itemNo, -1)}>−</button>
              <input
                id={`${idPrefix}-${it.itemNo}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`Quantity for item ${it.itemNo}, ${it.family} ${it.name}, ${it.size}`}
                aria-invalid={bad}
                className={bad ? 'bad' : ''}
                placeholder="0"
                value={raw}
                maxLength={4}
                onChange={(e) => setOne(it.itemNo, e.target.value)}
              />
              <button type="button" aria-label={`One more ${it.name} item ${it.itemNo}`} onClick={() => bump(it.itemNo, 1)}>+</button>
            </div>
            {bad && <div className="field-error">Whole numbers 0 to {LIMITS.maxQtyPerLine}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function PlantGallery({
  families,
  cards,
  itemsByNo,
  visible,
  ...qp
}: QtyProps & {
  families: GalleryFamily[];
  cards: GalleryCard[];
  itemsByNo: Map<number, CatalogueItem>;
  /** Item numbers that pass the current search and filters. */
  visible: Set<number>;
}) {
  const [zoom, setZoom] = useState<GalleryCard | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [zoom]);

  const shown = families
    .map((f) => ({ f, list: cards.filter((c) => c.family === f.id && c.itemNos.some((n) => visible.has(n))) }))
    .filter((g) => g.list.length);

  if (!shown.length) return <div className="card">No plants match your search.</div>;

  return (
    <>
      {shown.map(({ f, list }) => (
        <section className="g-family" key={f.id} id={`g-${f.id}`}>
          <header className={`g-head${f.hero ? ' has-photo' : ''}`} style={f.hero ? { backgroundImage: `url(${f.hero})` } : undefined}>
            <div className="g-head-in">
              {f.pw && <span className="g-pw">Proven Winners®</span>}
              <h3>{f.title}</h3>
            </div>
          </header>
          {(f.desc || f.chips.length > 0) && (
            <div className="g-about">
              {f.desc && <p>{f.desc}</p>}
              {f.chips.length > 0 && (
                <div className="g-chips">
                  {f.chips.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="g-grid">
            {list.map((c) => {
              const items = c.itemNos.map((n) => itemsByNo.get(n)!).filter(Boolean);
              const count = items.reduce((a, it) => a + (qp.parseQty(qp.qty[it.itemNo]) ?? 0), 0);
              return (
                <article className={`g-card${count > 0 ? ' chosen' : ''}`} key={c.itemNos[0]}>
                  <button type="button" className="g-photo" onClick={() => setZoom(c)} aria-label={`Enlarge photo of ${c.name}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.photo} alt={`${f.title}: ${c.name}`} width={c.w} height={c.h} loading="lazy" decoding="async" />
                    {count > 0 && <span className="g-count">✓ {count} in order</span>}
                    <span className="g-zoom" aria-hidden="true">⤢</span>
                  </button>
                  <div className="g-body">
                    <h4>{c.name}</h4>
                    <SizeRows items={items} idPrefix="g" {...qp} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {zoom && (
        <div className="g-modal" role="dialog" aria-modal="true" aria-label={zoom.name} onClick={() => setZoom(null)}>
          <div className="g-modal-box" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="g-close" onClick={() => setZoom(null)} aria-label="Close">×</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.photo} alt={zoom.name} />
            <div className="g-modal-body">
              {(() => {
                const fam = families.find((f) => f.id === zoom.family);
                return (
                  <>
                    <div className="muted small">{fam?.title}</div>
                    <h3>{zoom.name}</h3>
                    {fam?.desc && <p className="small">{fam.desc}</p>}
                    {fam && fam.chips.length > 0 && (
                      <div className="g-chips" style={{ marginBottom: 12 }}>
                        {fam.chips.map((c) => <span key={c}>{c}</span>)}
                      </div>
                    )}
                  </>
                );
              })()}
              <SizeRows items={zoom.itemNos.map((n) => itemsByNo.get(n)!).filter(Boolean)} idPrefix="z" {...qp} />
              <button type="button" className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setZoom(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
