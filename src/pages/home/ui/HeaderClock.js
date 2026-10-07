import { jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, memo } from 'react';
import { formatClockDate } from '@shared/lib/formatDate';
export const HeaderClock = memo(function HeaderClock() {
    const [currentTime, setCurrentTime] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (_jsxs("p", { className: "home-page__header-sub", children: [formatClockDate(currentTime), " \u00B7 ", currentTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })] }));
});
