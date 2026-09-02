import type { VacationLeaveRequestApi } from '@entities/vacation';
import { buildVacationLeaveApplicationCopy } from '../lib/vacationLeaveApplicationCopy';
import './VacationLeaveApplicationLetter.css';

export function VacationLeaveApplicationLetter({ request }: { request: VacationLeaveRequestApi }) {
    const copy = buildVacationLeaveApplicationCopy(request);
    return (
        <article className="vac-leave-letter" aria-label="Заявление на отпуск">
            <div className="vac-leave-letter__addr">
                <p className="vac-leave-letter__addr-row">
                    <span className="vac-leave-letter__k">КОМУ:</span>
                    <span className="vac-leave-letter__v">{copy.addressee}</span>
                </p>
                <p className="vac-leave-letter__addr-row">
                    <span className="vac-leave-letter__k">ОТ:</span>
                    <span className="vac-leave-letter__field">{copy.fromLine}</span>
                </p>
            </div>

            <p className="vac-leave-letter__date">
                <span className="vac-leave-letter__field">{copy.dateLine}</span>
            </p>

            <header className="vac-leave-letter__head">
                <h1 className="vac-leave-letter__title">{copy.title}</h1>
                <p className="vac-leave-letter__subtitle">{copy.subtitle}</p>
            </header>

            <p className="vac-leave-letter__body">
                {copy.bodyBeforeDays}{' '}
                <span className="vac-leave-letter__field">{copy.daysCount}</span>
                {' '}{copy.bodyBetweenDaysAndFrom}{' '}
                <span className="vac-leave-letter__field">{copy.dateFrom}</span>
                {' '}{copy.bodyBetweenDates}{' '}
                <span className="vac-leave-letter__field">{copy.dateTo}</span>
                {' '}{copy.bodyAfterTo}
            </p>

            <footer className="vac-leave-letter__sign">
                <span className="vac-leave-letter__sign-line" aria-hidden />
                <span className="vac-leave-letter__field">{copy.signerLine}</span>
            </footer>
        </article>
    );
}
