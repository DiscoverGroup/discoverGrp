# UI Consistency Quick Reference

## Import the Design System
```tsx
import { 
  buttons, 
  cards, 
  inputs, 
  badges,
  typography, 
  colors, 
  spacing, 
  layouts 
} from '../styles/designSystem';
```

## Quick Copy-Paste Examples

### Primary Button (Blue)
```tsx
<button className={buttons.primary}>Click Me</button>
```

### Accent Button (Yellow - for CTAs)
```tsx
<button className={buttons.accent}>Book Now</button>
```

### Card
```tsx
<div className={cards.default}>
  <h3 className={typography.h3}>Title</h3>
  <p className={typography.body}>Content</p>
</div>
```

### Input Field
```tsx
<input type="text" className={inputs.default} placeholder="Enter text" />
```

### Section Layout
```tsx
<section className={spacing.section}>
  <div className={layouts.container}>
    {/* Your content */}
  </div>
</section>
```

### Grid - 3 Columns
```tsx
<div className={layouts.grid3}>
  <div>{/* Item 1 */}</div>
  <div>{/* Item 2 */}</div>
  <div>{/* Item 3 */}</div>
</div>
```

### Badge
```tsx
<span className={badges.success}>Active</span>
<span className={badges.danger}>Error</span>
```

### Page Layout
```tsx
export default function MyPage() {
  return (
    <main className={layouts.page}>
      <section className={spacing.section}>
        <div className={layouts.container}>
          <h1 className={typography.h1}>Page Title</h1>
          <p className={typography.body}>Content...</p>
        </div>
      </section>
    </main>
  );
}
```

## Color Values

### When to Use Each Color
- **Primary (Blue)**: Main actions, navigation, primary content
- **Secondary (Purple)**: Supporting actions, alternative options
- **Accent (Yellow)**: "Book Now", special features, highlights
- **Success (Green)**: Confirmations, success messages
- **Danger (Red)**: Errors, warnings, delete actions

## Button Hierarchy
1. **Primary** (blue) - Most important action
2. **Accent** (yellow) - Special CTA like "Book Now"
3. **Secondary** (purple) - Supporting actions
4. **Outline** - Cancel, neutral actions
5. **Ghost** - Tertiary actions, minimal emphasis

## Spacing Scale
- **Small**: 48px mobile, 64px desktop
- **Standard**: 64px mobile, 96px desktop
- **Large**: 80px mobile, 128px desktop

## Typography Scale
- **h1**: 36-48px (page titles)
- **h2**: 30-40px (section titles)
- **h3**: 24-32px (subsection titles)
- **h4**: 18-24px (card titles)
- **body**: 16-18px (regular text)

## Remember
✅ Always use design system tokens  
✅ Keep spacing consistent  
✅ Follow typography hierarchy  
✅ Test on mobile, tablet, desktop  
❌ Never hardcode colors  
❌ Never use random spacing  
❌ Never skip design system imports  
