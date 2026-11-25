import { useEffect, useState } from 'react';
import { filesApi } from '../api/filesApi';
import { parseTemplate } from '../lib/filesFormat';
import { Icon, StateBlock, useAction, useFm, useLoad } from './fmShared';

export function TemplateView() {
    const { tr } = useFm();
    const act = useAction();
    const load = useLoad(() => filesApi.template(), []);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (load.data)
            setText(load.data.folders.join('\n'));
    }, [load.data]);

    const folders = parseTemplate(text);
    const canEdit = load.data?.canEdit ?? false;

    return (
        <section className="fm-docs fm-docs--padded">
            <p className="fm-hint">{tr('template.hint')}</p>
            <StateBlock loading={load.loading && !load.data} error={load.error} onRetry={load.reload}>
                <div className="fm-template">
                    <textarea rows={14} value={text} disabled={!canEdit || busy} placeholder={tr('template.placeholder')}
                        onChange={(event) => setText(event.target.value)} />
                    <div className="fm-template__preview">
                        <ul>
                            {folders.map((path) => {
                                const parts = path.split('/');
                                return (
                                    <li key={path} style={{ paddingLeft: `${(parts.length - 1) * 1.1}rem` }}>
                                        <Icon name="folder" className="fm-ico--folder" />{parts[parts.length - 1]}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
                {canEdit ? (
                    <div className="fm-toolbar">
                        <button type="button" className="fm-btn fm-btn--primary" disabled={busy} onClick={async () => {
                            setBusy(true);
                            const result = await act(() => filesApi.saveTemplate(folders), tr('template.saved'));
                            setBusy(false);
                            if (result)
                                setText(result.folders.join('\n'));
                        }}>{tr('common.save')}</button>
                        <button type="button" className="fm-btn" disabled={busy} onClick={async () => {
                            setBusy(true);
                            const result = await act(() => filesApi.resetTemplate(), tr('template.saved'));
                            setBusy(false);
                            if (result)
                                setText(result.folders.join('\n'));
                        }}>{tr('template.reset')}</button>
                    </div>
                ) : <p className="fm-muted">{tr('template.readOnly')}</p>}
            </StateBlock>
        </section>
    );
}
