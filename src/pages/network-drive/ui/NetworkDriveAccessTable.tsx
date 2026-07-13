import type { NetDriveAccessRuleDraft } from '@entities/network-drive';

const RIGHTS_LABEL: Record<NetDriveAccessRuleDraft['rights'], string> = {
    Read: 'Чтение',
    Change: 'Изменение',
    Full: 'Полный доступ',
};

type Props = {
    rules: NetDriveAccessRuleDraft[];
    formPath: string;
    onFormPathChange: (v: string) => void;
    formPrincipal: string;
    onFormPrincipalChange: (v: string) => void;
    formRights: NetDriveAccessRuleDraft['rights'];
    onFormRightsChange: (v: NetDriveAccessRuleDraft['rights']) => void;
    onAdd: () => void;
    onRemove: (id: string) => void;
    
  credentialsReady: boolean;
};

export function NetworkDriveAccessTable(p: Props) {
    return (<div className="ndrive__card">
      <span className="ndrive__badge">Доступ</span>
      <h2 className="ndrive__card-title">Правила (черновик)</h2>
      <p className="ndrive__note" style={{ marginTop: 0 }}>
        Локальные пометки по путям и субъектам; привязка к реальным ACL на сервере будет при подключении бэкенда
        (PowerShell / SetACL / API). Сейчас список хранится только в этом браузере.
      </p>
      <div className="ndrive__form-grid ndrive__form-grid--3">
        <label className="ndrive__field">
          <span className="ndrive__label">Путь (от корня share)</span>
          <input className="ndrive__input" value={p.formPath} onChange={(e) => p.onFormPathChange(e.target.value)} disabled={!p.credentialsReady} placeholder="например, \Отдел" aria-label="Относительный путь"/>
        </label>
        <label className="ndrive__field">
          <span className="ndrive__label">Пользователь или группа</span>
          <input className="ndrive__input" value={p.formPrincipal} onChange={(e) => p.onFormPrincipalChange(e.target.value)} disabled={!p.credentialsReady} placeholder="DOMAIN\Group" aria-label="Учётная запись"/>
        </label>
        <label className="ndrive__field">
          <span className="ndrive__label">Права (план)</span>
          <select className="ndrive__input" value={p.formRights} onChange={(e) => p.onFormRightsChange(e.target.value as NetDriveAccessRuleDraft['rights'])} disabled={!p.credentialsReady} aria-label="Права">
            {(['Read', 'Change', 'Full'] as const).map((k) => (<option key={k} value={k}>{RIGHTS_LABEL[k]}</option>))}
          </select>
        </label>
      </div>
      <div className="ndrive__actions">
        <button type="button" className="ndrive__btn ndrive__btn--primary" onClick={p.onAdd} disabled={!p.credentialsReady || p.formPath.trim() === '' || p.formPrincipal.trim() === ''}>
          Добавить в список
        </button>
      </div>
      {!p.credentialsReady && (<p className="ndrive__hint">Сначала сохраните путь и логин в блоке «Подключение».</p>)}
      {p.rules.length > 0 && (<div className="ndrive__table-wrap" role="region" aria-label="Черновик правил">
          <table className="ndrive__table">
            <thead>
              <tr>
                <th scope="col">Путь</th>
                <th scope="col">Субъект</th>
                <th scope="col">Права</th>
                <th scope="col"/>
              </tr>
            </thead>
            <tbody>
              {p.rules.map((r) => (<tr key={r.id}>
                  <td><code className="ndrive__td-code">{r.path}</code></td>
                  <td>{r.principal}</td>
                  <td>{RIGHTS_LABEL[r.rights]}</td>
                  <td>
                    <button type="button" className="ndrive__btn ndrive__btn--ghost" onClick={() => p.onRemove(r.id)} aria-label="Удалить строку">Удалить</button>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>);
}
