import { Suspense } from "react";

import OpportunitiesClientPage from "./opportunities-client";

function OpportunitiesPageFallback() {
  return (
    <section
      className="dashboard-content opportunity-board"
      aria-busy="true"
      aria-labelledby="opportunities-title"
    >
      <header className="dashboard-content__header opportunity-board__header">
        <h2 id="opportunities-title">Opportunities</h2>
      </header>
      <div className="opportunity-board__body">
        <p className="opportunity-board__feedback" role="status">
          Loading…
        </p>
      </div>
    </section>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<OpportunitiesPageFallback />}>
      <OpportunitiesClientPage />
    </Suspense>
  );
}
