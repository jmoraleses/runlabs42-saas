/** Stub para el bundle del cliente: designImageRequests es solo servidor. */
const msg =
  '@/lib/design/designImageRequests no debe importarse en el cliente. Usa @/lib/design/designImagePaths.'

function fail(): never {
  throw new Error(msg)
}

export function normalizeDesignImagePath(): never {
  fail()
}

export function parseDesignImagePathsFromHtml(): never {
  fail()
}

export function parseImageRequestsFromHtml(): never {
  fail()
}

export function collectDesignImageRequests(): never {
  fail()
}
