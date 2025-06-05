/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}", // Scan all necessary file types in src
    ],
    theme: {
      extend: {
        // Colori personalizzati che utilizzano le variabili CSS
        colors: {
          'brand': {
            50: 'var(--color-primary-50)',
            100: 'var(--color-primary-100)',
            200: 'var(--color-primary-200)',
            300: 'var(--color-primary-300)',
            400: 'var(--color-primary-400)',
            500: 'var(--color-primary-500)',
            600: 'var(--color-primary-600)',
            700: 'var(--color-primary-700)',
            800: 'var(--color-primary-800)',
            900: 'var(--color-primary-900)',
            DEFAULT: 'var(--color-primary-500)',
          },
          'accent': {
            50: 'var(--color-secondary-50)',
            100: 'var(--color-secondary-100)',
            200: 'var(--color-secondary-200)',
            300: 'var(--color-secondary-300)',
            400: 'var(--color-secondary-400)',
            500: 'var(--color-secondary-500)',
            600: 'var(--color-secondary-600)',
            700: 'var(--color-secondary-700)',
            800: 'var(--color-secondary-800)',
            900: 'var(--color-secondary-900)',
            DEFAULT: 'var(--color-secondary-500)',
          },
          'neutral': {
            50: 'var(--color-neutral-50)',
            100: 'var(--color-neutral-100)',
            200: 'var(--color-neutral-200)',
            300: 'var(--color-neutral-300)',
            400: 'var(--color-neutral-400)',
            500: 'var(--color-neutral-500)',
            600: 'var(--color-neutral-600)',
            700: 'var(--color-neutral-700)',
            800: 'var(--color-neutral-800)',
            900: 'var(--color-neutral-900)',
            DEFAULT: 'var(--color-neutral-500)',
          },
          'success': {
            50: 'var(--color-success-50)',
            100: 'var(--color-success-100)',
            200: 'var(--color-success-200)',
            300: 'var(--color-success-300)',
            400: 'var(--color-success-400)',
            500: 'var(--color-success-500)',
            600: 'var(--color-success-600)',
            700: 'var(--color-success-700)',
            800: 'var(--color-success-800)',
            900: 'var(--color-success-900)',
            DEFAULT: 'var(--color-success-500)',
          },
          'warning': {
            50: 'var(--color-warning-50)',
            100: 'var(--color-warning-100)',
            200: 'var(--color-warning-200)',
            300: 'var(--color-warning-300)',
            400: 'var(--color-warning-400)',
            500: 'var(--color-warning-500)',
            600: 'var(--color-warning-600)',
            700: 'var(--color-warning-700)',
            800: 'var(--color-warning-800)',
            900: 'var(--color-warning-900)',
            DEFAULT: 'var(--color-warning-500)',
          },
          'error': {
            50: 'var(--color-error-50)',
            100: 'var(--color-error-100)',
            200: 'var(--color-error-200)',
            300: 'var(--color-error-300)',
            400: 'var(--color-error-400)',
            500: 'var(--color-error-500)',
            600: 'var(--color-error-600)',
            700: 'var(--color-error-700)',
            800: 'var(--color-error-800)',
            900: 'var(--color-error-900)',
            DEFAULT: 'var(--color-error-500)',
          },
          'info': {
            50: 'var(--color-info-50)',
            100: 'var(--color-info-100)',
            200: 'var(--color-info-200)',
            300: 'var(--color-info-300)',
            400: 'var(--color-info-400)',
            500: 'var(--color-info-500)',
            600: 'var(--color-info-600)',
            700: 'var(--color-info-700)',
            800: 'var(--color-info-800)',
            900: 'var(--color-info-900)',
            DEFAULT: 'var(--color-info-500)',
          },
          // Override dei colori di base con i nostri colori
          'primary': {
            50: 'var(--color-primary-50)',
            100: 'var(--color-primary-100)',
            200: 'var(--color-primary-200)',
            300: 'var(--color-primary-300)',
            400: 'var(--color-primary-400)',
            500: 'var(--color-primary-500)',
            600: 'var(--color-primary-600)',
            700: 'var(--color-primary-700)',
            800: 'var(--color-primary-800)',
            900: 'var(--color-primary-900)',
            DEFAULT: 'var(--color-primary-500)',
          },
        },
        
        // Background personalizzati
        backgroundColor: {
          'surface': 'var(--color-surface-primary)',
          'surface-secondary': 'var(--color-surface-secondary)',
          'surface-glass': 'var(--color-surface-glass)',
          'background': 'var(--color-background-primary)',
          'background-secondary': 'var(--color-background-secondary)',
          'background-tertiary': 'var(--color-background-tertiary)',
        },
        
        // Text colors personalizzati
        textColor: {
          'default': 'var(--color-text-primary)',
          'secondary': 'var(--color-text-secondary)',
          'tertiary': 'var(--color-text-tertiary)',
          'quaternary': 'var(--color-text-quaternary)',
          'inverse': 'var(--color-text-inverse)',
        },
        
        // Border colors personalizzati
        borderColor: {
          'default': 'var(--color-border-primary)',
          'secondary': 'var(--color-border-secondary)',
          'focus': 'var(--color-border-focus)',
        },
        
        // Gradients personalizzati
        backgroundImage: {
          'gradient-primary': 'var(--gradient-primary)',
          'gradient-background': 'var(--gradient-background)',
          'gradient-glass': 'var(--gradient-glass)',
        },
        
        // Box shadows personalizzate
        boxShadow: {
          'custom-sm': 'var(--shadow-sm)',
          'custom-md': 'var(--shadow-md)',
          'custom-lg': 'var(--shadow-lg)',
          'custom-xl': 'var(--shadow-xl)',
          'custom-2xl': 'var(--shadow-2xl)',
        },
        
        // Border radius personalizzati
        borderRadius: {
          'custom-sm': 'var(--radius-sm)',
          'custom-md': 'var(--radius-md)',
          'custom-lg': 'var(--radius-lg)',
          'custom-xl': 'var(--radius-xl)',
          'custom-2xl': 'var(--radius-2xl)',
        },
        
        // Animation duration personalizzate
        transitionDuration: {
          'fast': 'var(--duration-fast)',
          'normal': 'var(--duration-normal)',
          'slow': 'var(--duration-slow)',
        },
        
        // Animation timing functions
        transitionTimingFunction: {
          'custom': 'var(--ease-in-out)',
        },
        
        // Font families
        fontFamily: {
          'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        },
      },
    },
    plugins: [
      require('@tailwindcss/forms'), // Optional: enhances form styling
    ],
  }