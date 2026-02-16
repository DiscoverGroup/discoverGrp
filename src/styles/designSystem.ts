/**
 * Centralized Design System
 * Consistent colors, spacing, and component styles across the application
 * 
 * USAGE GUIDELINES:
 * - Always use these constants instead of hardcoding Tailwind classes
 * - Primary (Blue): Main brand color for primary actions
 * - Secondary (Purple): Supporting actions and accents
 * - Accent (Yellow): Highlights and special features
 * - Success (Green): Success states, confirmations
 * - Danger (Red): Errors, warnings, destructive actions
 */

export const colors = {
  // Primary - Blue (Main Brand Color)
  primary: {
    gradient: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600',
    gradientHover: 'hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700',
    solid: 'bg-blue-600',
    solidHover: 'hover:bg-blue-700',
    light: 'bg-blue-50',
    lighter: 'bg-blue-100',
    text: 'text-blue-600',
    textDark: 'text-blue-700',
    border: 'border-blue-600',
    borderLight: 'border-blue-200',
  },
  
  // Secondary - Purple/Indigo (Supporting Color)
  secondary: {
    gradient: 'bg-gradient-to-r from-indigo-600 to-purple-600',
    gradientHover: 'hover:from-indigo-700 hover:to-purple-700',
    solid: 'bg-indigo-600',
    solidHover: 'hover:bg-indigo-700',
    light: 'bg-indigo-50',
    lighter: 'bg-indigo-100',
    text: 'text-indigo-600',
    textDark: 'text-indigo-700',
    border: 'border-indigo-600',
    borderLight: 'border-indigo-200',
  },
  
  // Accent - Yellow/Gold (Highlights & CTAs)
  accent: {
    gradient: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
    gradientHover: 'hover:from-yellow-500 hover:to-yellow-600',
    solid: 'bg-yellow-500',
    solidHover: 'hover:bg-yellow-600',
    light: 'bg-yellow-50',
    lighter: 'bg-yellow-100',
    text: 'text-yellow-600',
    textDark: 'text-yellow-700',
    border: 'border-yellow-500',
    borderLight: 'border-yellow-200',
  },
  
  // Success - Green (Confirmations, Success States)
  success: {
    gradient: 'bg-gradient-to-r from-green-500 to-emerald-500',
    gradientHover: 'hover:from-green-600 hover:to-emerald-600',
    solid: 'bg-green-600',
    solidHover: 'hover:bg-green-700',
    light: 'bg-green-50',
    lighter: 'bg-green-100',
    text: 'text-green-600',
    textDark: 'text-green-700',
    border: 'border-green-600',
    borderLight: 'border-green-200',
  },
  
  // Danger - Red (Errors, Warnings, Destructive Actions)
  danger: {
    gradient: 'bg-gradient-to-r from-red-500 to-pink-500',
    gradientHover: 'hover:from-red-600 hover:to-pink-600',
    solid: 'bg-red-600',
    solidHover: 'hover:bg-red-700',
    light: 'bg-red-50',
    lighter: 'bg-red-100',
    text: 'text-red-600',
    textDark: 'text-red-700',
    border: 'border-red-600',
    borderLight: 'border-red-200',
  },
  
  // Neutral - Gray (Base Colors)
  neutral: {
    background: 'bg-gray-50',
    backgroundDark: 'bg-gray-100',
    card: 'bg-white',
    border: 'border-gray-200',
    borderDark: 'border-gray-300',
    text: 'text-gray-900',
    textMuted: 'text-gray-600',
    textLight: 'text-gray-500',
  },
} as const;


export const spacing = {
  // Section spacing
  section: 'py-16 lg:py-24',
  sectionSmall: 'py-12 lg:py-16',
  sectionLarge: 'py-20 lg:py-32',
  
  // Container spacing
  container: 'container mx-auto px-4 lg:px-6 xl:px-8',
  containerNarrow: 'max-w-4xl mx-auto px-4',
  containerWide: 'max-w-7xl mx-auto px-4 lg:px-8',
  
  // Card internal spacing
  card: 'p-6 lg:p-8',
  cardSmall: 'p-4 lg:p-6',
  cardLarge: 'p-8 lg:p-10',
  
  // Gaps between elements
  gap: 'gap-6 lg:gap-8',
  gapSmall: 'gap-4 lg:gap-6',
  gapLarge: 'gap-8 lg:gap-12',
} as const;

