import { createCn } from 'cn/config'

// Class-name merge (clsx + tailwind-merge semantics, via shadcn's `cn`
// package), taught the custom theme names in src/ui/tokens.css. Without
// this, `text-caption` (a size) and `text-foreground` (a color) would be
// treated as conflicting, and overrides like `rounded-row` wouldn't replace
// `rounded-card`.
export const cn = createCn({
  extend: {
    theme: {
      text: ['caption', 'body-sm', 'body', 'title', 'title-lg', 'input', 'heading', 'stat', 'page', 'display', 'hero'],
      radius: ['card', 'card-sm', 'row', 'row-lg'],
      shadow: ['hero', 'raised', 'nav', 'popover'],
      spacing: ['gutter', 'gutter-tight', 'tap', 'input', 'row', 'nav'],
    },
  },
})
