# 🎨 PL-AI Design System

## Panoramica

Il Design System PL-AI fornisce un set completo di variabili CSS e classi Tailwind personalizzate per mantenere la coerenza visiva in tutto il frontend.

## 🌈 Palette Colori

### Colori Brand Principali
- **Primary (Purple)**: Colore principale del brand
- **Secondary (Pink)**: Colore di accento per gradienti e highlight

### Variabili CSS
```css
/* Primary Colors */
--color-primary-500: #a855f7  /* Colore principale */
--color-primary-600: #9333ea  /* Hover states */
--color-primary-700: #7c3aed  /* Active states */

/* Secondary Colors */
--color-secondary-500: #ec4899  /* Accento principale */
--color-secondary-600: #db2777  /* Hover accento */
```

### Classi Tailwind
```html
<!-- Backgrounds -->
<div class="bg-brand-500">Primary background</div>
<div class="bg-accent-500">Secondary background</div>
<div class="bg-primary">Stesso colore di bg-brand-500</div>

<!-- Testi -->
<p class="text-brand-600">Testo primary</p>
<p class="text-accent-500">Testo secondary</p>
```

## 🎯 Colori di Stato

### Success (Verde)
```html
<div class="bg-success-100 text-success-700 border border-success-200">
  Messaggio di successo
</div>
```

### Error (Rosso)
```html
<div class="bg-error-100 text-error-700 border border-error-200">
  Messaggio di errore
</div>
```

### Warning (Giallo)
```html
<div class="bg-warning-100 text-warning-700 border border-warning-200">
  Messaggio di avvertimento
</div>
```

### Info (Blu)
```html
<div class="bg-info-100 text-info-700 border border-info-200">
  Messaggio informativo
</div>
```

## 🌫️ Colori Neutri

Perfetti per testi, background e borders:

```html
<!-- Testi -->
<h1 class="text-default">Titolo principale</h1>
<p class="text-secondary">Testo secondario</p>
<span class="text-tertiary">Testo terziario</span>
<small class="text-quaternary">Testo quaternario</small>

<!-- Backgrounds neutri -->
<div class="bg-neutral-50">Background molto chiaro</div>
<div class="bg-neutral-100">Background chiaro</div>
<div class="bg-surface">Surface principale</div>
<div class="bg-surface-secondary">Surface secondaria</div>
```

## 🎨 Gradienti

### Classi CSS Personalizzate
```html
<div class="gradient-primary">Gradiente brand principale</div>
<div class="gradient-background">Gradiente background sottile</div>
```

### Classi Tailwind
```html
<div class="bg-gradient-primary">Gradiente usando Tailwind</div>
<div class="bg-gradient-to-r from-brand-500 to-accent-500">Gradiente custom</div>
```

## 🔘 Componenti Pre-costruiti

### Bottoni

#### Bottone Primario
```html
<!-- Classe CSS custom -->
<button class="btn-primary">Azione Principale</button>

<!-- Equivalente Tailwind -->
<button class="bg-gradient-primary text-inverse px-6 py-3 rounded-custom-xl font-semibold hover:scale-105 transition-all duration-normal">
  Azione Principale
</button>
```

#### Bottone Secondario
```html
<!-- Classe CSS custom -->
<button class="btn-secondary">Azione Secondaria</button>

<!-- Equivalente Tailwind -->
<button class="bg-surface border border-default text-default px-6 py-3 rounded-custom-xl font-medium hover:bg-background-tertiary transition-all duration-normal">
  Azione Secondaria
</button>
```

### Cards

#### Card Standard
```html
<!-- Classe CSS custom -->
<div class="card p-6">
  <h3>Titolo Card</h3>
  <p>Contenuto della card</p>
</div>

<!-- Equivalente Tailwind -->
<div class="bg-surface rounded-custom-2xl shadow-custom-lg border border-default p-6">
  <h3>Titolo Card</h3>
  <p>Contenuto della card</p>
</div>
```

#### Card Vetro (Glass Effect)
```html
<!-- Classe CSS custom -->
<div class="card-glass p-6">
  <h3>Card con effetto vetro</h3>
  <p>Perfetta per overlay e modali</p>
</div>
```

## 🎭 Effetti e Animazioni

