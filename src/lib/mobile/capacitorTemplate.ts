import JSZip from 'jszip'
import type { MobileBuildMode, MobileConfig } from '@/types/mobile'

export type CapacitorTemplateInput = {
  projectName: string
  deployedUrl: string
  mobileConfig: MobileConfig
  mode?: MobileBuildMode
}

function capacitorConfigTs(cfg: MobileConfig, deployedUrl: string, mode: MobileBuildMode): string {
  if (mode === 'bundled') {
    return `import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: '${cfg.appId}',
  appName: '${cfg.displayName.replace(/'/g, "\\'")}',
  webDir: 'dist',
  bundledWebRuntime: false,
}

export default config
`
  }

  return `import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: '${cfg.appId}',
  appName: '${cfg.displayName.replace(/'/g, "\\'")}',
  webDir: 'www',
  server: {
    url: '${deployedUrl.replace(/'/g, "\\'")}',
    cleartext: false,
  },
}

export default config
`
}

function packageJson(cfg: MobileConfig, mode: MobileBuildMode): string {
  return JSON.stringify(
    {
      name: cfg.appId.split('.').pop() ?? 'runlabs-mobile',
      version: '1.0.0',
      private: true,
      scripts: {
        build: mode === 'bundled' ? 'vite build && npx cap sync' : 'npx cap sync',
        'cap:ios': 'npx cap open ios',
        'cap:android': 'npx cap open android',
      },
      dependencies: {
        '@capacitor/android': '^6.0.0',
        '@capacitor/core': '^6.0.0',
        '@capacitor/ios': '^6.0.0',
      },
      devDependencies: {
        '@capacitor/cli': '^6.0.0',
        typescript: '^5.3.0',
      },
    },
    null,
    2,
  )
}

function readmeMd(cfg: MobileConfig, deployedUrl: string, mode: MobileBuildMode): string {
  return `# ${cfg.displayName} — Capacitor

## Requisitos
- Node.js 18+
- Cuenta [Apple Developer](https://developer.apple.com/programs/)
- Cuenta [Google Play Console](https://play.google.com/console)

## Modo: ${mode === 'bundled' ? 'empaquetado (webDir)' : 'remoto (URL publicada)'}

${
  mode === 'remote'
    ? `La app carga: **${deployedUrl}**

Los cambios que publiques en Runlabs42 se verán en la app sin reenviar a tiendas (salvo cambios nativos).`
    : 'Ejecuta `npm run build` para generar `dist/` antes de `npx cap sync`.'
}

## Pasos

1. \`npm install\`
2. \`npx cap add ios\` y/o \`npx cap add android\` (si no están en el zip)
3. \`npx cap sync\`
4. \`npm run cap:ios\` o \`npm run cap:android\`
5. Firma y sube desde Xcode / Android Studio

## Bundle IDs
- iOS: ${cfg.iosBundleId ?? cfg.appId}
- Android: ${cfg.androidPackage ?? cfg.appId}
`
}

/** Genera zip con plantilla Capacitor (config + README; proyectos nativos vía cap add local). */
export async function buildCapacitorZip(input: CapacitorTemplateInput): Promise<Buffer> {
  const mode = input.mode ?? 'remote'
  const zip = new JSZip()

  zip.file('package.json', packageJson(input.mobileConfig, mode))
  zip.file('capacitor.config.ts', capacitorConfigTs(input.mobileConfig, input.deployedUrl, mode))
  zip.file('README.md', readmeMd(input.mobileConfig, input.deployedUrl, mode))
  zip.file('www/.gitkeep', '')
  zip.file(
    '.gitignore',
    `node_modules/
dist/
ios/
android/
.DS_Store
`,
  )

  if (mode === 'bundled') {
    zip.file(
      'vite.config.ts',
      `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
})
`,
    )
  }

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return Buffer.from(buf)
}
