# Logo generation

Tool: built-in imagegen, edit mode.
Source: original src-tauri/icons/markflow-logo.png before replacement.
Output: public/markflow.png (copied unchanged from imagegen output).
Regenerate platform icons: `node scripts/refresh-brand.mjs public/markflow.png`.

## Prompt

Use case: precise-object-edit. Edit target: attached original MarkFlow logo. Preserve the exact original image content: same green color and subtle texture, same white hand-drawn folded document outline, exact same two white horizontal strokes and flowing handwritten M, same scale and positions. ONLY change the outer green square background to a rounded square with generous corner radius about 22% of canvas width. Outside the rounded green square must be genuinely transparent alpha, not white or checkerboard. Green rounded square fills canvas edge to edge apart from rounded corners. Do not redesign, redraw or change the document, M, strokes, proportions, colors or internal layout. No text, no shadows, no added elements. Output a single square app icon.
