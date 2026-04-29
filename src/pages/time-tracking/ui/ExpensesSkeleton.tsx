export function ExpensesSkeleton() {
    return (<div className="time-page__panel tt-exp-panel exp--skeleton">
      <div className="tt-exp-panel__shell">
        <div className="tt-exp-panel__toolbar">
          <div className="tt-exp-panel__toolbar-left">
            <span className="exp-skel__page-title"/>
          </div>
          <div className="tt-exp-panel__toolbar-right exp-skel__toolbar-actions">
            <span className="exp-skel__add-btn"/>
          </div>
        </div>
        <div className="tt-exp-panel__sections">
          <section className="tt-exp-panel__section">
            <div className="tt-exp-panel__section-head tt-exp-panel__section-head--journal">
              <span className="exp-skel__section-title"/>
              <span className="exp-skel__section-subtitle"/>
              <div className="exp-skel__journal-project">
                <div className="exp-skel__journal-project-line">
                  <span className="exp-skel__project-label"/>
                  <span className="exp-skel__project-dot"/>
                </div>
                <span className="exp-skel__project-select"/>
              </div>
            </div>
            <div className="tt-exp-panel__section-body">
              <div className="tt-exp-panel__weeks">
                <div className="exp__week">
                  <div className="exp__week-head exp-skel__week-head">
                    <div className="exp__week-head-left">
                      <span className="exp-skel__chevron"/>
                      <span className="exp-skel__range"/>
                      <span className="exp-skel__badge"/>
                    </div>
                  </div>
                  {[1, 2, 3].map((i) => (<div key={i} className="exp__item exp-skel__item">
                      <span className="exp__item-date">
                        <span className="exp-skel__weekday"/>
                        <span className="exp-skel__day"/>
                      </span>
                      <div className="exp__item-info">
                        <span className="exp-skel__proj"/>
                        <span className="exp-skel__cat"/>
                        <span className="exp-skel__notes"/>
                      </div>
                      <div className="exp__item-right">
                        <span className="exp-skel__amount"/>
                        <span className="exp-skel__icon"/>
                        <span className="exp-skel__icon"/>
                      </div>
                    </div>))}
                  <div className="exp__week-total exp-skel__week-total">
                    <span className="exp-skel__total-label"/>
                    <span className="exp-skel__total-val"/>
                  </div>
                </div>
                <div className="exp__week">
                  <div className="exp__week-head exp-skel__week-head">
                    <div className="exp__week-head-left">
                      <span className="exp-skel__chevron"/>
                      <span className="exp-skel__range exp-skel__range--short"/>
                      <span className="exp-skel__badge"/>
                    </div>
                  </div>
                  {[1, 2].map((i) => (<div key={i} className="exp__item exp-skel__item">
                      <span className="exp__item-date">
                        <span className="exp-skel__weekday"/>
                        <span className="exp-skel__day"/>
                      </span>
                      <div className="exp__item-info">
                        <span className="exp-skel__proj exp-skel__proj--short"/>
                        <span className="exp-skel__cat"/>
                      </div>
                      <div className="exp__item-right">
                        <span className="exp-skel__amount"/>
                        <span className="exp-skel__icon"/>
                        <span className="exp-skel__icon"/>
                      </div>
                    </div>))}
                  <div className="exp__week-total exp-skel__week-total">
                    <span className="exp-skel__total-label"/>
                    <span className="exp-skel__total-val"/>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>);
}
