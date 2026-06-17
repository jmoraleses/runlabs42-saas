import type { AutoScreenPrompt } from '@/lib/auto/types'

/** Pantallas ecommerce estándar para generación Stitch. */
export function defaultEcommerceScreenPrompts(niche: string): AutoScreenPrompt[] {
  const base = niche.trim() || 'tienda online moderna'
  return [
    {
      id: 'home',
      name: 'Inicio',
      prompt: `Landing homepage for ${base}. Hero with CTA, featured products, trust badges, newsletter. Desktop ecommerce.`,
    },
    {
      id: 'catalog',
      name: 'Catálogo',
      prompt: `Product catalog grid page for ${base}. Filters sidebar, product cards, pagination. Desktop ecommerce.`,
    },
    {
      id: 'product',
      name: 'Producto',
      prompt: `Single product detail page for ${base}. Gallery, price, add to cart, reviews, related products.`,
    },
    {
      id: 'cart',
      name: 'Carrito',
      prompt: `Shopping cart page for ${base}. Line items, quantities, subtotal, checkout CTA.`,
    },
    {
      id: 'checkout',
      name: 'Checkout',
      prompt: `Checkout page for ${base}. Shipping form, payment summary, place order button.`,
    },
    {
      id: 'about',
      name: 'About',
      prompt: `About us page for ${base}. Brand story, team section, values.`,
    },
    {
      id: 'contact',
      name: 'Contacto',
      prompt: `Contact page for ${base}. Form, map placeholder, support info.`,
    },
  ]
}
