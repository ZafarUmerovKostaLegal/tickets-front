export function ReportsSkeleton() {
    return (<div className="tt-reports tt-reports--skeleton">
      <div className="tt-reports__type-block">
        <span className="tt-reports-skel__type-block-title"/>
        <nav className="tt-reports__type-nav">
          {[1, 2, 3, 4, 5].map((i) => (<span key={i} className="tt-reports-skel__type-tab"/>))}
        </nav>
      </div>
    <div className="tt-reports__header">
        <div className="tt-reports__header-left">
          <span className="tt-reports-skel__nav-btn"/>
          <span className="tt-reports-skel__period-title"/>
          <span className="tt-reports-skel__nav-btn"/>
        </div>
        <div className="tt-reports__header-right">
          <span className="tt-reports-skel__btn"/>
          <span className="tt-reports-skel__btn tt-reports-skel__btn--short"/>
        </div>
      </div>
    <div className="tt-reports__summary">
        <div className="tt-reports__summary-card">
          <span className="tt-reports-skel__label"/>
          <span className="tt-reports-skel__value tt-reports-skel__value--large"/>
        </div>
        <div className="tt-reports__summary-card">
          <span className="tt-reports-skel__pie"/>
          <div className="tt-reports-skel__legend">
            <span className="tt-reports-skel__legend-item"/>
            <span className="tt-reports-skel__legend-item"/>
          </div>
        </div>
        <div className="tt-reports__summary-card">
          <span className="tt-reports-skel__label"/>
          <span className="tt-reports-skel__value"/>
          <span className="tt-reports-skel__sub"/>
        </div>
        <div className="tt-reports__summary-card">
          <span className="tt-reports-skel__label"/>
          <span className="tt-reports-skel__value"/>
          <span className="tt-reports-skel__sub"/>
        </div>
      </div>
    <nav className="tt-reports__group-nav">
        {[1, 2, 3, 4].map((i) => (<span key={i} className="tt-reports-skel__group-tab"/>))}
      </nav>
    <div className="tt-reports__content">
        <div className="tt-reports__content-header">
          <span className="tt-reports-skel__breakdown-bar"/>
          <div className="tt-reports__content-header-right">
            <div className="tt-reports__toolbar">
              <div className="tt-reports__toolbar-search">
                <span className="tt-reports-skel__search" aria-hidden/>
              </div>
              <div className="tt-reports__toolbar-meta">
                <span className="tt-reports-skel__row-count" aria-hidden/>
              </div>
            </div>
            <div className="tt-reports-skel__actions tt-reports__content-actions">
              <span className="tt-reports-skel__btn tt-reports-skel__btn--short"/>
              <span className="tt-reports-skel__btn"/>
              <span className="tt-reports-skel__btn tt-reports-skel__btn--icon"/>
            </div>
          </div>
        </div>
        <div className="tt-reports__table-wrap">
          <div className="tt-reports-skel__table-head">
            <span className="tt-reports-skel__th"/>
            <span className="tt-reports-skel__th"/>
            <span className="tt-reports-skel__th"/>
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (<div key={i} className="tt-reports-skel__row">
              <span className="tt-reports-skel__cell tt-reports-skel__cell--name"/>
              <span className="tt-reports-skel__cell tt-reports-skel__cell--hours"/>
              <span className="tt-reports-skel__cell tt-reports-skel__cell--billable"/>
            </div>))}
        </div>
      </div>
    </div>);
}
