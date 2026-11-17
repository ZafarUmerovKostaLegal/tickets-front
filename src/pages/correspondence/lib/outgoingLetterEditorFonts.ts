import { createFontSource, type FontSource } from '@docx-editor.dev/core';
import {
    ALL_WORD_DEFAULT_FAMILIES,
    defaultFonts,
    type DefaultFontSource,
} from '@docx-editor.dev/fonts';

export const OUTGOING_LETTER_DOC_FONT = 'Calibri Light';

const DOC_SIZE_HALF_POINTS = 22;

function calibriLightSourcesFromCarlito(sources: readonly DefaultFontSource[]): FontSource[] {
    const out: FontSource[] = [];
    for (const src of sources) {
        if (src.request.family !== 'Carlito')
            continue;
        const made = createFontSource(
            src.bytes,
            {
                family: OUTGOING_LETTER_DOC_FONT,
                weight: src.request.weight,
                style: src.request.style,
                faceIndex: src.faceIndex,
            },
            { id: `kl-calibri-light-${src.request.weight}-${src.request.style}` },
        );
        if ('source' in made)
            out.push(made.source);
    }
    return out;
}

export const outgoingLetterEditorFonts = (async () => {
    const base = await defaultFonts({ families: ALL_WORD_DEFAULT_FAMILIES });
    const light = calibriLightSourcesFromCarlito(base.sources);
    const lightSubs = (base.substitutions ?? [])
        .filter((s) => s.from.family === 'Calibri')
        .map((s) => ({
            from: { ...s.from, family: OUTGOING_LETTER_DOC_FONT },
            to: s.to,
            lineMetrics: s.lineMetrics,
        }));
    return {
        sources: [...base.sources, ...light],
        substitutions: [...(base.substitutions ?? []), ...lightSubs],
        defaultFont: {
            family: OUTGOING_LETTER_DOC_FONT,
            sizeHalfPoints: DOC_SIZE_HALF_POINTS,
        },
    };
})();
