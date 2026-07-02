import type { ReactNode } from "react";

/**
 * Page chrome for a component page: title, description, then the three
 * sections in order — hero (the stage + its controls), variants, usage.
 */
export function PageLayout({ title, description, hero, variants, usage }: {
  title: string; description: string; hero: ReactNode; variants?: ReactNode; usage?: ReactNode;
}) {
  return (
    <article className="sc-page">
      <header className="sc-page-head">
        <h1>{title}</h1>
        <p className="sub">{description}</p>
      </header>
      <section className="sc-hero">{hero}</section>
      {variants ? (
        <section className="sc-variants">
          <h2>Variants</h2>
          {variants}
        </section>
      ) : null}
      {usage ? (
        <section className="sc-usage">
          <h2>Usage</h2>
          {usage}
        </section>
      ) : null}
    </article>
  );
}
