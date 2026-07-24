export type InternalExtensionEntry = {
    fullName: string;
    /** Внутренний номер (обычно 2 цифры). */
    extension: string;
};

/** Справочник внутренних номеров (статический). */
export const INTERNAL_EXTENSION_DIRECTORY: InternalExtensionEntry[] = [
    { fullName: 'Reception', extension: '11' },
    { fullName: 'Azizbek', extension: '12' },
    { fullName: 'Vazgen', extension: '13' },
    { fullName: 'Nail', extension: '14' },
    { fullName: 'Maksim', extension: '15' },
    { fullName: 'Shukhrat', extension: '16' },
    { fullName: 'Iroda', extension: '17' },
    { fullName: 'Madina', extension: '18' },
    { fullName: 'Anastasia', extension: '19' },
    { fullName: 'Aliye', extension: '20' },
    { fullName: 'Olga', extension: '21' },
    { fullName: 'Jahongir', extension: '22' },
    { fullName: 'Reception', extension: '24' },
    { fullName: 'Guzal', extension: '25' },
    { fullName: 'Alina M', extension: '26' },
    { fullName: 'Diyor', extension: '27' },
    { fullName: 'Kseniya', extension: '29' },
    { fullName: 'Ekaterina', extension: '30' },
    { fullName: 'Dilshodbek', extension: '31' },
    { fullName: 'Dilnoza', extension: '32' },
    { fullName: 'Islombek I', extension: '33' },
    { fullName: 'Islam Dj.', extension: '34' },
    { fullName: 'Shahzoda', extension: '36' },
    { fullName: 'Alina A', extension: '37' },
    { fullName: 'Amal', extension: '46' },
    { fullName: 'Tatyana', extension: '47' },
    { fullName: 'Kamila', extension: '48' },
    { fullName: 'Kumushkhon', extension: '49' },
    { fullName: 'Zafar', extension: '50' },
    { fullName: 'Sevara', extension: '51' },
    { fullName: 'Shahzodbek', extension: '52' },
    { fullName: 'Kamola', extension: '53' },
];
