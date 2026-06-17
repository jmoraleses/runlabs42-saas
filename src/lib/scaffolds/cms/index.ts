import type { CodeTemplate } from '@/lib/codeTemplates'
import type { ScaffoldFile } from '@/lib/scaffolds/types'

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVQ42mP8z5BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function readme(projectName: string, platform: string, steps: string[]): ScaffoldFile {
  return {
    path: `export/README-${platform}.md`,
    content: `# ${projectName} — ${platform}

${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

El preview estático en \`preview/\` se despliega en Vercel; los archivos de \`export/\` son para importar en ${platform}.
`,
    language: 'markdown',
  }
}

function marketplaceDocs(projectName: string, platform: string, installablePath: string): ScaffoldFile[] {
  const safe = projectName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return [
    {
      path: `marketplace/templatemonster/Documentation/index.html`,
      content: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${safe} - ${platform} Documentation</title></head>
<body>
  <h1>${safe} - ${platform} Theme</h1>
  <h2>Installation</h2>
  <ol>
    <li>Extract the product package.</li>
    <li>Use the installable file at <code>${installablePath}</code>.</li>
    <li>Import demo content from <code>marketplace/templatemonster/Demo Content</code>.</li>
  </ol>
  <h2>Package Structure</h2>
  <ul>
    <li>Documentation/</li>
    <li>Demo Content/</li>
    <li>Installable theme zip (generated in download bundle)</li>
  </ul>
</body>
</html>`,
      language: 'html',
    },
    {
      path: `marketplace/templatemonster/Demo Content/README.txt`,
      content: `Demo content for ${projectName} (${platform}).
Place XML/JSON/SQL import files here based on your platform.`,
    },
    {
      path: `marketplace/templatemonster/readme.txt`,
      content: `TemplateMonster package helper
- Documentation: marketplace/templatemonster/Documentation
- Demo Content: marketplace/templatemonster/Demo Content
- Installable theme: ${installablePath}`,
    },
    {
      path: 'marketplace/themeforest/documentation/index.html',
      content: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${safe} - ThemeForest Documentation</title></head>
<body>
  <h1>${safe}</h1>
  <p>ThemeForest-ready documentation bundle.</p>
  <p>Installable package path: <code>${installablePath}</code></p>
</body>
</html>`,
      language: 'html',
    },
    {
      path: 'marketplace/themeforest/changelog.txt',
      content: `v1.0.0
- Initial generated package for ${projectName} (${platform})`,
    },
    {
      path: 'marketplace/themeforest/licensing.txt',
      content: 'Replace this file with final license and third-party asset credits before submission.',
    },
  ]
}

