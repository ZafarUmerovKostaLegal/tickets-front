import type { ChatPoll } from '@entities/chat';

export type KostaDailyPollMessageProps = {
    poll: ChatPoll;
    onVote: (optionIndex: number) => void;
    onClose?: () => void;
    canClose?: boolean;
};

export function KostaDailyPollMessage({
    poll,
    onVote,
    onClose,
    canClose,
}: KostaDailyPollMessageProps) {
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0) || poll.total_voters;
    const maxVotes = Math.max(1, ...poll.options.map((o) => o.votes));
    const isQuiz = poll.kind === 'quiz';
    const voted = poll.my_votes.length > 0;
    const showResults = poll.is_closed || voted || isQuiz;

    return (
        <div className={`kd-tg__poll${isQuiz ? ' kd-tg__poll--quiz' : ''}`}>
            <div className="kd-tg__poll-head">
                <span className="kd-tg__poll-badge">{isQuiz ? 'Викторина' : 'Опрос'}</span>
                {poll.is_closed ? <span className="kd-tg__poll-status">Завершён</span> : null}
            </div>
            <p className="kd-tg__poll-question">{poll.question}</p>
            <div className="kd-tg__poll-options" role="list">
                {poll.options.map((opt) => {
                    const pct = showResults ? Math.round((opt.votes / maxVotes) * 100) : 0;
                    const mine = poll.my_votes.includes(opt.index);
                    const isCorrect = showResults
                        && poll.correct_option_index != null
                        && opt.index === poll.correct_option_index;
                    const isWrong = showResults
                        && voted
                        && mine
                        && poll.correct_option_index != null
                        && opt.index !== poll.correct_option_index;
                    return (
                        <button
                            key={opt.index}
                            type="button"
                            role="listitem"
                            className={[
                                'kd-tg__poll-option',
                                mine ? 'kd-tg__poll-option--mine' : '',
                                isCorrect ? 'kd-tg__poll-option--correct' : '',
                                isWrong ? 'kd-tg__poll-option--wrong' : '',
                                poll.is_closed ? 'kd-tg__poll-option--disabled' : '',
                            ].filter(Boolean).join(' ')}
                            disabled={poll.is_closed}
                            onClick={() => onVote(opt.index)}
                        >
                            {showResults ? (
                                <span
                                    className="kd-tg__poll-option-bar"
                                    style={{ width: `${pct}%` }}
                                    aria-hidden
                                />
                            ) : null}
                            <span className="kd-tg__poll-option-text">{opt.text}</span>
                            {showResults ? (
                                <span className="kd-tg__poll-option-meta">
                                    {opt.votes > 0 ? opt.votes : ''}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
            <div className="kd-tg__poll-footer">
                <span>{totalVotes} {totalVotes === 1 ? 'голос' : totalVotes < 5 ? 'голоса' : 'голосов'}</span>
                {poll.allows_multiple ? <span>· несколько ответов</span> : null}
                {poll.is_anonymous ? <span>· анонимно</span> : null}
            </div>
            {poll.explanation && showResults ? (
                <p className="kd-tg__poll-explanation">{poll.explanation}</p>
            ) : null}
            {canClose && !poll.is_closed && onClose ? (
                <button type="button" className="kd-tg__poll-close-btn" onClick={onClose}>
                    Завершить {isQuiz ? 'викторину' : 'опрос'}
                </button>
            ) : null}
        </div>
    );
}
