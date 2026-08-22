const DISPLAY_NAME = "sw-openc64-display";

export function crtPopoutFeatures() {
  const aw = window.screen.availWidth || 1280;
  const ah = window.screen.availHeight || 800;
  const aspect = 384 / 272;
  const chrome = 72;
  let width = Math.min(aw - 64, 1200);
  let height = Math.round(width / aspect) + chrome;
  if (height > ah - 64) {
    height = ah - 64;
    width = Math.round((height - chrome) * aspect);
  }
  const left = Math.max(0, Math.round((aw - width) / 2));
  const top = Math.max(24, Math.round((ah - height) / 2));
  return `popup=yes,width=${Math.round(width)},height=${Math.round(height)},left=${left},top=${top}`;
}

export function openCrtPopout() {
  const url = new URL("display", window.location.href);
  url.searchParams.set("pop", "1");
  return window.open(url.toString(), DISPLAY_NAME, crtPopoutFeatures());
}
