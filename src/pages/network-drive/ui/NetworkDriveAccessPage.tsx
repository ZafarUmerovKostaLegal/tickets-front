import { useState } from 'react';
import { isNetDriveConfigReady } from '@entities/network-drive';
import { AppBackButton, AppPageSettings } from '@shared/ui';
import { useNetDrivePageState } from '../model/useNetDrivePageState';
import { NetworkDriveCredentialsModal } from './NetworkDriveCredentialsModal';
import { NetworkDriveExplorer } from './NetworkDriveExplorer';
import './NetworkDriveAccessPage.css';

export function NetworkDriveAccessPage() {
    const s = useNetDrivePageState();
    const showSaved = s.settings != null && isNetDriveConfigReady(s.settings);
    const [credOpen, setCredOpen] = useState(false);

    return (
        <div className="ndrive">
            <main className="ndrive__main">
                <header className="ndrive__header">
                    <div className="ndrive__header-inner">
                        <div className="ndrive__header-start">
                            <AppBackButton className="app-back-btn" />
                            <h1 className="ndrive__title ndrive__title--compact">Сетевой диск</h1>
                        </div>
                        <div className="ndrive__header-end">
                            <button
                                type="button"
                                className="ndrive__btn ndrive__btn--ghost"
                                onClick={() => setCredOpen(true)}
                            >
                                Учётные данные
                            </button>
                            <div className="app-page-header-end">
                                <AppPageSettings />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="ndrive__content ndrive__content--fs">
                    <div className="ndrive__fs-shell">
                        <NetworkDriveExplorer
                            unc={s.unc}
                            username={s.username}
                            password={s.password}
                        />
                    </div>
                </div>
            </main>

            <NetworkDriveCredentialsModal
                open={credOpen}
                onClose={() => setCredOpen(false)}
                unc={s.unc}
                onUncChange={s.setUnc}
                username={s.username}
                onUsernameChange={s.setUsername}
                password={s.password}
                onPasswordChange={s.setPassword}
                rememberSessionPassword={s.rememberSessionPassword}
                onRememberSessionPasswordChange={s.setRememberSessionPassword}
                onSave={s.saveCredentials}
                onClear={s.clearAllSaved}
                hasSaved={showSaved}
                lastSavedAt={s.settings?.updatedAt ?? null}
            />
        </div>
    );
}
