# UI Consistency Guide

## Overview
This guide ensures all pages and components maintain visual consistency across the entire application. **Always** use the design system tokens from `src/styles/designSystem.ts`.

---

## 🎨 Color Palette

### Primary Usage
- **Blue Gradient** (`colors.primary.gradient`): Main CTAs, primary actions, headers
- **Purple Gradient** (`colors.secondary.gradient`): Supporting actions, secondary buttons
- **Yellow Gradient** (`colors.accent.gradient`): Highlights, special features, "Book Now" buttons
- **Green** (`colors.success`): Success messages, confirmations
- **Red** (`colors.danger`): Errors, warnings, destructive actions

### ❌ Don't Use
- Random color combinations
- Hardcoded hex colors
- Inconsistent gradient directions

### ✅ Do Use
```tsx
import { buttons } from '../styles/designSystem';

// Primary button
<button className={buttons.primary}>Book Now</button>

// Accent button
<button className={buttons.accent}>Get Started</button>
```

---

## 📐 Spacing & Layout

### Section Spacing
All page sections should use consistent vertical padding:

```tsx
import { spacing } from '../styles/designSystem';

// Standard section
<section className={spacing.section}>...</section>

// Small section
<section className={spacing.sectionSmall}>...</section>

// Large section (hero)
<section className={spacing.sectionLarge}>...</section>
```

### Container Widths
```tsx
import { layouts } from '../styles/designSystem';

// Standard container
<div className={layouts.container}>...</div>

// Narrow (forms, articles)
<div className={layouts.containerNarrow}>...</div>

// Wide (galleries, dashboards)
<div className={layouts.containerWide}>...</div>
```

### Grid Systems
```tsx
// 2-column grid
<div className={layouts.grid2}>...</div>

// 3-column grid
<div className={layouts.grid3}>...</div>

// 4-column grid
<div className={layouts.grid4}>...</div>
```

---

## 📝 Typography

### Headings Hierarchy
Always follow proper heading hierarchy:

```tsx
import { typography } from '../styles/designSystem';

<h1 className={typography.h1}>Page Title</h1>         // 48-72px
<h2 className={typography.h2}>Section Title</h2>      // 36-60px
<h3 className={typography.h3}>Subsection Title</h3>   // 24-48px
<h4 className={typography.h4}>Card Title</h4>         // 18-24px
```

### Body Text
```tsx
// Standard body
<p className={typography.body}>Regular text content</p>

// Lead paragraph
<p className={typography.lead}>Introductory paragraph with emphasis</p>

// Caption
<span className={typography.caption}>Small descriptive text</span>
```

---

## 🔘 Buttons

### Button Types
Every button should use one of these standard types:

```tsx
import { buttons } from '../styles/designSystem';

// Primary action (blue gradient)
<button className={buttons.primary}>Save Changes</button>

// Secondary action (purple gradient)
<button className={buttons.secondary}>Learn More</button>

// Accent/CTA (yellow gradient)
<button className={buttons.accent}>Book Now</button>

// Success action
<button className={buttons.success}>Confirm</button>

// Danger action
<button className={buttons.danger}>Delete</button>

// Outline style
<button className={buttons.outline}>Cancel</button>

// Ghost style
<button className={buttons.ghost}>Skip</button>
```

### Button Sizes
```tsx
// Small button
<button className={`${buttons.primary} ${buttons.small}`}>Small</button>

// Default button
<button className={buttons.primary}>Default</button>

// Large button
<button className={`${buttons.primary} ${buttons.large}`}>Large</button>
```

---

## 🎴 Cards

### Card Types
```tsx
import { cards } from '../styles/designSystem';

// Standard card
<div className={cards.default}>
  <h3>Card Title</h3>
  <p>Card content...</p>
</div>

// Elevated card (with hover effect)
<div className={cards.elevated}>
  <h3>Interactive Card</h3>
  <p>Lifts on hover...</p>
</div>

// Glass card (frosted glass effect)
<div className={cards.glass}>
  <h3>Glass Card</h3>
  <p>Frosted background...</p>
</div>

// Interactive/clickable card
<div className={cards.interactive}>
  <h3>Clickable Card</h3>
  <p>Changes border on hover...</p>
</div>
```

---

## 📥 Form Inputs

### Input Fields
```tsx
import { inputs } from '../styles/designSystem';

// Standard input
<input type="text" className={inputs.default} placeholder="Enter text" />

// Error state
<input type="email" className={inputs.error} placeholder="Invalid email" />

// Success state
<input type="text" className={inputs.success} placeholder="Valid input" />

// Search input
<input type="search" className={inputs.search} placeholder="Search..." />

// Textarea
<textarea className={inputs.textarea} placeholder="Enter message" />
```

### Form Labels & Error Messages
```tsx
import { patterns } from '../styles/designSystem';

<div className={patterns.formGroup}>
  <label className={patterns.formLabel}>Email Address</label>
  <input type="email" className={inputs.default} />
  {error && <p className={patterns.formError}>{error}</p>}
  <p className={patterns.formHelp}>We'll never share your email</p>
</div>
```

---

## 🏷️ Badges & Status Indicators

