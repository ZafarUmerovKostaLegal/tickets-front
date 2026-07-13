import { useI18n } from '@shared/i18n';

type Props = {
    onExportCsv: () => void;
    onExportExcel: () => void;
    onExportPdf: () => void;
    disabled?: boolean;
};

export function StatisticsExportBar({ onExportCsv, onExportExcel, onExportPdf, disabled }: Props) {
    const { t } = useI18n();
    const base = 'timeTrackingPage.statistics.export';

    return (
        <div className="tt-statistics__export" role="group" aria-label={t(`${base}.aria`)}>
            <button
                type="button"
                className="tt-statistics__export-btn"
                onClick={onExportCsv}
                disabled={disabled}
            >
                {t(`${base}.csv`)}
            </button>
            <button
                type="button"
                className="tt-statistics__export-btn"
                onClick={onExportExcel}
                disabled={disabled}
            >
                {t(`${base}.excel`)}
            </button>
            <button
                type="button"
                className="tt-statistics__export-btn tt-statistics__export-btn--outline"
                onClick={onExportPdf}
                disabled={disabled}
            >
                {t(`${base}.pdf`)}
            </button>
        </div>
    );
}
