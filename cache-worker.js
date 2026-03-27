const CACHE_NAME = 'vandal-cache-1774632641.518129';
    const ASSETS_TO_CACHE = ['./build/shaders/posterizer.d31c06ca.frag', './build/shaders/edgetrace.8bfbdbc8.frag', './build/shaders/palettesquare.c0bdbffd.frag', './build/shaders/threshold.3db3b2eb.frag', './build/shaders/delayline.28ba4c1b.frag', './build/shaders/field_parentheses.83a604b3.frag', './build/shaders/halftone.a49b07f8.frag', './build/shaders/noisemixer.102ce338.frag', './build/shaders/dither.3cc58d63.frag', './build/shaders/unsharp.fcd82c66.frag', './build/shaders/basis_parentheses.692ec6c1.frag', './build/shaders/invert.79233d27.frag', './build/shaders/gen_debug.b876e8dc.frag', './build/shaders/auto_levels.8e7b1e6a.frag', './build/shaders/duotone.1c3c6ce5.frag', './build/shaders/channelmixer.437e7aad.frag', './build/shaders/colorshred.8527e6b8.frag', './build/shaders/flow_parentheses.bf1f014c.glsl', './build/shaders/slamshade.db2211c2.frag', './build/shaders/colormap.ab98249e.frag', './build/shaders/wave.fd241572.frag', './build/shaders/blockprobe.6a08e77a.frag', './build/shaders/contour_synth.3dc827f4.frag', './build/shaders/affine_transform.e2f5d144.frag', './build/shaders/tile_desync.0f26e755.frag', './build/shaders/pixelate.470fadce.frag', './build/shaders/perlin_distort.8a780b89.frag', './build/shaders/bloom.495bcf7e.glsl', './build/shaders/vector_field_stuff.3fef904a.glsl', './build/shaders/jzazbz.c63174b8.frag', './build/shaders/scanlines.24cef09b.frag', './build/shaders/statsprobe.f24797a1.frag', './build/shaders/banded_flip.6b0d083f.frag', './build/shaders/warpzone.fcbcb15e.glsl', './build/shaders/look.5bca1485.frag', './build/shaders/gridpattern.771f2b9d.frag', './build/shaders/bcs.0dd7dfb1.frag', './build/shaders/aberration.b2d44bd4.frag', './build/shaders/kernel2d.5c9d2082.glsl', './build/shaders/badtv.dd9174f1.frag', './build/shaders/engrave.dcbe4213.frag', './build/shaders/input_stretch.27bd6c9f.frag', './build/shaders/chromawave.99b66bf9.frag', './build/shaders/pcaprobe.a27e7a4a.frag', './build/shaders/palette_synth.0e09f653.frag', './build/shaders/fill_nan.d30f1113.frag', './build/shaders/includes/zones.a913ab28.glsl', './build/shaders/includes/noise.0daf813d.glsl', './build/shaders/includes/basis_projection.6e1452b1.glsl', './build/shaders/includes/kernel_utils.8726f9e6.glsl', './build/shaders/includes/blend_old.31c3e96b.glsl', './build/shaders/includes/vecfield.9a4f2176.glsl', './build/shaders/includes/blend.25a5a5db.glsl', './build/shaders/includes/posterize.af8cc6b8.glsl', './build/shaders/includes/distortionutils.2e963c8d.glsl', './build/shaders/includes/colorconvert.5cb5c430.glsl', './build/shaders/includes/color_projection.54508f6a.glsl', './build/shaders/includes/noises/noise4D.cf936fb1.glsl', './build/shaders/includes/noises/classicnoise4D.43b3ead0.glsl', './build/shaders/includes/noises/cellular2x2.b5664772.glsl', './build/shaders/includes/noises/cellular3D.916ffd60.glsl', './build/shaders/includes/noises/classicnoise3D.61e81e21.glsl', './build/shaders/includes/noises/noise3D.bf18982b.glsl', './build/shaders/includes/noises/cellular2x2x2.7b26cf9c.glsl', './build/shaders/includes/noises/noise3Dgrad.d1dde865.glsl', './build/shaders/includes/noises/noisenums.076a0e0d.glsl', './build/shaders/includes/noises/noise2D.a905245b.glsl', './build/shaders/includes/noises/classicnoise2D.bb0c666b.glsl', './build/shaders/includes/noises/psrdnoise2.235dbbb1.glsl', './build/shaders/includes/noises/psrdnoise2D.203de784.glsl', './build/shaders/includes/noises/cellular2D.24822ace.glsl'];
    const SHADER_PREFIX = `${self.location.origin}/build/shaders/`;

    self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)))});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url); 
  if (req.method !== 'GET') return;

  // Network-first for HTML/navigation
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cached = await caches.match(req);
        return cached || Response.error();
      }
    })());
    return;
  }
  
  // Only cache same-origin shader assets.
  if (url.origin !== self.location.origin || !url.href.startsWith(SHADER_PREFIX)) {
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(req, fresh.clone());
    return fresh;
  })());
});
