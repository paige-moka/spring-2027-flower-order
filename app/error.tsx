'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap narrow">
      <h1>Something went wrong</h1>
      <p>Please try again. If this keeps happening, contact Monica at monica.blaeser@gmail.com.</p>
      <button className="btn" onClick={reset}>Try again</button>
    </div>
  );
}
