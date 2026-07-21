function parseVisibleRgb(color: string): [number, number, number] | null {
  const match = color.match(
    /rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\s*[,/]\s*([\d.]+%?))?/i,
  );
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const alphaText = match[4];
  const alpha = alphaText?.endsWith('%')
    ? Number(alphaText.slice(0, -1)) / 100
    : Number(alphaText ?? 1);
  if (!Number.isFinite(alpha) || alpha <= 0.05) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isDarkXPage(): boolean {
  const colorScheme = getComputedStyle(document.documentElement).colorScheme;
  if (colorScheme.includes('dark') && !colorScheme.includes('light')) {
    return true;
  }

  const candidates = [document.body, document.documentElement];
  for (const element of candidates) {
    const rgb = parseVisibleRgb(getComputedStyle(element).backgroundColor);
    if (!rgb) {
      continue;
    }

    const [red, green, blue] = rgb;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance < 128;
  }

  return typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: dark)').matches;
}
