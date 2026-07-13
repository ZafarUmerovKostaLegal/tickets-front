import { useInventory } from '../model';
const kpiCards = [
    {
        key: 'total',
        label: 'Всего',
        sub: 'позиций в выборке',
        color: 'blue',
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 9h6v6H9z"/>
      </svg>),
    },
    {
        key: 'use',
        label: 'В использовании',
        sub: 'выдано сотрудникам',
        color: 'green',
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>),
    },
    {
        key: 'stock',
        label: 'На складе',
        sub: 'готово к выдаче',
        color: 'cyan',
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8"/>
        <rect x="1" y="3" width="22" height="5"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>),
    },
    {
        key: 'arch',
        label: 'Архив',
        sub: 'списано / не активно',
        color: 'gray',
        icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1"/>
        <path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>
        <path d="M10 12h4"/>
      </svg>),
    },
];
export function InventoryKPISection() {
    const { totalItems, inUseCount, inStockCount, archivedCount, loadingItems } = useInventory();
    const values = {
        total: totalItems,
        use: inUseCount,
        stock: inStockCount,
        arch: archivedCount,
    };
    return (<section className="inv__kpi">
      {kpiCards.map((c) => (<div key={c.key} className={`inv__kpi-card inv__kpi-card--${c.color}`}>
          <div className="inv__kpi-icon">{c.icon}</div>
          {loadingItems ? (<div className="inv__kpi-skel">
              <span />
              <span />
            </div>) : (<>
              <span className="inv__kpi-value">{values[c.key as keyof typeof values]}</span>
              <span className="inv__kpi-label">{c.label}</span>
              <span className="inv__kpi-sub">{c.sub}</span>
            </>)}
        </div>))}
    </section>);
}
