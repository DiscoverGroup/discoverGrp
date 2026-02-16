# Component Style Examples

## Reusable Component Patterns

Copy these patterns to ensure consistency across all pages and components.

---

## 1. Page Header Pattern

```tsx
import { typography, spacing, layouts } from '../styles/designSystem';

<section className={`${spacing.section} bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50`}>
  <div className={layouts.container}>
    <div className="text-center max-w-3xl mx-auto">
      <h1 className={typography.h1}>Page Title</h1>
      <p className={`${typography.lead} mt-6`}>
        Brief description of what this page is about
      </p>
    </div>
  </div>
</section>
```

---

## 2. Feature Card Grid

```tsx
import { layouts, cards, typography } from '../styles/designSystem';

<div className={layouts.grid3}>
  {features.map((feature) => (
    <div key={feature.id} className={cards.elevated}>
      <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4">
        <feature.icon className="w-8 h-8 text-white" />
      </div>
      <h3 className={typography.h4}>{feature.title}</h3>
      <p className={`${typography.body} mt-2 text-gray-600`}>
        {feature.description}
      </p>
    </div>
  ))}
</div>
```

---

## 3. Form with Validation

```tsx
import { inputs, buttons, patterns } from '../styles/designSystem';

<form onSubmit={handleSubmit} className="space-y-6">
  {/* Input Field */}
  <div className={patterns.formGroup}>
    <label className={patterns.formLabel}>Email Address</label>
    <input 
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className={error ? inputs.error : inputs.default}
      placeholder="you@example.com"
    />
    {error && <p className={patterns.formError}>{error}</p>}
  </div>

  {/* Submit Button */}
  <button 
    type="submit" 
    disabled={loading}
    className={buttons.primary}
  >
    {loading ? 'Submitting...' : 'Submit'}
  </button>
</form>
```

---

## 4. Stats/Numbers Section

```tsx
import { layouts, typography } from '../styles/designSystem';

<section className="py-16 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
  <div className={layouts.container}>
    <div className={layouts.grid4}>
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className={typography.h1}>{stat.value}</div>
          <div className={`${typography.body} mt-2 opacity-90`}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
```

---

## 5. Call-to-Action Section

```tsx
import { spacing, layouts, typography, buttons } from '../styles/designSystem';

<section className={`${spacing.section} bg-gradient-to-br from-blue-900 to-purple-900 text-white`}>
  <div className={layouts.containerNarrow}>
    <div className="text-center">
      <h2 className={typography.h2}>Ready to Get Started?</h2>
      <p className={`${typography.lead} mt-4 opacity-90`}>
        Join thousands of happy travelers today
      </p>
      <div className="mt-8 flex gap-4 justify-center">
        <button className={buttons.accent}>Book Now</button>
        <button className={buttons.outline}>Learn More</button>
      </div>
    </div>
  </div>
</section>
```

---

## 6. Image with Overlay

```tsx
import { typography } from '../styles/designSystem';

<div className="relative h-96 rounded-2xl overflow-hidden">
  <img 
    src={imageUrl} 
    alt={title}
    className="w-full h-full object-cover"
  />
  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end">
    <div className="p-8 text-white">
      <h3 className={typography.h3}>{title}</h3>
      <p className={`${typography.body} mt-2 opacity-90`}>{description}</p>
    </div>
  </div>
</div>
```

---

## 7. Tab Navigation

```tsx
import { typography } from '../styles/designSystem';

<div className="border-b border-gray-200">
  <nav className="flex gap-8">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`
          py-4 border-b-2 transition-colors
          ${activeTab === tab.id 
            ? 'border-blue-600 text-blue-600' 
            : 'border-transparent text-gray-600 hover:text-gray-900'
          }
          ${typography.h5}
        `}
      >
        {tab.label}
      </button>
    ))}
  </nav>
</div>
```

---

## 8. Notification Toast

