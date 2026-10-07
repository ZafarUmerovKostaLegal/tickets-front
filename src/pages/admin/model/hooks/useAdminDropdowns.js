import { useState, useRef, useEffect } from 'react';
function isInside(el, target) {
    return !!el && !!target && el.contains(target);
}
export function useAdminDropdowns() {
    const [openRoleDropdown, setOpenRoleDropdown] = useState(null);
    const [roleMenuPos, setRoleMenuPos] = useState(null);
    const roleTriggerRef = useRef(null);
    const roleMenuRef = useRef(null);
    const [openTTDropdown, setOpenTTDropdown] = useState(null);
    const [ttMenuPos, setTTMenuPos] = useState(null);
    const ttTriggerRef = useRef(null);
    const ttMenuRef = useRef(null);
    const [openPosDropdown, setOpenPosDropdown] = useState(null);
    const [posMenuPos, setPosMenuPos] = useState(null);
    const posTriggerRef = useRef(null);
    const posMenuRef = useRef(null);
    const closePosDropdown = () => {
        setOpenPosDropdown(null);
        setPosMenuPos(null);
    };
    useEffect(() => {
        if (openRoleDropdown === null)
            return;
        const handleMouseDown = (e) => {
            const t = e.target;
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
        const handleMouseDown = (e) => {
            const t = e.target;
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
        const handleMouseDown = (e) => {
            const t = e.target;
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
