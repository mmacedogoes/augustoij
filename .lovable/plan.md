# Plan: Juridical Standard Document Export Refinement

Refine the PDF and DOCX generation to follow a "Padrão Jurídico Clássico" (Classic Juridical Standard) with structured numbering for titles and justified text.

## User Preferences
- **Style**: Padrão Jurídico Clássico (A4, Serif font, 1.5 spacing, justified).
- **Titles**: Numerado Estruturado (Automatic numbering for clauses/sections).
- **Alignment**: Justified margins.

## Proposed Changes

### 1. Document Export Logic (`src/lib/documento-export.ts`)
- **State Management**: Introduce a counter for "subtitulo" blocks to support "Numerado Estruturado" (e.g., "CLÁUSULA PRIMEIRA", "CLÁUSULA SEGUNDA" or simply "1.", "2.").
- **PDF Generation (`gerarPdfBlob`)**:
  - Refine spacing between paragraphs.
  - Implement a cleaner "CLÁUSULA X" formatting if preferred, or standard "1." numbering.
  - Ensure margins are strictly 2.5cm as defined.
- **DOCX Generation (`gerarDocxBlob`)**:
  - Apply identical numbering logic to DOCX paragraphs.
  - Ensure font is consistently "Cormorant Garamond".

### 2. Preview Component (`src/components/chat/EditorMinuta.tsx`)
- Update the `Previa` component to reflect the new numbering and spacing rules so the user sees exactly what they will get.

## Technical Details
- Use a simple regex check or position-based numbering for `subtitulo` blocks during the `parseDocumento` flow or during generation.
- For "Numerado Estruturado", I will use the format "CLÁUSULA [NÚMERO]" for top-level sections if they look like clauses, or simple numeric "1.", "1.1" for general subtitled sections.
- Ensure the `MM` utility (mm to points) correctly maps 25mm to margins.

## Questions Answered
- Visual Style: Padrão Jurídico Clássico.
- Titles: Numerado Estruturado.
