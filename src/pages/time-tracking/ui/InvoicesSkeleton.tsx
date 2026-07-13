const SKEL_SUMMARY_MODS = ['', 'tt-inv__summary-card--accent', '', 'tt-inv__summary-card--success', 'tt-inv__summary-card--muted'] as const;
const SKEL_ROWS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export function InvoicesSkeleton() {
    return (<div className="tt-inv tt-inv--skeleton" aria-hidden="true">
      <div className="tt-reports__type-block">
        <span className="tt-inv-skel tt-inv-skel--type-title"/>
        <div className="tt-inv__head-row">
          <div className="tt-inv__skel-lede">
            <span className="tt-inv-skel tt-inv-skel--lede tt-inv-skel--lede-line1"/>
            <span className="tt-inv-skel tt-inv-skel--lede tt-inv-skel--lede-line2"/>
          </div>
          <span className="tt-inv-skel tt-inv-skel--btn"/>
        </div>
      </div>

      <div className="tt-reports__summary">
        {SKEL_SUMMARY_MODS.map((mod, i) => (<div key={i} className={mod ? `tt-reports__summary-card ${mod}` : 'tt-reports__summary-card'}>
            <span className="tt-inv-skel tt-inv-skel--kpi-label"/>
            <span className="tt-inv-skel tt-inv-skel--kpi-val"/>
          </div>))}
      </div>

      <div className="tt-reports__content">
        <div className="tt-reports__content-header tt-inv__filter-header">
          <div className="tt-reports__breakdown-bar-wrap">
            <span className="tt-inv-skel tt-inv-skel--break-label"/>
            <span className="tt-inv-skel tt-inv-skel--break-hint"/>
          </div>
          <div className="tt-reports__content-actions tt-inv__filter-actions">
            <div className="tt-reports__sort-wrap">
              <span className="tt-inv-skel tt-inv-skel--sort-label"/>
              <span className="tt-inv-skel tt-inv-skel--dd"/>
            </div>
            <div className="tt-reports__sort-wrap">
              <span className="tt-inv-skel tt-inv-skel--sort-label"/>
              <span className="tt-inv-skel tt-inv-skel--dd tt-inv-skel--dd-narrow"/>
            </div>
            <span className="tt-inv-skel tt-inv-skel--refresh"/>
          </div>
        </div>

        <div className="tt-reports__table-wrap tt-inv__table-outer">
          <div className="tt-inv__table-scroll tt-inv__table-scroll--skel">
            <table className="tt-reports__table tt-inv__data-table tt-inv__table--skeleton">
              <colgroup>
                <col className="tt-inv__skel-col tt-inv__skel-col--num"/>
                <col className="tt-inv__skel-col tt-inv__skel-col--client"/>
                <col className="tt-inv__skel-col tt-inv__skel-col--date"/>
                <col className="tt-inv__skel-col tt-inv__skel-col--date"/>
                <col className="tt-inv__skel-col tt-inv__skel-col--money"/>
                <col className="tt-inv__skel-col tt-inv__skel-col--money"/>
                <col className="tt-inv__skel-col tt-inv__skel-col--status"/>
                <col className="tt-inv__skel-col tt-inv__skel-col--action"/>
              </colgroup>
              <thead>
                <tr>
                  <th scope="col"><span className="tt-inv-skel tt-inv-skel--th"/></th>
                  <th scope="col"><span className="tt-inv-skel tt-inv-skel--th"/></th>
                  <th scope="col"><span className="tt-inv-skel tt-inv-skel--th"/></th>
                  <th scope="col"><span className="tt-inv-skel tt-inv-skel--th"/></th>
                  <th scope="col" className="tt-inv__th-num"><span className="tt-inv-skel tt-inv-skel--th tt-inv-skel--th-num"/></th>
                  <th scope="col" className="tt-inv__th-num"><span className="tt-inv-skel tt-inv-skel--th tt-inv-skel--th-num"/></th>
                  <th scope="col"><span className="tt-inv-skel tt-inv-skel--th"/></th>
                  <th scope="col" className="tt-inv__th-action" aria-hidden><span className="tt-inv-skel tt-inv-skel--th-ico"/></th>
                </tr>
              </thead>
              <tbody>
                {SKEL_ROWS.map((i) => (<tr key={i}>
                    <td><span className="tt-inv-skel tt-inv-skel--td-num-strong"/></td>
                    <td><span className="tt-inv-skel tt-inv-skel--td-client"/></td>
                    <td><span className="tt-inv-skel tt-inv-skel--td-date"/></td>
                    <td><span className="tt-inv-skel tt-inv-skel--td-date"/></td>
                    <td className="tt-inv__td-num"><span className="tt-inv-skel tt-inv-skel--td-money"/></td>
                    <td className="tt-inv__td-num"><span className="tt-inv-skel tt-inv-skel--td-money"/></td>
                    <td><span className="tt-inv-skel tt-inv-skel--td-status"/></td>
                    <td className="tt-inv__td-action" aria-hidden><span className="tt-inv-skel tt-inv-skel--td-chev"/></td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>);
}
