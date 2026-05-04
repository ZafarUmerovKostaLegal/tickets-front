import type { CSSProperties } from 'react';

const SKEL_TABLE_ROWS = 8;

function Shimmer({ className = '', style }: { className?: string; style?: CSSProperties }) {
    return <span className={`corr-skel__bone${className ? ` ${className}` : ''}`} style={style}/>;
}

export function CorrespondenceHeaderTitleSkeleton() {
    return (<div className="corr-skel__header-text" aria-hidden>
      <span className="corr-skel__bone corr-skel__header-h1"/>
      <span className="corr-skel__bone corr-skel__header-p"/>
    </div>);
}

/** Скелетон основной колонки: KPI, таблица, пагинация */
export function CorrespondenceMainSkeleton() {
    return (<div className="corr-skel" aria-busy="true" aria-label="Загрузка данных">
      <section className="corr-skel__stats" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="corr-skel__stat">
            <Shimmer className="corr-skel__stat-icon"/>
            <div className="corr-skel__stat-text">
              <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm"/>
              <Shimmer className="corr-skel__stat-line corr-skel__stat-line--lg"/>
              <Shimmer className="corr-skel__stat-line corr-skel__stat-line--md"/>
            </div>
          </div>))}
      </section>

      <section className="corr-skel__table-card">
        <div className="corr-skel__toolbar">
          <div className="corr-skel__tabs">
            {Array.from({ length: 4 }).map((_, i) => (<Shimmer key={i} className="corr-skel__tab" style={{ width: `${56 + i * 8}px` }}/>))}
          </div>
          <div className="corr-skel__toolbar-actions">
            <Shimmer className="corr-skel__btn"/>
            <Shimmer className="corr-skel__icon-btn"/>
          </div>
        </div>
        <div className="corr-skel__table-wrap">
          <div className="corr-skel__thead">
            <Shimmer className="corr-skel__th" style={{ width: '100px' }}/>
            <Shimmer className="corr-skel__th" style={{ width: 'min(140px, 18%)' }}/>
            <Shimmer className="corr-skel__th corr-skel__th--grow"/>
            <Shimmer className="corr-skel__th" style={{ width: '72px' }}/>
            <Shimmer className="corr-skel__th" style={{ width: '120px' }}/>
            <Shimmer className="corr-skel__th" style={{ width: '110px' }}/>
            <Shimmer className="corr-skel__th" style={{ width: '100px' }}/>
            <Shimmer className="corr-skel__th" style={{ width: '36px' }}/>
          </div>
          {Array.from({ length: SKEL_TABLE_ROWS }).map((_, row) => (<div key={row} className="corr-skel__tr">
              <Shimmer className="corr-skel__td" style={{ width: '100px' }}/>
              <Shimmer className="corr-skel__td" style={{ width: 'min(140px, 18%)' }}/>
              <Shimmer className="corr-skel__td corr-skel__td--subject"/>
              <Shimmer className="corr-skel__td" style={{ width: '56px', borderRadius: '6px' }}/>
              <Shimmer className="corr-skel__td" style={{ width: '120px' }}/>
              <Shimmer className="corr-skel__td" style={{ width: '100px' }}/>
              <Shimmer className="corr-skel__td" style={{ width: '72px', borderRadius: '6px' }}/>
              <Shimmer className="corr-skel__td" style={{ width: '24px' }}/>
            </div>))}
        </div>
        <div className="corr-skel__footer">
          <Shimmer className="corr-skel__footer-meta"/>
          <div className="corr-skel__pager">
            <Shimmer className="corr-skel__page-arrow"/>
            {Array.from({ length: 5 }).map((_, i) => (<Shimmer key={i} className="corr-skel__page-num"/>))}
            <Shimmer className="corr-skel__page-arrow"/>
          </div>
        </div>
      </section>
    </div>);
}

/** Скелетон боковой панели «Быстрые действия» */
export function CorrespondenceAsideSkeleton() {
    return (<div className="corr-skel corr-skel--aside" aria-hidden>
      <Shimmer className="corr-skel__aside-title"/>
      <Shimmer className="corr-skel__aside-btn corr-skel__aside-btn--primary"/>
      <Shimmer className="corr-skel__aside-btn"/>
      <Shimmer className="corr-skel__aside-btn"/>
    </div>);
}
