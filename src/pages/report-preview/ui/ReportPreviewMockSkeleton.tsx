import type { ReactNode } from 'react';
const SKEL_ROWS = 6;
function Bar({ className = '' }: { className?: string }) {
    return <span className={`tt-rp-skel-bar ${className}`.trim()} aria-hidden />;
}
function RowCells({ children }: { children: ReactNode }) {
    return <tr>{children}</tr>;
}
export type ReportPreviewMockSkeletonVariant = 'time' | 'expenses' | 'uninvoiced' | 'budget' | 'generic';
export function ReportPreviewMockSkeleton({ variant, label = 'Загрузка…', }: {
    variant: ReportPreviewMockSkeletonVariant;
    label?: string;
}) {
    const rows = Array.from({ length: SKEL_ROWS }, (_, i) => i);
    return (<div className="tt-rp-mtable-wrap tt-rp-skel-wrap" role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <div className="tt-rp-mtable-card tt-rp-skel-card">
        <header className="tt-rp-mtable-head tt-rp-skel-card__head">
          <div className="tt-rp-skel-card__titles">
            <Bar className="tt-rp-skel-bar--title"/>
            <Bar className="tt-rp-skel-bar--sub"/>
          </div>
          {variant === 'time' || variant === 'generic'
        ? <Bar className="tt-rp-skel-bar--pill"/>
        : null}
        </header>
        <div className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          {variant === 'time' || variant === 'generic'
        ? (<table className="tt-rp-mtable tt-rp-mtable--time-brief tt-rp-mtable--skeleton">
              <thead>
                <tr>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--employee-head tt-rp-brief-th">
                    <Bar className="tt-rp-skel-bar--th"/>
                  </th>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--brief-date tt-rp-brief-th">
                    <Bar className="tt-rp-skel-bar--th"/>
                  </th>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--brief-time tt-rp-brief-th">
                    <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-short"/>
                  </th>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--pick tt-rp-brief-th">
                    <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-short"/>
                  </th>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--comment tt-rp-brief-th">
                    <Bar className="tt-rp-skel-bar--th"/>
                  </th>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--num">
                    <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                  </th>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--num">
                    <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                  </th>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--sum">
                    <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                  </th>
                  <th className="tt-rp-mtable__th tt-rp-mtable__th--brief-actions tt-rp-brief-th">
                    <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-tiny"/>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (<RowCells key={i}>
                    <td className="tt-rp-mtable__td">
                      <Bar className="tt-rp-skel-bar--cell"/>
                    </td>
                    <td className="tt-rp-mtable__td tt-rp-mtable__td--brief-date">
                      <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-mid"/>
                    </td>
                    <td className="tt-rp-mtable__td tt-rp-mtable__td--brief-time">
                      <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                    </td>
                    <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                      <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-tall"/>
                    </td>
                    <td className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                      <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-comment"/>
                    </td>
                    <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                      <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                    </td>
                    <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                      <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                    </td>
                    <td className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--sum-ro">
                      <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num-wide"/>
                    </td>
                    <td className="tt-rp-mtable__td tt-rp-mtable__td--brief-actions">
                      <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-select"/>
                    </td>
                  </RowCells>))}
              </tbody>
              <tfoot>
                <tr className="tt-rp-mtable__foot">
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--foot-label">
                    <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-foot"/>
                  </td>
                  <td className="tt-rp-mtable__td" aria-hidden/>
                  <td className="tt-rp-mtable__td" aria-hidden/>
                  <td className="tt-rp-mtable__td" aria-hidden/>
                  <td className="tt-rp-mtable__td" aria-hidden/>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot">
                    <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot">
                    <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot">
                    <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num-wide"/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--brief-actions" aria-hidden/>
                </tr>
              </tfoot>
            </table>)
        : variant === 'expenses'
            ? (<table className="tt-rp-mtable tt-rp-mtable--skeleton">
                <thead>
                  <tr>
                    <th className="tt-rp-mtable__th tt-rp-mtable__th--rn">
                      <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-narrow"/>
                    </th>
                    <th className="tt-rp-mtable__th">
                      <Bar className="tt-rp-skel-bar--th"/>
                    </th>
                    <th className="tt-rp-mtable__th tt-rp-mtable__th--pick">
                      <Bar className="tt-rp-skel-bar--th"/>
                    </th>
                    <th className="tt-rp-mtable__th tt-rp-mtable__th--comment">
                      <Bar className="tt-rp-skel-bar--th"/>
                    </th>
                    <th className="tt-rp-mtable__th tt-rp-mtable__th--num">
                      <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                    </th>
                    <th className="tt-rp-mtable__th tt-rp-mtable__th--num">
                      <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (<RowCells key={i}>
                      <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">
                        <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-center"/>
                      </td>
                      <td className="tt-rp-mtable__td">
                        <Bar className="tt-rp-skel-bar--cell"/>
                      </td>
                      <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                        <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-mid"/>
                      </td>
                      <td className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                        <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-comment"/>
                      </td>
                      <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                        <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                      </td>
                      <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                        <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                      </td>
                    </RowCells>))}
                </tbody>
              </table>)
            : variant === 'uninvoiced'
                ? (<table className="tt-rp-mtable tt-rp-mtable--skeleton">
                    <thead>
                      <tr>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--rn">
                          <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-narrow"/>
                        </th>
                        <th className="tt-rp-mtable__th">
                          <Bar className="tt-rp-skel-bar--th"/>
                        </th>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--pick">
                          <Bar className="tt-rp-skel-bar--th"/>
                        </th>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--comment">
                          <Bar className="tt-rp-skel-bar--th"/>
                        </th>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--num">
                          <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                        </th>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--num">
                          <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((i) => (<RowCells key={i}>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-center"/>
                          </td>
                          <td className="tt-rp-mtable__td">
                            <Bar className="tt-rp-skel-bar--cell"/>
                          </td>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-tall"/>
                          </td>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-comment"/>
                          </td>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                          </td>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                          </td>
                        </RowCells>))}
                    </tbody>
                  </table>)
                : (<table className="tt-rp-mtable tt-rp-mtable--skeleton">
                    <thead>
                      <tr>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--rn">
                          <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-narrow"/>
                        </th>
                        <th className="tt-rp-mtable__th">
                          <Bar className="tt-rp-skel-bar--th"/>
                        </th>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--pick">
                          <Bar className="tt-rp-skel-bar--th"/>
                        </th>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--num">
                          <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                        </th>
                        <th className="tt-rp-mtable__th tt-rp-mtable__th--num">
                          <Bar className="tt-rp-skel-bar--th tt-rp-skel-bar--th-num"/>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((i) => (<RowCells key={i}>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-center"/>
                          </td>
                          <td className="tt-rp-mtable__td">
                            <Bar className="tt-rp-skel-bar--cell"/>
                          </td>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-tall"/>
                          </td>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                          </td>
                          <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                            <Bar className="tt-rp-skel-bar--cell tt-rp-skel-bar--cell-num"/>
                          </td>
                        </RowCells>))}
                    </tbody>
                  </table>)}
        </div>
      </div>
    </div>);
}
