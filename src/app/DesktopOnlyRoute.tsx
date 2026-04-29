import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isTauri } from '@tauri-apps/api/core';
import { routes } from '@shared/config';


export function DesktopOnlyRoute({ children }: { children: ReactNode }) {
    if (!isTauri()) {
        return <Navigate to={routes.home} replace/>;
    }
    return <>{children}</>;
}
