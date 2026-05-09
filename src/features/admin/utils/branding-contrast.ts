const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

const DARK_TEXT_COLOR = "#0f172a";
const MIN_READABILITY_RATIO = 4.5;

export type ContrastRecommendation = "claro" | "oscuro";

function channelToLinear(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: { r: number; g: number; b: number }) {
  const r = channelToLinear(color.r);
  const g = channelToLinear(color.g);
  const b = channelToLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(first: { r: number; g: number; b: number }, second: { r: number; g: number; b: number }) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHexToRgb(color: string) {
  if (!HEX_COLOR_PATTERN.test(color)) {
    return null;
  }

  const hex = color.slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_PATTERN.test(prefixed)) {
    return null;
  }
  return prefixed.toLowerCase();
}

export function getBrandingContrastReport(color: string) {
  const normalized = normalizeHexColor(color);
  const rgb = normalized ? parseHexToRgb(normalized) : null;

  if (!normalized || !rgb) {
    return {
      normalizedColor: "#0f172a",
      whiteContrast: 0,
      darkContrast: 0,
      recommendedText: "claro" as const,
      isReadable: false,
      readabilityText: "Color invalido. Usa formato #RRGGBB.",
    };
  }

  const whiteContrast = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
  const darkRgb = parseHexToRgb(DARK_TEXT_COLOR) ?? { r: 15, g: 23, b: 42 };
  const darkContrast = contrastRatio(rgb, darkRgb);
  const recommendedText: ContrastRecommendation = whiteContrast >= darkContrast ? "claro" : "oscuro";
  const strongestContrast = Math.max(whiteContrast, darkContrast);
  const isReadable = strongestContrast >= MIN_READABILITY_RATIO;

  return {
    normalizedColor: normalized,
    whiteContrast,
    darkContrast,
    recommendedText,
    isReadable,
    readabilityText: isReadable
      ? "Cumple legibilidad recomendada."
      : "Contraste bajo para texto normal. Ajusta el color para mejorar legibilidad.",
  };
}
