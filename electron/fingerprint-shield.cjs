// Freedom Browser - basic fingerprint protection, run in the page's own world of every http(s) frame before
// its scripts (electron/webview-preload.cjs). The values a page can read change per site and per browser run,
// so sites cannot link visits by them, while staying stable within one site, as real hardware would:
//  - canvas and WebGL pixel reads get faint noise derived from the seed and the pixel content;
//  - text measurements get a sub-pixel offset (canvas font probing);
//  - the screen reports the browser window's size, at 0,0, 24-bit colour;
//  - the list of installed fonts (Local Font Access) is refused.
// Layout of the page itself is not touched: fonts probed through element sizes cannot be hidden from here.

/** The script for one frame; seed: 32-bit number from electron/site-settings.cjs fingerprintSeed */
function shieldScript(seed) {
  const SEED = Number(seed) >>> 0;
  return `(() => {
  const SEED = ${SEED};
  const LIMIT = 500000; // pixels: big canvases (games, editors) are read untouched, fingerprinting uses small ones
  const hash = (a, b) => {
    let h = (SEED ^ Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
    return h >>> 0;
  };

  // Patched functions print as the originals did
  const native = new WeakMap();
  const fnToString = Function.prototype.toString;
  const toString = { toString() { return fnToString.call(native.get(this) || this); } }.toString;
  native.set(toString, fnToString);
  Object.defineProperty(Function.prototype, 'toString', { ...Object.getOwnPropertyDescriptor(Function.prototype, 'toString'), value: toString });

  const patchMethod = (proto, name, make) => {
    const d = proto && Object.getOwnPropertyDescriptor(proto, name);
    if (!d || typeof d.value !== 'function') return;
    const orig = d.value;
    const fn = make(orig);
    native.set(fn, orig);
    Object.defineProperty(fn, 'name', { value: orig.name });
    Object.defineProperty(fn, 'length', { value: orig.length });
    Object.defineProperty(proto, name, { ...d, value: fn });
  };
  const patchGetter = (target, name, make) => {
    const d = target && Object.getOwnPropertyDescriptor(target, name);
    if (!d || typeof d.get !== 'function') return;
    const orig = d.get;
    const get = { get [name]() { return make(orig).call(this); } };
    const fn = Object.getOwnPropertyDescriptor(get, name).get;
    native.set(fn, orig);
    Object.defineProperty(target, name, { ...d, get: fn });
  };

  // ---- Canvas and WebGL pixels ----
  const noisify = (data) => {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = hash(i >> 2, data[i] | (data[i + 1] << 8) | (data[i + 2] << 16));
      if ((r & 31) === 0) data[i + ((r >>> 5) % 3)] ^= 1;
    }
  };
  const getImageData = CanvasRenderingContext2D.prototype.getImageData;
  patchMethod(CanvasRenderingContext2D.prototype, 'getImageData', (orig) => function (...args) {
    const image = orig.apply(this, args);
    if (image.width * image.height <= LIMIT) noisify(image.data);
    return image;
  });
  if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
    patchMethod(OffscreenCanvasRenderingContext2D.prototype, 'getImageData', (orig) => function (...args) {
      const image = orig.apply(this, args);
      if (image.width * image.height <= LIMIT) noisify(image.data);
      return image;
    });
  }
  // A noised copy of the canvas to encode, or null to encode it as it is
  const noisedCopy = (canvas) => {
    const w = canvas.width, h = canvas.height;
    if (!w || !h || w * h > LIMIT) return null;
    try {
      const copy = document.createElement('canvas');
      copy.width = w; copy.height = h;
      const ctx = copy.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      const image = getImageData.call(ctx, 0, 0, w, h);
      noisify(image.data);
      ctx.putImageData(image, 0, 0);
      return copy;
    } catch {
      return null;
    }
  };
  patchMethod(HTMLCanvasElement.prototype, 'toDataURL', (orig) => function (...args) {
    return orig.apply(noisedCopy(this) || this, args);
  });
  patchMethod(HTMLCanvasElement.prototype, 'toBlob', (orig) => function (...args) {
    return orig.apply(noisedCopy(this) || this, args);
  });
  for (const gl of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!gl) continue;
    patchMethod(gl.prototype, 'readPixels', (orig) => function (...args) {
      const result = orig.apply(this, args);
      const pixels = args[6];
      const w = args[2], h = args[3];
      if (pixels instanceof Uint8Array && w * h <= LIMIT && pixels.length >= w * h * 4) noisify(pixels.subarray(0, w * h * 4));
      return result;
    });
  }

  // ---- Text measurement (canvas font probing): sub-pixel, never visible ----
  if (typeof TextMetrics !== 'undefined') {
    for (const prop of ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent']) {
      patchGetter(TextMetrics.prototype, prop, (orig) => function () {
        const value = orig.call(this);
        if (!value) return value;
        return value + (((hash(Math.round(value * 1000), prop.length) % 21) - 10) * 0.00001);
      });
    }
  }

  // ---- Screen: the window, not the monitor ----
  const screenValues = {
    width: () => window.outerWidth || window.innerWidth,
    height: () => window.outerHeight || window.innerHeight,
    availWidth: () => window.outerWidth || window.innerWidth,
    availHeight: () => window.outerHeight || window.innerHeight,
    availLeft: () => 0,
    availTop: () => 0,
    colorDepth: () => 24,
    pixelDepth: () => 24,
  };
  for (const [prop, value] of Object.entries(screenValues)) patchGetter(Screen.prototype, prop, () => value);
  for (const prop of ['screenX', 'screenY', 'screenLeft', 'screenTop']) {
    patchGetter(Object.getOwnPropertyDescriptor(window, prop) ? window : Window.prototype, prop, () => () => 0);
  }

  // ---- Installed fonts ----
  if (typeof window.queryLocalFonts === 'function') {
    patchMethod(Object.getOwnPropertyDescriptor(window, 'queryLocalFonts') ? window : Window.prototype, 'queryLocalFonts', () => function () {
      return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });
  }
})();`;
}

module.exports = { shieldScript };
