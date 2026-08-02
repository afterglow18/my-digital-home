/**
 * Capacitor bridge for the native iOS VisionPlugin.
 *
 * On iOS native:  calls the Swift plugin (VNClassifyImageRequest + VNRecognizeTextRequest).
 * On web / Android:  silently returns empty arrays — text search still works.
 *
 * Usage:
 *   const { labels, text } = await analyzeWithVision(dataUrl);
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

interface VisionAnalysisResult {
  labels: string[];
  text: string[];
}

interface VisionPluginInterface {
  analyze(options: { dataUrl: string }): Promise<VisionAnalysisResult>;
}

const _VisionPlugin = registerPlugin<VisionPluginInterface>('VisionPlugin');

const EMPTY: VisionAnalysisResult = { labels: [], text: [] };

/**
 * Run iOS Vision on the image data URL.
 * Returns { labels: [], text: [] } on web or on any error — never throws.
 */
export async function analyzeWithVision(dataUrl: string): Promise<VisionAnalysisResult> {
  if (!Capacitor.isNativePlatform()) return EMPTY;
  try {
    return await _VisionPlugin.analyze({ dataUrl });
  } catch {
    return EMPTY;
  }
}
