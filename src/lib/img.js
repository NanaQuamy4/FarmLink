// Site photos ship as WebP in two sizes: full (/images/x.webp) and card-sized (/images/sm/x.webp).
// Older paths stored in the database ("/images/x.jpg") are mapped here, so they still work.
export function img(path, size) {
  if (!path || !path.startsWith('/images/') || path.startsWith('/images/sm/')) return path
  const name = path.slice('/images/'.length).replace(/\.(jpe?g|png|webp)$/i, '')
  return size === 'sm' ? `/images/sm/${name}.webp` : `/images/${name}.webp`
}