### Glass Effect
```html
<div class="glass-effect p-4 rounded-custom-xl">
  Elemento con effetto vetro
</div>
```

### Hover Effects
```html
<div class="smooth-hover">Elemento con hover smooth</div>
<div class="chat-message">Messaggio con hover specifico</div>
```

### Animazioni di Entrata
```html
<div class="animate-fade-in">Elemento che appare con fade-in</div>
```

## 📏 Spaziature e Dimensioni

### Border Radius
```html
<div class="rounded-custom-sm">Piccolo (6px)</div>
<div class="rounded-custom-md">Medio (8px)</div>
<div class="rounded-custom-lg">Grande (12px)</div>
<div class="rounded-custom-xl">Extra Large (16px)</div>
<div class="rounded-custom-2xl">2X Large (24px)</div>
```

### Shadows
```html
<div class="shadow-custom-sm">Ombra piccola</div>
<div class="shadow-custom-md">Ombra media</div>
<div class="shadow-custom-lg">Ombra grande</div>
<div class="shadow-custom-xl">Ombra extra large</div>
<div class="shadow-custom-2xl">Ombra massima</div>
```

### Transizioni
```html
<div class="transition-all duration-fast">Transizione veloce (150ms)</div>
<div class="transition-all duration-normal">Transizione normale (200ms)</div>
<div class="transition-all duration-slow">Transizione lenta (300ms)</div>
```

## 🖱️ Stati Interattivi

### Focus States
```html
<input class="focus-ring-primary" placeholder="Input con focus personalizzato">
```

### Scroll Personalizzato
```html
<div class="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent overflow-auto">
  Contenuto scrollabile con scrollbar personalizzata
</div>
```

## 🎯 Esempi Pratici

### Alert di Successo Completo
```html
<div class="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-custom-xl flex items-center justify-between">
  <span>Operazione completata con successo!</span>
  <button class="text-success-400 hover:text-success-600 transition-colors duration-normal">
    <svg class="w-4 h-4"><!-- Close icon --></svg>
  </button>
</div>
```

### Bottone con Gradiente e Icona
```html
<button class="bg-gradient-primary text-inverse px-6 py-3 rounded-custom-xl font-semibold hover:scale-105 hover:shadow-custom-lg transition-all duration-normal flex items-center gap-2">
  <svg class="w-5 h-5"><!-- Icon --></svg>
  <span>Invia Messaggio</span>
</button>
```

### Modal con Glass Effect
```html
<div class="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
  <div class="card-glass p-8 max-w-md w-full mx-4">
    <h2 class="text-xl font-bold text-default mb-4">Titolo Modal</h2>
    <p class="text-secondary mb-6">Contenuto del modal con effetto vetro.</p>
    <div class="flex gap-3 justify-end">
      <button class="btn-secondary">Annulla</button>
      <button class="btn-primary">Conferma</button>
    </div>
  </div>
</div>
```

## 🔧 Come Utilizzare

### 1. Variabili CSS Pure
```css
.my-component {
  background-color: var(--color-primary-500);
  color: var(--color-text-inverse);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  transition: all var(--duration-normal) var(--ease-in-out);
}
```

### 2. Classi CSS Personalizzate
```html
<button class="btn-primary smooth-hover">Bottone</button>
<div class="card glass-effect">Card</div>
```

### 3. Classi Tailwind Estese
```html
<div class="bg-brand-500 text-inverse rounded-custom-xl shadow-custom-lg">
  Elemento con classi Tailwind personalizzate
</div>
```

## 📱 Responsive Design

Tutte le variabili e classi funzionano perfettamente con i modificatori responsive di Tailwind:

```html
<div class="bg-brand-500 md:bg-accent-500 lg:bg-neutral-100">
  Colore che cambia con le breakpoint
</div>

<button class="btn-primary text-sm md:text-base lg:text-lg">
  Bottone responsive
</button>
```

## 🎨 Personalizzazione

Per modificare i colori principali, aggiorna le variabili CSS in `src/index.css`:

```css
:root {
  --color-primary-500: #your-new-color;
  --color-secondary-500: #your-accent-color;
  /* ... altre personalizzazioni */
}
```

I cambiamenti si applicheranno automaticamente a tutto il frontend! 