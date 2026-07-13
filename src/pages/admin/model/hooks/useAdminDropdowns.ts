import { useState, useRef, useEffect } from 'react';
type MenuPos = {
    top: number;
    left: number;
    width: number;
};
function isInside(el: HTMLElement | null, target: Node | null): boolean {
    return !!el && !!target && el.contains(target);
}
export function useAdminDropdowns() {
    const [openRoleDropdown, setOpenRoleDropdown] = useState<number | null>(null);
    const [roleMenuPos, setRoleMenuPos] = useState<MenuPos | null>(null);
    const roleTriggerRef = useRef<HTMLButtonElement | null>(null);
    const roleMenuRef = useRef<HTMLDivElement | null>(null);
    const [openTTDropdown, setOpenTTDropdown] = useState<number | null>(null);
    const [ttMenuPos, setTTMenuPos] = useState<MenuPos | null>(null);
    const ttTriggerRef = useRef<HTMLButtonElement | null>(null);
    const ttMenuRef = useRef<HTMLDivElement | null>(null);
    const [openPosDropdown, setOpenPosDropdown] = useState<number | null>(null);
    const [posMenuPos, setPosMenuPos] = useState<MenuPos | null>(null);
    const posTriggerRef = useRef<HTMLButtonElement | null>(null);
    const posMenuRef = useRef<HTMLDivElement | null>(null);
    const closePosDropdown = () => {
        setOpenPosDropdown(null);
        setPosMenuPos(null);
    };
    useEffect(() => {
        if (openRoleDropdown === null)
            return;
        const handleMouseDown = (e: MouseEvent) => {
            const t = e.target as Node | null;
            if (isInside(roleMenuRef.current, t) || isInside(roleTriggerRef.current, t))
                return;
            setOpenRoleDropdown(null);
            setRoleMenuPos(null);
        };
        const handleScroll = () => {
            setOpenRoleDropdown(null);
            setRoleMenuPos(null);
        };
        document.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [openRoleDropdown]);
    useEffect(() => {
        if (openTTDropdown === null)
            return;
        const handleMouseDown = (e: MouseEvent) => {
            const t = e.target as Node | null;
            if (isInside(ttMenuRef.current, t) || isInside(ttTriggerRef.current, t))
                return;
            setOpenTTDropdown(null);
            setTTMenuPos(null);
        };
        const handleScroll = () => {
            setOpenTTDropdown(null);
            setTTMenuPos(null);
        };
        document.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [openTTDropdown]);
    useEffect(() => {
        if (openPosDropdown === null)
            return;
        const handleMouseDown = (e: MouseEvent) => {
            const t = e.target as Node | null;
            if (isInside(posMenuRef.current, t) || isInside(posTriggerRef.current, t))
                return;
            setOpenPosDropdown(null);
            setPosMenuPos(null);
        };
        const handleScroll = () => {
            setOpenPosDropdown(null);
            setPosMenuPos(null);
        };
        document.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [openPosDropdown]);
    return {
        openRoleDropdown,
        setOpenRoleDropdown,
        roleMenuPos,
        setRoleMenuPos,
        roleTriggerRef,
        roleMenuRef,
        openTTDropdown,
        setOpenTTDropdown,
        ttMenuPos,
        setTTMenuPos,
        ttTriggerRef,
        ttMenuRef,
        openPosDropdown,
        setOpenPosDropdown,
        posMenuPos,
        setPosMenuPos,
        posTriggerRef,
        posMenuRef,
        closePosDropdown,
    };
}
