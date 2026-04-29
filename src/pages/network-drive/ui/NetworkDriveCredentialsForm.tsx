import { DEFAULT_GRPDATA_UNC } from '@entities/network-drive';

type Props = {
    unc: string;
    onUncChange: (v: string) => void;
    username: string;
    onUsernameChange: (v: string) => void;
    password: string;
    onPasswordChange: (v: string) => void;
    rememberSessionPassword: boolean;
    onRememberSessionPasswordChange: (v: boolean) => void;
    onSave: () => void;
    onClear: () => void;
    hasSaved: boolean;
    lastSavedAt: string | null;
    
    variant?: 'page' | 'modal';
    
    onRequestClose?: () => void;
};

export function NetworkDriveCredentialsForm(p: Props) {
    const variant = p.variant ?? 'page';
    const isModal = variant === 'modal';

    const inner = (
        <>
            {!isModal && <span className="ndrive__badge">Подключение</span>}
            {!isModal && <h2 className="ndrive__card-title">Учётные данные к ресурсу</h2>}
            {!isModal && (
                <p className="ndrive__note" style={{ marginTop: 0 }}>
                    Пароль не сохраняется на диск; при включённой опции ниже — только в памяти вкладки до закрытия
                    браузера. Логин и путь (UNC) можно сохранить локально в этом браузере.
                </p>
            )}
            {isModal && <p className="ndrive-credmodal__lede">Пароль в файлы не пишется; путь и логин — по желанию в браузере.</p>}
            <div className={isModal ? 'ndrive-credmodal__grid' : 'ndrive__form-grid'}>
        <label className="ndrive__field">
          <span className="ndrive__label">UNC-путь</span>
          <input className="ndrive__input" value={p.unc} onChange={(e) => p.onUncChange(e.target.value)} autoComplete="off" spellCheck={false} placeholder={DEFAULT_GRPDATA_UNC} aria-label="UNC-путь к ресурсу"/>
        </label>
        <label className="ndrive__field">
          <span className="ndrive__label">Имя пользователя</span>
          <input className="ndrive__input" value={p.username} onChange={(e) => p.onUsernameChange(e.target.value)} autoComplete="username" placeholder="например, DOMAIN\user" aria-label="Имя пользователя для сети"/>
        </label>
        <label className="ndrive__field">
          <span className="ndrive__label">Пароль</span>
          <input className="ndrive__input" type="password" value={p.password} onChange={(e) => p.onPasswordChange(e.target.value)} autoComplete="new-password" placeholder="введите при необходимости" aria-label="Пароль"/>
        </label>
      </div>
      <label className="ndrive__check">
        <input type="checkbox" checked={p.rememberSessionPassword} onChange={(e) => p.onRememberSessionPasswordChange(e.target.checked)}/>
        <span>Запомнить пароль до закрытия вкладки (session storage)</span>
      </label>
            <div className="ndrive__actions" style={isModal ? { marginTop: '0.75rem' } : undefined}>
                <button
                    type="button"
                    className="ndrive__btn ndrive__btn--primary"
                    onClick={p.onSave}
                    disabled={p.unc.trim() === '' || p.username.trim() === ''}
                >
                    Сохранить путь и логин
                </button>
                <button type="button" className="ndrive__btn" onClick={p.onClear}>
                    Сбросить сохранённое
                </button>
                {isModal && p.onRequestClose && (
                    <button type="button" className="ndrive__btn" onClick={p.onRequestClose}>
                        Готово
                    </button>
                )}
            </div>
            {p.hasSaved && (
                <p className="ndrive__hint ndrive__hint--ok" role="status">
                    Сохранено{p.lastSavedAt != null ? ` — ${new Date(p.lastSavedAt).toLocaleString()}` : ''}
                </p>
            )}
        </>
    );

    if (isModal) {
        return <div className="ndrive-credmodal__form">{inner}</div>;
    }
    return <div className="ndrive__card">{inner}</div>;
}
