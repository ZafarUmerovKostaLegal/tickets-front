export type TimesheetSkeletonLayout = 'week' | 'calendar';
type TimesheetSkeletonProps = {
    layout?: TimesheetSkeletonLayout;
    showChrome?: boolean;
};
const CAL_SKEL_CELL_KEYS = Array.from({ length: 42 }, (_, i) => i);
export function TimesheetSkeleton({ layout = 'week', showChrome = true }: TimesheetSkeletonProps) {
    const isCal = layout === 'calendar';
    const body = (<>
      <div className={`tsp__strip${isCal ? ' tsp__strip--calendar' : ''}`}>
        {isCal ? (<div className="tsp__cal tsp-skel__cal">
            <div className="tsp__cal-dows tsp-skel__cal-dows">
              {CAL_SKEL_CELL_KEYS.slice(0, 7).map((i) => (<div key={`dow-${i}`} className={`tsp__cal-dow${i >= 5 ? ' tsp__cal-dow--wknd' : ''}`} aria-hidden>
                  <span className="tsp-skel__cal-dow"/>
                </div>))}
            </div>
            <div className="tsp__cal-grid tsp-skel__cal-grid">
              {CAL_SKEL_CELL_KEYS.map((i) => (<span key={`cell-${i}`} className="tsp-skel__cal-cell" style={{ animationDelay: `${Math.min(i, 24) * 0.012}s` }}/>))}
            </div>
          </div>) : ([1, 2, 3, 4, 5, 6, 7].map((i) => (<div key={i} className="tsp__day tsp-skel__day">
              <span className="tsp-skel__day-wk"/>
              <span className="tsp-skel__day-n"/>
              <div className="tsp__day-bar-wrap">
                <span className="tsp-skel__day-bar"/>
              </div>
              <span className="tsp-skel__day-h"/>
            </div>)))}
        <div className="tsp__wtotal tsp-skel__wtotal">
          <span className="tsp-skel__wtotal-lbl"/>
          <span className="tsp-skel__wtotal-n"/>
          <div className="tsp__wtotal-bar-wrap">
            <span className="tsp-skel__wtotal-bar"/>
          </div>
          <span className="tsp-skel__wtotal-cap"/>
        </div>
      </div>

      <div className="tsp__content">
        <div className="tsp__groups">
          <div className="tsp__group">
            <div className="tsp__rows">
              {[1, 2, 3].map((i) => (<div key={i} className="tsp__row tsp-skel__row">
                  <span className="tsp-skel__row-bar"/>
                  <div className="tsp__row-txt">
                    <span className="tsp-skel__row-proj"/>
                    <span className="tsp-skel__row-task"/>
                    <span className="tsp-skel__row-notes"/>
                  </div>
                  <div className="tsp__row-acts">
                    <span className="tsp-skel__row-h"/>
                    <span className="tsp-skel__btn"/>
                    <span className="tsp-skel__btn"/>
                  </div>
                </div>))}
              <div className="tsp__day-sum tsp-skel__day-sum">
                <span className="tsp-skel__day-sum-add"/>
                <span className="tsp-skel__day-sum-total"/>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tsp__foot">
        <div className="tsp__foot-total">
          <span className="tsp-skel__foot-lbl"/>
          <span className="tsp-skel__foot-n"/>
        </div>
        <div className="tsp__submit-wrap">
          <span className="tsp-skel__submit"/>
        </div>
      </div>
    </>);
    if (!showChrome) {
        return (<div className={`tsp__body-skel tsp--skeleton${isCal ? ' tsp--skeleton--calendar tsp--calendar-layout' : ''}`}>
        {body}
      </div>);
    }
    return (<div className={`tsp tsp--skeleton${isCal ? ' tsp--skeleton--calendar' : ''}`}>
      <div className="tsp__top">
        <div className="tsp__top-l">
          <span className="tsp-skel__arr"/>
          <span className="tsp-skel__arr"/>
          <span className="tsp-skel__heading"/>
        </div>
        <div className="tsp__top-r">
          <div className="tsp__seg tsp-skel__seg">
            <span className="tsp-skel__seg-btn"/>
            <span className="tsp-skel__seg-btn"/>
            <span className="tsp-skel__seg-btn"/>
          </div>
        </div>
      </div>

      {body}
    </div>);
}
