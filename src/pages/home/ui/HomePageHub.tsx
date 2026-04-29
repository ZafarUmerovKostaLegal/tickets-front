import { HomeNavTiles } from './HomeNavTiles';
import { AppPageSettings } from '@shared/ui';
import './HomePage.css';

export function HomePageHub() {
    return (<div className="home-page home-page--tile-nav home-page--hub">
      <main className="home-page__main home-page__main--hub">
        <header className="home-page__header home-page__header--hub">
          <div className="home-page__header-left">
            <span className="home-page__header-eyebrow">Тикет-система</span>
            <h1 className="home-page__header-h1">Главная</h1>
          </div>
          <div className="home-page__header-right home-page__header-right--hub">
            <AppPageSettings showUserMenu />
          </div>
        </header>
        <div className="home-page__main-inner home-page__main-inner--hub">
          <HomeNavTiles />
        </div>
      </main>
    </div>);
}