export function getCmsScaffold(template: CodeTemplate, projectName: string): ScaffoldFile[] {
  const slug = projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'runlabs-theme'

  switch (template) {
    case 'html':
      return [
        readme(projectName, 'HTML', [
          'Sube la carpeta `preview/` a cualquier hosting estático o usa el ZIP del proyecto.',
          'Edita `preview/index.html` y páginas adicionales según necesites.',
        ]),
      ]
    case 'wordpress':
      return [
        {
          path: 'export/wordpress/style.css',
          content: `/*
Theme Name: ${projectName}
Author: Runlabs
Version: 1.0.0
*/
`,
        },
        {
          path: 'export/wordpress/functions.php',
          content: `<?php
if (!defined('ABSPATH')) exit;

add_action('after_setup_theme', function () {
  add_theme_support('title-tag');
  add_theme_support('post-thumbnails');
});
`,
        },
        {
          path: 'export/wordpress/index.php',
          content: `<?php get_header(); ?>
<main id="primary" class="site-main">
<?php if (have_posts()) : while (have_posts()) : the_post(); the_content(); endwhile; endif; ?>
</main>
<?php get_footer(); ?>
`,
        },
        {
          path: 'export/wordpress/header.php',
          content: `<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo('charset'); ?>"><?php wp_head(); ?></head>
<body <?php body_class(); ?>>
`,
        },
        {
          path: 'export/wordpress/footer.php',
          content: `<?php wp_footer(); ?></body></html>
`,
        },
        {
          path: 'export/wordpress/screenshot.png',
          content: TINY_PNG_B64,
        },
        readme(projectName, 'WordPress', [
          'Copia `export/wordpress/` a `wp-content/themes/${slug}/`.',
          'Activa el tema en Apariencia → Temas.',
          'Asigna páginas estáticas según el manifiesto del sitio.',
        ]),
        ...marketplaceDocs(projectName, 'WordPress', 'import/wordpress-theme.zip'),
      ]
    case 'woocommerce':
      return [
        ...getCmsScaffold('wordpress', projectName).filter((f) => f.path !== 'export/wordpress/functions.php'),
        {
          path: 'export/wordpress/functions.php',
          content: `<?php
if (!defined('ABSPATH')) exit;

add_action('after_setup_theme', function () {
  add_theme_support('title-tag');
  add_theme_support('post-thumbnails');
  add_theme_support('woocommerce');
});
`,
        },
        {
          path: 'export/wordpress/woocommerce/.gitkeep',
          content: '',
        },
        readme(projectName, 'WooCommerce', [
          'Instala WooCommerce en el mismo WordPress.',
          'Copia overrides de `export/wordpress/woocommerce/` al tema activo.',
          'Configura productos y checkout en WooCommerce.',
        ]),
        ...marketplaceDocs(projectName, 'WooCommerce', 'import/wordpress-theme.zip'),
      ]
    case 'shopify':
      return [
        {
          path: 'export/shopify/theme/layout/theme.liquid',
          content: `<!DOCTYPE html>
<html lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{{ page_title }}</title>
  {{ content_for_header }}
  {{ 'theme.css' | asset_url | stylesheet_tag }}
</head>
<body class="template-{{ template.name }}">
  {% section 'header' %}
  <main id="MainContent" role="main">
    {{ content_for_layout }}
  </main>
  {% section 'footer' %}
</body>
</html>
`,
        },
        {
          path: 'export/shopify/theme/sections/header.liquid',
          content: `<header class="site-header" role="banner">
  <a href="{{ routes.root_url }}" class="site-header__logo">{{ shop.name }}</a>
  <nav class="site-header__nav" role="navigation">
    {% for link in linklists.main-menu.links %}
      <a href="{{ link.url }}">{{ link.title }}</a>
    {% endfor %}
  </nav>
</header>
`,
        },
        {
          path: 'export/shopify/theme/sections/footer.liquid',
          content: `<footer class="site-footer" role="contentinfo">
  <p>&copy; {{ 'now' | date: '%Y' }} {{ shop.name }}</p>
</footer>
`,
        },
        {
          path: 'export/shopify/theme/sections/main-page.liquid',
          content: `<section class="page-width main-page">
  {% if section.settings.heading != blank %}
    <h1>{{ section.settings.heading }}</h1>
  {% endif %}
  <div class="rte">
    {{ page.content }}
  </div>
</section>
{% schema %}
{
  "name": "Main page",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "" }
  ]
}
{% endschema %}
`,
        },
        {
          path: 'export/shopify/theme/templates/index.json',
          content: `{
  "sections": {
    "main": { "type": "main-page", "settings": { "heading": "Home" } }
  },
  "order": ["main"]
}
`,
        },
        {
          path: 'export/shopify/theme/templates/page.json',
          content: `{
  "sections": {
    "main": { "type": "main-page", "settings": {} }
  },
  "order": ["main"]
}
`,
        },
        {
          path: 'export/shopify/theme/templates/product.json',
          content: `{
  "sections": {
    "main": { "type": "main-page", "settings": {} }
  },
  "order": ["main"]
}
`,
        },
        {
          path: 'export/shopify/theme/templates/collection.json',
          content: `{
  "sections": {
    "main": {
      "type": "main-page",
      "settings": { "heading": "{{ collection.title }}" }
    }
  },
  "order": ["main"]
}
`,
        },
        {
          path: 'export/shopify/theme/assets/theme.css',
          content: `/* ${projectName} — tema Shopify (completa con estilos del diseño) */
.page-width { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
.site-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; }
.site-header__nav a { margin-left: 1rem; }
.site-footer { padding: 2rem 1.5rem; text-align: center; opacity: 0.8; }
`,
        },
        {
          path: 'export/shopify/theme/config/settings_schema.json',
          content: `[
  {
    "name": "theme_info",
    "theme_name": "${projectName.replace(/"/g, '\\"')}",
    "theme_version": "1.0.0",
    "theme_author": "Runlabs"
  }
]
`,
        },
        {
          path: 'export/shopify/theme/locales/en.default.json',
          content: `{
  "general": {
    "accessibility": {
      "skip_to_content": "Skip to content"
    }
  }
}
`,
        },
        {
          path: 'export/shopify/theme/config/settings_data.json',
          content: `{
  "current": {}
}
`,
        },
        readme(projectName, 'Shopify', [
          'Usa Shopify CLI: `shopify theme push` desde `export/shopify/theme/`.',
          'O sube `import/shopify-theme.zip` (raíz del tema) en Admin → Temas en línea → Añadir tema.',
          'El preview estático en `preview/` es solo para Vercel; no lo subas a Shopify.',
        ]),
        ...marketplaceDocs(projectName, 'Shopify', 'import/shopify-theme.zip'),
      ]
    case 'prestashop':
      return [
        {
          path: `export/prestashop/themes/${slug}/preview.png`,
          content: TINY_PNG_B64,
        },
        {
          path: `export/prestashop/themes/${slug}/config/theme.yml`,
          content: `name: ${slug}
display_name: "${projectName.replace(/"/g, '\\"')}"
version: 1.0.0
author:
  name: Runlabs
meta:
  compatibility:
    from: 8.0.0
    to: ~
theme_settings:
  default_layout: layout-full-width
global_settings:
  image_types:
    cart_default: [125, 125]
    small_default: [98, 98]
    medium_default: [452, 452]
    large_default: [800, 800]
    home_default: [250, 250]
    category_default: [141, 180]
`,
        },
        {
          path: `export/prestashop/themes/${slug}/assets/css/theme.css`,
          content: `/* ${projectName} — PrestaShop theme */\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/assets/js/theme.js`,
          content: `document.documentElement.classList.add('theme-ready')\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/index.tpl`,
          content: `{* Home *}\n<div class="page-home">\n  <h1>{$page.title}</h1>\n</div>\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/contact.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/_partials/form-fields.tpl`,
          content: `{* Form fields partial *}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/catalog/product.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/catalog/listing/product-list.tpl`,
          content: `<div class="products">{$listing.products|count}</div>\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/checkout/cart.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/checkout/cart-empty.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/checkout/checkout.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/checkout/order-confirmation.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/cms/category.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/cms/page.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/cms/sitemap.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/cms/stores.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/address.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/addresses.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/authentication.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/guest-login.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/guest-tracking.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/history.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/identity.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/my-account.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/order-detail.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/order-follow.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/order-return.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/order-slip.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/customer/registration.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        {
          path: `export/prestashop/themes/${slug}/templates/errors/404.tpl`,
          content: `{extends file='page.tpl'}\n`,
        },
        readme(projectName, 'PrestaShop', [
          `Copia \`export/prestashop/themes/${slug}/\` a \`themes/\` de tu tienda.`,
          'Activa el tema en Diseño → Tema y logotipo.',
        ]),
        ...marketplaceDocs(projectName, 'PrestaShop', 'import/prestashop-theme.zip'),
      ]
    case 'joomla':
      return [
        {
          path: `export/joomla/templates/${slug}/index.php`,
          content: `<?php defined('_JEXEC') or die;
?><!DOCTYPE html>
<html lang="es">
<head><jdoc:include type="head" /></head>
<body><jdoc:include type="component" /></body>
</html>
`,
        },
        {
          path: `export/joomla/templates/${slug}/templateDetails.xml`,
          content: `<?xml version="1.0" encoding="utf-8"?>
<extension type="template" client="site">
  <name>${projectName}</name>
  <version>1.0.0</version>
  <files>
    <filename>index.php</filename>
    <filename>templateDetails.xml</filename>
    <filename>joomla.asset.json</filename>
    <folder>html</folder>
  </files>
  <media destination="templates/site/${slug}" folder="media">
    <folder>css</folder>
    <folder>images</folder>
    <folder>js</folder>
  </media>
  <positions>
    <position>menu</position>
    <position>sidebar</position>
    <position>footer</position>
  </positions>
</extension>
`,
        },
        {
          path: `export/joomla/templates/${slug}/joomla.asset.json`,
          content: `{
  "$schema": "https://developer.joomla.org/schemas/json-schema/web_assets.json",
  "name": "${slug}",
  "version": "1.0.0",
  "assets": [
    { "name": "template.${slug}.css", "type": "style", "uri": "template.css" },
    { "name": "template.${slug}.js", "type": "script", "uri": "template.js", "attributes": { "defer": true } }
  ]
}
`,
        },
        {
          path: `export/joomla/templates/${slug}/media/css/template.css`,
          content: `body { margin: 0; font-family: system-ui, sans-serif; }\n`,
        },
        {
          path: `export/joomla/templates/${slug}/media/js/template.js`,
          content: `document.documentElement.classList.add('joomla-template-ready')\n`,
        },
        readme(projectName, 'Joomla', [
          `Copia \`export/joomla/templates/${slug}/\` a \`templates/\` de Joomla.`,
          'Asigna la plantilla en Sistema → Plantillas del sitio.',
        ]),
        ...marketplaceDocs(projectName, 'Joomla', 'import/joomla-template.zip'),
      ]
    default:
      return []
  }
}
