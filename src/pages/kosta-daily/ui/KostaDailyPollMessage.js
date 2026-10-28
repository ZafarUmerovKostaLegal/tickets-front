import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function KostaDailyPollMessage({ poll, onVote, onClose, canClose, }) {
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0) || poll.total_voters;
    const maxVotes = Math.max(1, ...poll.options.map((o) => o.votes));
    const isQuiz = poll.kind === 'quiz';
    const voted = poll.my_votes.length > 0;
    const showResults = poll.is_closed || voted || isQuiz;
    return (_jsxs("div", { className: `kd-tg__poll${isQuiz ? ' kd-tg__poll--quiz' : ''}`, children: [_jsxs("div", { className: "kd-tg__poll-head", children: [_jsx("span", { className: "kd-tg__poll-badge", children: isQuiz ? 'Викторина' : 'Опрос' }), poll.is_closed ? _jsx("span", { className: "kd-tg__poll-status", children: "\u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043D" }) : null] }), _jsx("p", { className: "kd-tg__poll-question", children: poll.question }), _jsx("div", { className: "kd-tg__poll-options", role: "list", children: poll.options.map((opt) => {
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
                    return (_jsxs("button", { type: "button", role: "listitem", className: [
                            'kd-tg__poll-option',
                            mine ? 'kd-tg__poll-option--mine' : '',
                            isCorrect ? 'kd-tg__poll-option--correct' : '',
                            isWrong ? 'kd-tg__poll-option--wrong' : '',
                            poll.is_closed ? 'kd-tg__poll-option--disabled' : '',
                        ].filter(Boolean).join(' '), disabled: poll.is_closed, onClick: () => onVote(opt.index), children: [showResults ? (_jsx("span", { className: "kd-tg__poll-option-bar", style: { width: `${pct}%` }, "aria-hidden": true })) : null, _jsx("span", { className: "kd-tg__poll-option-text", children: opt.text }), showResults ? (_jsx("span", { className: "kd-tg__poll-option-meta", children: opt.votes > 0 ? opt.votes : '' })) : null] }, opt.index));
                }) }), _jsxs("div", { className: "kd-tg__poll-footer", children: [_jsxs("span", { children: [totalVotes, " ", totalVotes === 1 ? 'голос' : totalVotes < 5 ? 'голоса' : 'голосов'] }), poll.allows_multiple ? _jsx("span", { children: "\u00B7 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043E\u0442\u0432\u0435\u0442\u043E\u0432" }) : null, poll.is_anonymous ? _jsx("span", { children: "\u00B7 \u0430\u043D\u043E\u043D\u0438\u043C\u043D\u043E" }) : null] }), poll.explanation && showResults ? (_jsx("p", { className: "kd-tg__poll-explanation", children: poll.explanation })) : null, canClose && !poll.is_closed && onClose ? (_jsxs("button", { type: "button", className: "kd-tg__poll-close-btn", onClick: onClose, children: ["\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C ", isQuiz ? 'викторину' : 'опрос'] })) : null] }));
}
