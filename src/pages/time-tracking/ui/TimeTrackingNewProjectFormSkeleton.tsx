export function TimeTrackingNewProjectFormSkeleton() {
  return (<div className="tt-tm-proj-page npf-skel" aria-hidden="true">
    <div className="tt-tm-proj-page__card tt-tm-modal tt-tm-modal--project">
      <div className="tt-tm-modal__body npf-skel__body">
        <div className="tt-tm-field">
          <div className="tt-tm-field-row tt-tm-field-row--client-pick">
            <div className="tt-tm-field tt-tm-field--grow">
              <span className="npf-skel__label"/>
              <span className="npf-skel__input"/>
            </div>
            <div className="tt-tm-field tt-tm-field--shrink">
              <span className="tt-tm-label tt-tm-label--invisible" aria-hidden>
                {'\u00a0'}
              </span>
              <span className="npf-skel__btn-outline"/>
            </div>
          </div>
        </div>
        <div className="tt-tm-field">
          <span className="npf-skel__label npf-skel__label--mid"/>
          <span className="npf-skel__input"/>
        </div>
        <div className="tt-tm-field">
          <span className="npf-skel__label npf-skel__label--short"/>
          <span className="npf-skel__input"/>
          <span className="npf-skel__hint"/>
        </div>
        <div className="tt-tm-field-row">
          <div className="tt-tm-field tt-tm-field--cell">
            <span className="npf-skel__label npf-skel__label--tiny"/>
            <span className="npf-skel__input"/>
          </div>
          <div className="tt-tm-field tt-tm-field--cell">
            <span className="npf-skel__label npf-skel__label--tiny"/>
            <span className="npf-skel__input"/>
          </div>
        </div>
        <div className="tt-tm-field">
          <span className="npf-skel__label npf-skel__label--mid"/>
          <span className="npf-skel__input"/>
          <span className="npf-skel__hint npf-skel__hint--long"/>
        </div>
        <div className="tt-tm-field">
          <span className="npf-skel__label npf-skel__label--wide"/>
          <span className="npf-skel__input"/>
        </div>
        <div className="tt-tm-field">
          <span className="npf-skel__label npf-skel__label--narrow"/>
          <span className="npf-skel__input"/>
        </div>
        <fieldset className="tt-tm-fieldset tt-tm-fieldset--budget">
          <legend className="tt-tm-fieldset-legend tt-tm-fieldset-legend--budget">
            <span className="npf-skel__legend"/>
          </legend>
          <div className="tt-tm-fieldset--budget__grid">
            <div className="npf-skel__check-row">
              <span className="npf-skel__check"/>
              <span className="npf-skel__check-line"/>
            </div>
            <div className="npf-skel__check-row">
              <span className="npf-skel__check"/>
              <span className="npf-skel__check-line npf-skel__check-line--short"/>
            </div>
            <div className="npf-skel__check-row tt-tm-fieldset--budget__check-wide">
              <span className="npf-skel__check"/>
              <span className="npf-skel__check-line npf-skel__check-line--med"/>
            </div>
          </div>
        </fieldset>
        <div className="tt-tm-field">
          <span className="npf-skel__label npf-skel__label--wide"/>
          <span className="npf-skel__input"/>
        </div>
        <div className="tt-tm-field">
          <span className="npf-skel__label"/>
          <div className="tt-tm-members__add-row">
            <span className="npf-skel__plus"/>
            <span className="npf-skel__input npf-skel__input--grow"/>
          </div>
          <span className="npf-skel__hint"/>
        </div>
        <div className="tt-tm-field">
          <span className="npf-skel__label npf-skel__label--short"/>
          <span className="npf-skel__textarea"/>
        </div>
      </div>
      <div className="tt-tm-modal__foot">
        <span className="npf-skel__foot-btn"/>
        <span className="npf-skel__foot-btn npf-skel__foot-btn--primary"/>
      </div>
    </div>
  </div>);
}
