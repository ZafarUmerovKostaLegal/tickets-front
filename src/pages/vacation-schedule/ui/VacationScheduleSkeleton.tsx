import './VacationScheduleSkeleton.css';
const LEGEND_PLACEHOLDERS = 5;
const HEADER_MONTH_BLOCKS = 6;
const DAY_CELLS_PREVIEW = 48;
const BODY_ROWS = 8;
export function VacationScheduleSkeleton() {
    return (<div className="vac-skel" aria-busy="true" aria-label="Загрузка таблицы графика отпусков">
      <div className="vac-skel__legend">
        {Array.from({ length: LEGEND_PLACEHOLDERS }).map((_, i) => (<span key={i} className="vac-skel__chip"/>))}
      </div>

      <div className="vac-skel__scroll">
        <div className="vac-skel__table">
          <div className="vac-skel__thead">
            <div className="vac-skel__tr vac-skel__tr--months">
              <div className="vac-skel__corner"/>
              <div className="vac-skel__months-strip">
                {Array.from({ length: HEADER_MONTH_BLOCKS }).map((_, i) => (<span key={i} className="vac-skel__month-block"/>))}
                <span className="vac-skel__sum-pill"/>
              </div>
            </div>
            <div className="vac-skel__tr vac-skel__tr--nums">
              <span className="vac-skel__th-num"/>
              <span className="vac-skel__th-name"/>
              <div className="vac-skel__day-strip">
                {Array.from({ length: DAY_CELLS_PREVIEW }).map((_, i) => (<span key={i} className="vac-skel__day-head"/>))}
              </div>
            </div>
            <div className="vac-skel__tr vac-skel__tr--wd">
              <span className="vac-skel__th-num vac-skel__th-num--ghost"/>
              <span className="vac-skel__th-name vac-skel__th-name--ghost"/>
              <div className="vac-skel__day-strip">
                {Array.from({ length: DAY_CELLS_PREVIEW }).map((_, i) => (<span key={i} className="vac-skel__wd-head"/>))}
              </div>
            </div>
          </div>

          <div className="vac-skel__tbody">
            {Array.from({ length: BODY_ROWS }).map((_, row) => (<div key={row} className="vac-skel__tr vac-skel__tr--body">
                <span className="vac-skel__td-num"/>
                <span className="vac-skel__td-name"/>
                <div className="vac-skel__day-strip">
                  {Array.from({ length: DAY_CELLS_PREVIEW }).map((_, col) => (<span key={col} className="vac-skel__cell"/>))}
                </div>
              </div>))}
          </div>
        </div>
      </div>
    </div>);
}
