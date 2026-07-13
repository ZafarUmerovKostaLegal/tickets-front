export function TimeUsersSkeleton() {
    return (<div className="time-page__panel time-users time-users--skeleton">
    <section className="tus tus--skeleton">
        <div className="tus__cards">
          {[1, 2, 3, 4].map((i) => (<div key={i} className="tus__card tus-skel__card">
              <span className="tus-skel__icon"/>
              <div className="tus-skel__body">
                <span className="tus-skel__label"/>
                <span className="tus-skel__value"/>
              </div>
            </div>))}
        </div>
    <div className="tus__util tus-skel__util">
          <div className="tus__util-header">
            <span className="tus-skel__util-label"/>
            <span className="tus-skel__util-pct"/>
          </div>
          <div className="tus__util-track">
            <span className="tus-skel__util-bar"/>
          </div>
          <div className="tus__util-legend">
            <span className="tus-skel__util-leg"/>
            <span className="tus-skel__util-leg"/>
          </div>
        </div>
      </section>
    <section className="time-users__table-section">
        <div className="time-users__table-head tus-skel__table-head">
          <span className="tus-skel__head-user"/>
          <div className="time-users__table-cols">
            <span className="tus-skel__head-col"/>
            <span className="tus-skel__head-col"/>
            <span className="tus-skel__head-col"/>
            <span className="tus-skel__head-col"/>
            <span className="tus-skel__head-col"/>
          </div>
        </div>
        <div className="time-users__table-body">
          {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="time-users__row tus-skel__row">
              <div className="time-users__cell time-users__cell--user">
                <span className="tus-skel__avatar"/>
                <span className="tus-skel__name"/>
              </div>
              <div className="time-users__cell time-users__cell--hours">
                <span className="tus-skel__short"/>
              </div>
              <div className="time-users__cell time-users__cell--util">
                <span className="tus-skel__short"/>
              </div>
              <div className="time-users__cell time-users__cell--cap">
                <span className="tus-skel__short"/>
              </div>
              <div className="time-users__cell time-users__cell--billable">
                <span className="tus-skel__short"/>
              </div>
              <div className="time-users__cell time-users__cell--actions">
                <span className="tus-skel__actions"/>
              </div>
            </div>))}
        </div>
      </section>
    </div>);
}
