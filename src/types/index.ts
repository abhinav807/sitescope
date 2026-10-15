/**
 * SiteScope shared types.
 * Analysis runs locally on DOM data; findings always carry evidence + recommendation.
 * No fabricated scores: severity reflects transparent heuristics documented per analyzer.
 */

export type Severity = 'critical' | 'warning' | 'info' | 'passed';
export type FindingCategory =
  | 'metadata'
  | 'social'
  | 'headings'
  | 'structured-data'
  | 'images'
  | 'links'
  | 'indexing'
  | 'favicon'
  | 'technical'
  | 'general';

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  explanation: string;
  /** Raw evidence摘 from the page (truncated, safe to render as text). */
  evidence?: string;
  /**aing What the user can do about it. */
  recommendation: string;
  /** When a check could not fully run (e.g. permission-gated). */
  limitation?: string;
}

export interface MetaItem {
  key: string;
  rawValue: string;
  normalized: string;
  source: string;
  status: Severity;
  note: string;
  recommendation?: string;
}

export interface HeadingItem {
  level: number;
  text: string;
  order: number;
  empty: boolean;
}

export interface SocialData {
  og: Record<string, string>;
  twitter: Record<string, string>;
  mismatches: Finding[];
}

export interface JsonLdBlock {
  index: number;
  raw: string;
  parsed: unknown | null;
  parseError: string | null;
  types: string[];
  empty: boolean;
}

export interface ImageInfo {
  src: string;
  resolvedUrl: string;
  alt: string | null;
  altState: 'ok' | 'missing' | 'empty-decorative';
  title: string | null;
  widthAttr: string | null;
  heightAttr: string | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
  displayedWidth: number | null;
  displayedHeight: number | null;
  loading: string | null;
  decoding: string | null;
  fetchPriority: string | null;
  srcset: string | null;
  sizes: string | null;
  format: string | null;
  broken: boolean;
  lazy: boolean;
}

export type LinkKind =
  | 'internal'
  | 'external'
  | 'same-page'
  | 'email'
  | 'telephone'
  | 'other-protocol'
  | 'empty';

export interface LinkInfo {
  href: string | null;
  resolvedUrl: string | null;
  text: string;
  accessibleName: string;
  kind: LinkKind;
  internal: boolean | null;
  rel: string | null;
  relTokens: string[];
  target: string | null;
  hasImage: boolean;
  emptyText: boolean;
  malformed: boolean;
}

export interface FaviconInfo {
  rel: string;
  href: string;
  resolvedUrl: string;
  sizes: string | null;
  type: string | null;
}

export interface ManifestInfo {
  href: string | null;
  resolvedUrl: string | null;
  accessible: 'found' | 'not-found' | 'could-not-verify' | 'not-applicable';
  fields: Record<string, unknown>;
  note: string;
}

export interface TechnicalInfo {
  url: string;
  origin: string;
  protocol: string;
  hostname: string;
  path: string;
  queryMasked: string;
  language: string | null;
  charset: string | null;
  viewport: string | null;
  https: boolean;
  mixedContent: string[];
  counts: {
    elements: number;
    domDepth: number;
    images: number;
    links: number;
    scripts: number;
    stylesheets: number;
    headings: number;
  };
  timing: Record<string, number | null>;
}

export interface CapabilityFlags {
  dom: boolean;
  headersAvailable: boolean;
  robotsTxt: 'unknown' | 'needs-permission';
  httpReachability: 'manual-only';
}

export interface AnalysisResult {
  pageUrl: string;
  pageTitle: string;
  analyzedAt: string;
  capabilities: CapabilityFlags;
  meta: MetaItem[];
  headings: HeadingItem[];
  headingCounts: Record<string, number>;
  social: SocialData;
  jsonLd: JsonLdBlock[];
  images: ImageInfo[];
  links: LinkInfo[];
  favicons: FaviconInfo[];
  manifest: ManifestInfo;
  technical: TechnicalInfo;
  findings: Finding[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    passed: number;
    total: number;
  };
}

export interface AnalyzerThresholds {
  titleMin: number;
  titleMax: number;
  descriptionMin: number;
  descriptionMax: number;
  largeImageMinWidth: number;
}

export const DEFAULT_THRESHOLDS: AnalyzerThresholds = {
  titleMin: 30,
  titleMax: 60,
  descriptionMin: 70,
  descriptionMax: 160,
  largeImageMinWidth: 1200,
};

export interface ExtensionSettings extends AnalyzerThresholds {
  theme: 'dark' | 'light' | 'system';
  density: 'compact' | 'comfortable';
  defaultTab: string;
  exportIncludeQuery: boolean;
  historyEnabled: boolean;
  historyLimit: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  ...DEFAULT_THRESHOLDS,
  theme: 'dark',
  density: 'compact',
  defaultTab: 'overview',
  exportIncludeQuery: false,
  historyEnabled: false,
  historyLimit: 10,
};

// ---- Messaging contracts (typed, validated both ends) ----

export type MessageType =
  | 'SITESCOPE_ANALYZE_REQUEST'
  | 'SITESCOPE_ANALYZE_RESPONSE'
  | 'SITESCOPE_GET_TAB'
  | 'SITESCOPE_OPEN_DASHBOARD';

export interface AnalyzeRequestMessage {
  type: 'SITESCOPE_ANALYZE_REQUEST';
  /** Set by background when injecting; content ignores unknown types. */
  nonce?: string;
}

export interface AnalyzeResponseMessage {
  type: 'SITESCOPE_ANALYZE_RESPONSE';
  ok: boolean;
  result?: AnalysisResult;
  error?: string;
}

export type ExtensionMessage = AnalyzeRequestMessage | AnalyzeResponseMessage | { type: string; [k: string]: unknown };

export function isAnalyzeResponse(m: unknown): m is AnalyzeResponseMessage {
  if (typeof m !== 'object' || m === null) return false;
  return (m as Record<string, unknown>).type === 'SITESCOPE_ANALYZE_RESPONSE';
}