export const typography = {
  // Headings
  h1: 'text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight',
  h2: 'text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight',
  h3: 'text-2xl lg:text-3xl xl:text-4xl font-bold',
  h4: 'text-xl lg:text-2xl font-semibold',
  h5: 'text-lg lg:text-xl font-semibold',
  h6: 'text-base lg:text-lg font-semibold',
  
  // Body text
  body: 'text-base lg:text-lg leading-relaxed',
  bodySmall: 'text-sm lg:text-base leading-relaxed',
  bodyLarge: 'text-lg lg:text-xl leading-relaxed',
  
  // Special text
  caption: 'text-xs lg:text-sm text-gray-600',
  overline: 'text-xs uppercase tracking-wider font-semibold',
  lead: 'text-xl lg:text-2xl leading-relaxed text-gray-600',
} as const;

export const buttons = {
  // Primary button (blue gradient)
  primary: 'px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed',
  
  // Secondary button (purple gradient)
  secondary: 'px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed',
  
  // Accent button (yellow gradient)
  accent: 'px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed',
  
  // Success button (green)
  success: 'px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed',
  
  // Danger button (red)
  danger: 'px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed',
  
  // Outline button (white/gray border)
  outline: 'px-6 py-3 border-2 border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed',
  
  // Ghost button (transparent)
  ghost: 'px-6 py-3 hover:bg-gray-100 text-gray-900 font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed',
  
  // Link button
  link: 'text-blue-600 hover:text-blue-700 font-semibold underline-offset-4 hover:underline transition-colors duration-200',
  
  // Size variants
  small: 'px-4 py-2 text-sm',
  large: 'px-8 py-4 text-lg',
} as const;

export const cards = {
  // Standard card
  default: 'bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300',
  
  // Elevated card (with hover effect)
  elevated: 'bg-white border-2 border-gray-200 rounded-2xl p-6 lg:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1',
  
  // Glass/frosted card
  glass: 'bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-lg border border-gray-200 rounded-xl p-6 shadow-xl',
  
  // Interactive card (clickable)
  interactive: 'bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-2xl hover:border-blue-300 transition-all duration-300 cursor-pointer hover:-translate-y-1',
  
  // Feature card (for highlighting features)
  feature: 'bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300',
} as const;

export const inputs = {
  // Default input
  default: 'w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200',
  
  // Error state
  error: 'w-full px-4 py-3 border-2 border-red-300 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200',
  
  // Success state
  success: 'w-full px-4 py-3 border-2 border-green-300 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200',
  
  // Search input
  search: 'w-full px-4 py-3 pl-12 border-2 border-gray-300 rounded-full bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200',
  
  // Textarea
  textarea: 'w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 min-h-[120px] resize-vertical',
} as const;

export const badges = {
  // Status badges
  primary: 'inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 border-2 border-blue-200 rounded-full text-xs font-semibold',
  secondary: 'inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-800 border-2 border-indigo-200 rounded-full text-xs font-semibold',
  accent: 'inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 border-2 border-yellow-200 rounded-full text-xs font-semibold',
  success: 'inline-flex items-center px-3 py-1 bg-green-100 text-green-800 border-2 border-green-200 rounded-full text-xs font-semibold',
  danger: 'inline-flex items-center px-3 py-1 bg-red-100 text-red-800 border-2 border-red-200 rounded-full text-xs font-semibold',
  warning: 'inline-flex items-center px-3 py-1 bg-orange-100 text-orange-800 border-2 border-orange-200 rounded-full text-xs font-semibold',
  neutral: 'inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 border-2 border-gray-200 rounded-full text-xs font-semibold',
  
  // Size variants
  small: 'text-xs px-2 py-0.5',
  large: 'text-sm px-4 py-1.5',
} as const;


export const layouts = {
  // Page layouts
  page: 'min-h-screen bg-gray-50',
  pageDark: 'min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white',
  pageLight: 'min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50',
  
  // Sections
  section: 'py-16 lg:py-24',
  sectionLight: 'py-16 lg:py-24 bg-white',
  sectionGray: 'py-16 lg:py-24 bg-gray-50',
  sectionGradient: 'py-16 lg:py-24 bg-gradient-to-br from-blue-50 to-indigo-50',
  
  // Containers
  container: 'container mx-auto px-4 lg:px-6 xl:px-8',
  containerNarrow: 'max-w-4xl mx-auto px-4',
  containerWide: 'max-w-7xl mx-auto px-4 lg:px-8',
  
  // Grids
  grid1: 'grid grid-cols-1 gap-6 lg:gap-8',
  grid2: 'grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8',
  grid3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8',
  grid4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8',
  
  // Flex layouts
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexCol: 'flex flex-col',
  flexColCenter: 'flex flex-col items-center justify-center',
} as const;

