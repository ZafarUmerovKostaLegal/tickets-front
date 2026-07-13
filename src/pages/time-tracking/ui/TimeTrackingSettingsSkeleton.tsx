export function TimeTrackingSettingsSkeleton() {
    return (<div className="tt-settings tt-settings--skeleton">
      <div className="tt-reports__type-block">
        <span className="tt-reports-skel__type-block-title"/>
        <nav className="tt-reports__type-nav" aria-hidden>
          {[1, 2].map((i) => (<span key={i} className="tt-reports-skel__type-tab"/>))}
        </nav>
      </div>
      <div className="tt-settings__content">
        <div className="tt-settings__header-row tt-settings__header-row--skeleton">
          <span className="tt-skel__title"/>
          <span className="tt-skel__btn tt-skel__btn--link"/>
        </div>

        <div className="tt-settings__actions-row">
          <div className="tt-settings__toolbar-left">
            <span className="tt-skel__btn tt-skel__btn--primary"/>
            <span className="tt-skel__btn"/>
            <span className="tt-skel__btn"/>
          </div>
          <div className="tt-settings__search-wrap">
            <span className="tt-skel__search"/>
          </div>
        </div>

        <div className="tt-settings__list">
          {[1, 2, 3, 4, 5, 6].map((i) => (<div key={i} className="tt-settings__list-row tt-skel__list-row">
              <span className="tt-skel__row-edit"/>
              <span className="tt-skel__row-name"/>
              <span className="tt-skel__row-add"/>
            </div>))}
        </div>
      </div>
    </div>);
}
