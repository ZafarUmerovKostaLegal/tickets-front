import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import {} from 'react';
import { Navigate } from 'react-router-dom';
import { isTauri } from '@tauri-apps/api/core';
import { routes } from '@shared/config';
export function DesktopOnlyRoute({ children }) {
    if (!isTauri()) {
        return _jsx(Navigate, { to: routes.home, replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