export const animations = {
  // Framer Motion variants
  fadeIn: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  },
  
  fadeInUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  },
  
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.5 },
  },
  
  slideInLeft: {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6 },
  },
  
  slideInRight: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6 },
  },
  
  // Tailwind animation classes
  spin: 'animate-spin',
  ping: 'animate-ping',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
} as const;

export const effects = {
  // Shadow effects
  shadowSm: 'shadow-sm',
  shadow: 'shadow-md',
  shadowLg: 'shadow-lg',
  shadowXl: 'shadow-xl',
  shadow2xl: 'shadow-2xl',
  
  // Hover shadows
  hoverShadow: 'hover:shadow-lg transition-shadow duration-300',
  hoverShadowXl: 'hover:shadow-xl transition-shadow duration-300',
  hoverShadow2xl: 'hover:shadow-2xl transition-shadow duration-300',
  
  // Transform effects
  hoverScale: 'hover:scale-105 transition-transform duration-300',
  hoverScaleSm: 'hover:scale-102 transition-transform duration-300',
  hoverLift: 'hover:-translate-y-1 transition-transform duration-300',
  hoverLiftLg: 'hover:-translate-y-2 transition-transform duration-300',
  
  // Backdrop filters
  blur: 'backdrop-blur-sm',
  blurMd: 'backdrop-blur-md',
  blurLg: 'backdrop-blur-lg',
} as const;

export const borders = {
  // Border radius
  rounded: 'rounded-lg',
  roundedXl: 'rounded-xl',
  rounded2xl: 'rounded-2xl',
  rounded3xl: 'rounded-3xl',
  roundedFull: 'rounded-full',
  
  // Border widths
  border: 'border',
  border2: 'border-2',
  border4: 'border-4',
  
  // Border colors
  borderGray: 'border-gray-200',
  borderGrayDark: 'border-gray-300',
  borderBlue: 'border-blue-200',
  borderPurple: 'border-indigo-200',
  borderYellow: 'border-yellow-200',
} as const;

// Helper function to combine classes (className utility)
export const cn = (...classes: (string | undefined | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

// Helper to get responsive value
export const responsive = (base: string, md?: string, lg?: string, xl?: string) => {
  return [
    base,
    md && `md:${md}`,
    lg && `lg:${lg}`,
    xl && `xl:${xl}`,
  ].filter(Boolean).join(' ');
};

/**
 * Common Component Patterns
 * Pre-composed combinations of design system tokens
 */
export const patterns = {
  // Hero sections
  hero: cn(
    'min-h-[600px] lg:min-h-[700px]',
    'flex items-center justify-center',
    'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50',
    'py-20 lg:py-32'
  ),
  
  // Form groups
  formGroup: 'space-y-2',
  formLabel: 'block text-sm font-semibold text-gray-700 mb-2',
  formError: 'text-sm text-red-600 mt-1',
  formHelp: 'text-sm text-gray-600 mt-1',
  
  // Modal/Dialog
  modal: cn(
    'fixed inset-0 z-50',
    'flex items-center justify-center',
    'bg-black/50 backdrop-blur-sm',
    'p-4'
  ),
  modalContent: cn(
    'bg-white rounded-2xl shadow-2xl',
    'max-w-2xl w-full',
    'max-h-[90vh] overflow-y-auto'
  ),
  
  // Loading states
  loadingSpinner: 'animate-spin h-8 w-8 border-4 border-gray-200 border-t-blue-600 rounded-full',
  loadingSkeleton: 'animate-pulse bg-gray-200 rounded',
  
  // Empty states
  emptyState: cn(
    'flex flex-col items-center justify-center',
    'py-16 px-4 text-center'
  ),
} as const;

/**
 * Export all design tokens as a single object for easy access
 */
export const designSystem = {
  colors,
  spacing,
  typography,
  buttons,
  cards,
  inputs,
  badges,
  layouts,
  animations,
  effects,
  borders,
  patterns,
  cn,
  responsive,
} as const;

export default designSystem;
