export type StatisticsDailyPoint = {
    idx: number;
    date: string;
    dateLabel: string;
    primary: number;
    secondary: number;
    total?: number;
};

export type StackedBarRow = {
    id?: string;
    name: string;
    primary: number;
    secondary: number;
};

export type PieSlice = { name: string; value: number; color: string; hours?: number };

export type MultiLinePoint = {
    idx: number;
    primary: number;
    secondary: number;
    tertiary: number;
};

export type DateLinePoint = {
    dateLabel: string;
    value: number;
    billable?: number;
    nonBillable?: number;
};

export type SimpleLinePoint = {
    idx: number;
    value: number;
};
