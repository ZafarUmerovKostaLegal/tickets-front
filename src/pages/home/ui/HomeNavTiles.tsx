import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useCurrentUser } from '@shared/hooks';
import { routes } from '@shared/config';
import { getVisibleAppNavItems } from '@widgets/sidebar/model/appNavConfig';
import './HomeNavTiles.css';

export function HomeNavTiles() {
    const { user, loading } = useCurrentUser();
    const items = useMemo(() => getVisibleAppNavItems(user, loading).filter((i) => i.to !== routes.home), [user, loading]);
    if (items.length === 0)
        return null;
    return (<section className="home-nav-tiles home-nav-tiles--hub" aria-label="Разделы">
      <h2 className="home-nav-tiles__title">Разделы</h2>
      <ul className="home-nav-tiles__grid" role="list">
        {items.map(({ to, label, icon: Icon }) => (<li key={to} className="home-nav-tiles__item" role="listitem">
            <NavLink to={to} className={({ isActive }) => `home-nav-tiles__link${isActive ? ' active' : ''}`} end>
              <span className="home-nav-tiles__icon" aria-hidden>
                <Icon />
              </span>
              <span className="home-nav-tiles__body">
                <span className="home-nav-tiles__label">{label}</span>
                <span className="home-nav-tiles__kicker" aria-hidden>
                  Перейти
                </span>
              </span>
            </NavLink>
          </li>))}
      </ul>
    </section>);
}
