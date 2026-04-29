const ROW_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const;
export function TimeTrackingClientsListSkeleton() {
    return (<>
      <span className="tt-clients-skel__sr-only" role="status">
        Загрузка клиентов…
      </span>
      {ROW_KEYS.map((key) => (<div key={key} className="tt-settings__list-row tt-settings__list-row--client tt-clients-skel__row">
          <div className="tt-settings__client-block">
            <span className="tt-clients-skel__name"/>
            <span className="tt-clients-skel__line"/>
            <span className="tt-clients-skel__line tt-clients-skel__line--meta"/>
          </div>
          <div className="tt-settings__client-actions">
            <span className="tt-clients-skel__action"/>
            <span className="tt-clients-skel__action"/>
            <span className="tt-clients-skel__action tt-clients-skel__action--narrow"/>
          </div>
        </div>))}
    </>);
}
