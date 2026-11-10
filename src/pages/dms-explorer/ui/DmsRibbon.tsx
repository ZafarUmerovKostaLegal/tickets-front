import { Icon, type IconName } from '@pages/file-manager/ui/fmShared';

export type DmsMode = 'browse' | 'favorites' | 'recent' | 'search';

type RibbonAction = {
    id: string;
    label: string;
    icon: IconName;
    disabled?: boolean;
    active?: boolean;
    onClick: () => void;
};

type Group = { title: string; actions: RibbonAction[] };

type Props = {
    mode: DmsMode;
    groups: Group[];
    onMode: (mode: DmsMode) => void;
};

export function DmsRibbon({ mode, groups, onMode }: Props) {
    const modes: Array<{ id: DmsMode; label: string; icon: IconName }> = [
        { id: 'browse', label: 'Browse', icon: 'folder' },
        { id: 'favorites', label: 'Favorites', icon: 'star' },
        { id: 'recent', label: 'Recent', icon: 'clock' },
        { id: 'search', label: 'Search', icon: 'search' },
    ];
    return (
        <div className="dms-ribbon">
            <div className="dms-ribbon__tabs">
                <button type="button" className="dms-ribbon__tab is-on">Home</button>
            </div>
            <div className="dms-ribbon__body">
                <section className="dms-ribbon__group">
                    <div className="dms-ribbon__actions">
                        {modes.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={mode === item.id ? 'dms-ribbon__btn is-on' : 'dms-ribbon__btn'}
                                onClick={() => onMode(item.id)}
                            >
                                <Icon name={item.icon} />
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="dms-ribbon__group-title">Mode</div>
                </section>
                {groups.map((group) => (
                    <section key={group.title} className="dms-ribbon__group">
                        <div className="dms-ribbon__actions">
                            {group.actions.map((action) => (
                                <button
                                    key={action.id}
                                    type="button"
                                    className={action.active ? 'dms-ribbon__btn is-on' : 'dms-ribbon__btn'}
                                    disabled={action.disabled}
                                    onClick={action.onClick}
                                >
                                    <Icon name={action.icon} />
                                    {action.label}
                                </button>
                            ))}
                        </div>
                        <div className="dms-ribbon__group-title">{group.title}</div>
                    </section>
                ))}
            </div>
        </div>
    );
}
