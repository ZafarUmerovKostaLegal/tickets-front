export function ProjectsSkeleton() {
    return (<div className="pp pp--skeleton">
    <div className="pp__topbar">
        <div className="pp__topbar-left">
          <span className="pp-skel__title"/>
          <span className="pp-skel__status"/>
        </div>
        <div className="pp__topbar-right">
          <span className="pp-skel__filter"/>
          <span className="pp-skel__filter"/>
          <span className="pp-skel__new-btn"/>
        </div>
      </div>
    <div className="pp__table-wrap">
        <div className="pp__table">
    <div className="pp__thead">
            <span className="pp__th pp__th--check"><span className="pp-skel__checkbox"/></span>
            <span className="pp__th pp__th--name"><span className="pp-skel__head"/></span>
            <span className="pp__th pp__th--budget"><span className="pp-skel__head"/></span>
            <span className="pp__th pp__th--spent"><span className="pp-skel__head"/></span>
            <span className="pp__th pp__th--bar"/>
            <span className="pp__th pp__th--remaining"><span className="pp-skel__head"/></span>
            <span className="pp__th pp__th--costs"><span className="pp-skel__head"/></span>
            <span className="pp__th pp__th--actions"/>
          </div>
    <div className="pp__group">
            <div className="pp__client-row pp-skel__client-row">
              <span className="pp-skel__chevron"/>
              <span className="pp-skel__client-name"/>
              <span className="pp-skel__client-meta"/>
            </div>
            {[1, 2, 3].map((i) => (<div key={i} className="pp__row pp-skel__row">
                <span className="pp__td pp__td--check"><span className="pp-skel__checkbox"/></span>
                <span className="pp__td pp__td--name">
                  <span className="pp-skel__proj-name"/>
                  <span className="pp-skel__badge"/>
                </span>
                <span className="pp__td pp__td--budget"><span className="pp-skel__amount"/></span>
                <span className="pp__td pp__td--spent"><span className="pp-skel__amount"/></span>
                <span className="pp__td pp__td--bar"><span className="pp-skel__bar"/></span>
                <span className="pp__td pp__td--remaining"><span className="pp-skel__amount"/></span>
                <span className="pp__td pp__td--costs"><span className="pp-skel__amount"/></span>
                <span className="pp__td pp__td--actions"><span className="pp-skel__actions"/></span>
              </div>))}
          </div>
    <div className="pp__group">
            <div className="pp__client-row pp-skel__client-row">
              <span className="pp-skel__chevron"/>
              <span className="pp-skel__client-name pp-skel__client-name--short"/>
              <span className="pp-skel__client-meta"/>
            </div>
            {[1, 2].map((i) => (<div key={i} className="pp__row pp-skel__row">
                <span className="pp__td pp__td--check"><span className="pp-skel__checkbox"/></span>
                <span className="pp__td pp__td--name">
                  <span className="pp-skel__proj-name pp-skel__proj-name--short"/>
                  <span className="pp-skel__badge"/>
                </span>
                <span className="pp__td pp__td--budget"><span className="pp-skel__amount"/></span>
                <span className="pp__td pp__td--spent"><span className="pp-skel__amount"/></span>
                <span className="pp__td pp__td--bar"><span className="pp-skel__bar"/></span>
                <span className="pp__td pp__td--remaining"><span className="pp-skel__amount"/></span>
                <span className="pp__td pp__td--costs"><span className="pp-skel__amount"/></span>
                <span className="pp__td pp__td--actions"><span className="pp-skel__actions"/></span>
              </div>))}
          </div>
    <div className="pp__group">
            <div className="pp__client-row pp-skel__client-row">
              <span className="pp-skel__chevron"/>
              <span className="pp-skel__client-name"/>
              <span className="pp-skel__client-meta"/>
            </div>
            <div className="pp__row pp-skel__row">
              <span className="pp__td pp__td--check"><span className="pp-skel__checkbox"/></span>
              <span className="pp__td pp__td--name">
                <span className="pp-skel__proj-name"/>
                <span className="pp-skel__badge"/>
              </span>
              <span className="pp__td pp__td--budget"><span className="pp-skel__amount"/></span>
              <span className="pp__td pp__td--spent"><span className="pp-skel__amount"/></span>
              <span className="pp__td pp__td--bar"><span className="pp-skel__bar"/></span>
              <span className="pp__td pp__td--remaining"><span className="pp-skel__amount"/></span>
              <span className="pp__td pp__td--costs"><span className="pp-skel__amount"/></span>
              <span className="pp__td pp__td--actions"><span className="pp-skel__actions"/></span>
            </div>
          </div>
        </div>
      </div>
    </div>);
}
