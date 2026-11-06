import { DocxEditor, useFonts } from '@docx-editor.dev/react';
import { defaultFonts } from '@docx-editor.dev/fonts';
import '@docx-editor.dev/core/styles/editor.css';
import '@docx-editor.dev/react/styles.css';

const fonts = defaultFonts();

export function LegalHubDocxPreview({ bytes, title }: { bytes: Uint8Array; title: string }) {
    const loaded = useFonts(fonts);
    return (
        <DocxEditor
            document={bytes}
            fonts={loaded}
            mode="view"
            locale="ru-RU"
            title={title}
            chrome={false}
            menu={false}
            navigation={false}
        />
    );
}
