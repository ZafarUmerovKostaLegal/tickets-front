import type { VacationLeaveRequestApi } from '@entities/vacation';
import { buildVacationLeaveApplicationCopy } from '../lib/vacationLeaveApplicationCopy';
import './VacationLeaveApplicationLetter.css';

export function VacationLeaveApplicationLetter({ request }: { request: VacationLeaveRequestApi }) {
    const copy = buildVacationLeaveApplicationCopy(request);
    return (
        <article className="vac-leave-letter" aria-label="Заявление">
            <div className="vac-leave-letter__addr">
                <span className="vac-leave-letter__k">КОМУ:</span>
                <span className="vac-leave-letter__v">
                    {copy.addresseeOrg}
                    <br />
                    {copy.addresseeName}
                </span>
                <span className="vac-leave-letter__k">ОТ:</span>
                <span className="vac-leave-letter__v">{copy.fromLine}</span>
            </div>

            <p className="vac-leave-letter__date">
                <span className="vac-leave-letter__field">{copy.dateLine}</span>
            </p>

            <header className="vac-leave-letter__head">
                <h1 className={`vac-leave-letter__title${copy.subtitle ? '' : ' vac-leave-letter__title--long'}`}>{copy.title}</h1>
                {copy.subtitle ? <p className="vac-leave-letter__subtitle">{copy.subtitle}</p> : null}
            </header>

            <p className="vac-leave-letter__body">
                {copy.bodyParts.map((part, i) => (
                    part.type === 'field'
                        ? <span key={i} className="vac-leave-letter__field">{part.text}</span>
                        : <span key={i}>{part.text}</span>
                ))}
            </p>

            <footer className="vac-leave-letter__sign">
                <span className="vac-leave-letter__sign-line" aria-hidden />
                <span className="vac-leave-letter__field">{copy.signerLine}</span>
            </footer>
        </article>
    );
}
