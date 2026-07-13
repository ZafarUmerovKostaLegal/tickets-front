function Skel({ className = '' }: { className?: string }) {
    return <span className={`kd-tg-skel ${className}`.trim()} aria-hidden />;
}

export function KostaDailyChatListSkeleton({ rows = 7 }: { rows?: number }) {
    return (
      <ul className="kd-tg-skel-list kd-tg-skel-list--chats" role="list" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="kd-tg-skel-chat-row" role="listitem">
            <Skel className="kd-tg-skel--circle kd-tg-skel--avatar-lg" />
            <span className="kd-tg-skel-chat-row__body">
              <span className="kd-tg-skel-chat-row__top">
                <Skel className="kd-tg-skel--title" />
                <Skel className="kd-tg-skel--time" />
              </span>
              <span className="kd-tg-skel-chat-row__bottom">
                <Skel className="kd-tg-skel--preview" />
                {i < 2 ? <Skel className="kd-tg-skel--badge" /> : null}
              </span>
            </span>
          </li>
        ))}
      </ul>
    );
}

export function KostaDailyMembersSkeleton({ rows = 10 }: { rows?: number }) {
    return (
      <ul className="kd-tg-skel-list kd-tg-skel-list--members" role="list" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="kd-tg-skel-member-row" role="listitem">
            <Skel className="kd-tg-skel--circle kd-tg-skel--avatar-md" />
            <span className="kd-tg-skel-member-row__body">
              <Skel className="kd-tg-skel--name" />
              <Skel className="kd-tg-skel--meta" />
              <Skel className="kd-tg-skel--email" />
            </span>
          </li>
        ))}
      </ul>
    );
}

export function KostaDailyChatPaneSkeleton() {
    return (
      <div className="kd-tg-skel-pane" aria-hidden>
        <header className="kd-tg-skel-pane__head">
          <Skel className="kd-tg-skel--circle kd-tg-skel--avatar-sm" />
          <span className="kd-tg-skel-pane__head-text">
            <Skel className="kd-tg-skel--head-title" />
            <Skel className="kd-tg-skel--head-sub" />
          </span>
          <span className="kd-tg-skel-pane__head-actions">
            <Skel className="kd-tg-skel--icon" />
            <Skel className="kd-tg-skel--icon" />
          </span>
        </header>

        <div className="kd-tg-skel-pane__messages">
          <div className="kd-tg-skel-date">
            <Skel className="kd-tg-skel--date-pill" />
          </div>

          <div className="kd-tg-skel-msg kd-tg-skel-msg--in">
            <Skel className="kd-tg-skel--circle kd-tg-skel--avatar-xs" />
            <span className="kd-tg-skel-bubble kd-tg-skel-bubble--in">
              <Skel className="kd-tg-skel--name-inline" />
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w90" />
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w70" />
            </span>
          </div>

          <div className="kd-tg-skel-msg kd-tg-skel-msg--in kd-tg-skel-msg--grouped">
            <span className="kd-tg-skel-msg__avatar-slot" />
            <span className="kd-tg-skel-bubble kd-tg-skel-bubble--in kd-tg-skel-bubble--short">
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w55" />
            </span>
          </div>

          <div className="kd-tg-skel-msg kd-tg-skel-msg--in">
            <Skel className="kd-tg-skel--circle kd-tg-skel--avatar-xs" />
            <span className="kd-tg-skel-bubble kd-tg-skel-bubble--in">
              <Skel className="kd-tg-skel--name-inline" />
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w80" />
            </span>
          </div>

          <div className="kd-tg-skel-msg kd-tg-skel-msg--out">
            <span className="kd-tg-skel-bubble kd-tg-skel-bubble--out">
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w75" />
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w45" />
            </span>
          </div>

          <div className="kd-tg-skel-msg kd-tg-skel-msg--out kd-tg-skel-msg--grouped">
            <span className="kd-tg-skel-bubble kd-tg-skel-bubble--out kd-tg-skel-bubble--short">
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w60" />
            </span>
          </div>

          <div className="kd-tg-skel-msg kd-tg-skel-msg--in">
            <Skel className="kd-tg-skel--circle kd-tg-skel--avatar-xs" />
            <span className="kd-tg-skel-bubble kd-tg-skel-bubble--in">
              <Skel className="kd-tg-skel--name-inline" />
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w95" />
              <Skel className="kd-tg-skel--line kd-tg-skel--line-w65" />
            </span>
          </div>
        </div>

        <footer className="kd-tg-skel-pane__composer">
          <Skel className="kd-tg-skel--composer-bar" />
        </footer>
      </div>
    );
}