```tsx
import { badges } from '../styles/designSystem';

// Status badges
<span className={badges.primary}>New</span>
<span className={badges.success}>Active</span>
<span className={badges.warning}>Pending</span>
<span className={badges.danger}>Cancelled</span>
<span className={badges.neutral}>Draft</span>

// Small badge
<span className={`${badges.success} ${badges.small}`}>✓</span>

// Large badge
<span className={`${badges.primary} ${badges.large}`}>Featured</span>
```

---

## 🎭 Animations & Transitions

### Framer Motion Animations
```tsx
import { motion } from 'framer-motion';
import { animations } from '../styles/designSystem';

// Fade in
<motion.div {...animations.fadeIn}>
  Content fades in
</motion.div>

// Fade in up
<motion.div {...animations.fadeInUp}>
  Content slides up and fades in
</motion.div>

// Scale in
<motion.div {...animations.scaleIn}>
  Content scales up
</motion.div>
```

### Hover Effects
```tsx
import { effects } from '../styles/designSystem';

// Hover lift
<div className={`${cards.default} ${effects.hoverLift}`}>
  Lifts on hover
</div>

// Hover scale
<button className={`${buttons.primary} ${effects.hoverScale}`}>
  Scales up on hover
</button>

// Hover shadow
<div className={`${cards.default} ${effects.hoverShadowXl}`}>
  Shadow increases on hover
</div>
```

---

## 🎯 Common Patterns

### Page Layout
Every page should follow this structure:

```tsx
import { layouts, spacing } from '../styles/designSystem';

export default function MyPage() {
  return (
    <main className={layouts.page}>
      {/* Hero Section */}
      <section className={patterns.hero}>
        <div className={layouts.container}>
          <h1 className={typography.h1}>Page Title</h1>
        </div>
      </section>

      {/* Content Section */}
      <section className={spacing.section}>
        <div className={layouts.container}>
          {/* Content */}
        </div>
      </section>
    </main>
  );
}
```

### Modal/Dialog
```tsx
import { patterns } from '../styles/designSystem';

<div className={patterns.modal}>
  <div className={patterns.modalContent}>
    <h2>Modal Title</h2>
    <p>Modal content...</p>
  </div>
</div>
```

### Loading States
```tsx
import { patterns } from '../styles/designSystem';

// Loading spinner
<div className={patterns.loadingSpinner} />

// Loading skeleton
<div className={patterns.loadingSkeleton} style={{ height: 100 }} />
```

### Empty States
```tsx
import { patterns } from '../styles/designSystem';

<div className={patterns.emptyState}>
  <svg>...</svg>
  <h3>No items found</h3>
  <p>Get started by creating your first item</p>
  <button className={buttons.primary}>Create Item</button>
</div>
```

---

## ✅ Consistency Checklist

Before committing any UI component, verify:

- [ ] Uses design system colors (no hardcoded colors)
- [ ] Uses design system spacing (consistent padding/margins)
- [ ] Uses design system typography (proper heading hierarchy)
- [ ] Uses standard button styles
- [ ] Uses standard card styles
- [ ] Form inputs follow design system
- [ ] Animations use design system tokens
- [ ] Responsive on mobile, tablet, desktop
- [ ] Hover states are consistent
- [ ] Loading states use standard patterns
- [ ] Error states use standard patterns
- [ ] Shadows and borders are consistent

---

## 🚫 Common Mistakes to Avoid

### ❌ Don't Do This
```tsx
// Hardcoded colors
<button className="bg-blue-500 hover:bg-blue-600">Click</button>

// Inconsistent spacing
<div className="p-3 mb-5">Content</div>

// Random gradients
<div className="bg-gradient-to-r from-pink-300 to-blue-800">Text</div>

// Non-standard borders
<div className="border border-gray-500 rounded-sm">Card</div>
```

### ✅ Do This Instead
```tsx
import { buttons, spacing, cards } from '../styles/designSystem';

// Use design system button
<button className={buttons.primary}>Click</button>

// Use design system spacing
<div className={spacing.card}>Content</div>

// Use design system gradient
<div className={colors.primary.gradient}>Text</div>

// Use design system card
<div className={cards.default}>Card</div>
```

---

## 🔄 Migration Guide

To update existing components to use the design system:

1. **Import design system**
   ```tsx
   import { buttons, cards, inputs, typography } from '../styles/designSystem';
   ```

2. **Replace hardcoded classes**
   ```tsx
   // Before
   <button className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg">
     Button
   </button>
   
   // After
   <button className={buttons.primary}>
     Button
   </button>
   ```

3. **Update colors**
   ```tsx
   // Before
   <div className="bg-gradient-to-r from-yellow-400 to-yellow-500">
     Content
   </div>
   
   // After
   <div className={colors.accent.gradient}>
     Content
   </div>
   ```

4. **Test responsiveness**
   - Check mobile view (< 768px)
   - Check tablet view (768px - 1024px)
   - Check desktop view (> 1024px)

---

## 📚 Additional Resources

- **Design System File**: `src/styles/designSystem.ts`
- **Tailwind Config**: `tailwind.config.js`
- **Global Styles**: `src/index.css`

For questions or updates to the design system, please update both this guide and the design system file.