```tsx
import { badges, typography } from '../styles/designSystem';

{showNotification && (
  <div className="fixed top-4 right-4 bg-white rounded-xl shadow-2xl p-6 border-2 border-green-200 max-w-sm">
    <div className="flex items-start gap-4">
      <span className={badges.success}>✓</span>
      <div>
        <h4 className={typography.h5}>Success!</h4>
        <p className={`${typography.body} text-gray-600 mt-1`}>
          Your changes have been saved.
        </p>
      </div>
    </div>
  </div>
)}
```

---

## 9. Loading State

```tsx
import { patterns, typography } from '../styles/designSystem';

{loading ? (
  <div className={patterns.loadingState}>
    <div className={patterns.loadingSpinner} />
    <p className={`${typography.body} mt-4 text-gray-600`}>
      Loading...
    </p>
  </div>
) : (
  <div>{content}</div>
)}
```

---

## 10. Empty State

```tsx
import { patterns, typography, buttons } from '../styles/designSystem';

<div className={patterns.emptyState}>
  <svg className="w-24 h-24 text-gray-400 mb-6">
    {/* Empty state icon */}
  </svg>
  <h3 className={typography.h3}>No items found</h3>
  <p className={`${typography.body} text-gray-600 mt-2`}>
    Get started by creating your first item
  </p>
  <button className={`${buttons.primary} mt-6`}>
    Create Item
  </button>
</div>
```

---

## 11. Image Gallery Grid

```tsx
import { layouts } from '../styles/designSystem';

<div className={layouts.grid3}>
  {images.map((image) => (
    <div 
      key={image.id}
      className="aspect-square rounded-xl overflow-hidden group cursor-pointer"
    >
      <img 
        src={image.url}
        alt={image.alt}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
      />
    </div>
  ))}
</div>
```

---

## 12. Pricing Card

```tsx
import { cards, typography, buttons, badges } from '../styles/designSystem';

<div className={`${cards.elevated} text-center`}>
  {featured && (
    <span className={`${badges.accent} mb-4`}>Most Popular</span>
  )}
  <h3 className={typography.h3}>{planName}</h3>
  <div className={`${typography.h1} my-6`}>
    ${price}<span className="text-gray-600 text-lg">/month</span>
  </div>
  <ul className="space-y-3 mb-8">
    {features.map((feature) => (
      <li key={feature} className={`${typography.body} text-gray-600`}>
        ✓ {feature}
      </li>
    ))}
  </ul>
  <button className={featured ? buttons.accent : buttons.outline}>
    Choose Plan
  </button>
</div>
```

---

## 13. Timeline/Steps

```tsx
import { typography } from '../styles/designSystem';

<div className="space-y-8">
  {steps.map((step, index) => (
    <div key={step.id} className="flex gap-6">
      {/* Step Number */}
      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
        {index + 1}
      </div>
      
      {/* Step Content */}
      <div className="flex-1">
        <h4 className={typography.h4}>{step.title}</h4>
        <p className={`${typography.body} text-gray-600 mt-2`}>
          {step.description}
        </p>
      </div>
    </div>
  ))}
</div>
```

---

## 14. Search Bar

```tsx
import { inputs } from '../styles/designSystem';

<div className="relative">
  <svg 
    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
  >
    {/* Search icon */}
  </svg>
  <input 
    type="search"
    className={inputs.search}
    placeholder="Search..."
  />
</div>
```

---

## 15. Modal Dialog

```tsx
import { patterns, typography, buttons } from '../styles/designSystem';

{isOpen && (
  <div className={patterns.modal} onClick={onClose}>
    <div 
      className={patterns.modalContent}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className={typography.h2}>Modal Title</h2>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      
      {/* Modal Content */}
      <div className="mb-6">
        <p className={typography.body}>Modal content goes here</p>
      </div>
      
      {/* Modal Actions */}
      <div className="flex gap-4 justify-end">
        <button className={buttons.outline} onClick={onClose}>
          Cancel
        </button>
        <button className={buttons.primary} onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </div>
  </div>
)}
```

---

## Notes

- Always import from `../styles/designSystem`
- Use template literals to combine classes when needed
- Never hardcode colors or spacing values
- Test on mobile, tablet, and desktop viewports
- Add hover states using design system effects
- Use semantic HTML elements (section, nav, article, etc.)
