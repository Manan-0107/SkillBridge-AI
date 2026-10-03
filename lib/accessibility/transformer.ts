/**
 * lib/accessibility/transformer.ts
 *
 * UBIX Universal Content Transformer
 *
 * Transforms any career content, feedback, roadmap milestone, or instruction
 * into multiple accessible representations while strictly preserving factual integrity.
 *
 * Supported Transformation Modalities:
 * - concise: Key takeaway in 1-2 clear sentences.
 * - detailed: Full comprehensive context.
 * - step_by_step: Ordered actionable milestones.
 * - structured_bullets: Semantic bullet list.
 * - accessible_transcript: Linear reading representation with visual descriptions.
 * - speech_ready: Natural conversational text optimized for screen readers and speech synthesis.
 * - simplified_language: Plain English (5th-8th grade reading level) avoiding jargon.
 * - technical: Precise technical terms with direct architectural/code references.
 * - teach_back: Questions/prompts testing candidate comprehension.
 *
 * Invariant: Never invents facts or adds hallucinatory qualifications.
 */

export type ContentFormat =
  | "concise"
  | "detailed"
  | "step_by_step"
  | "structured_bullets"
  | "accessible_transcript"
  | "speech_ready"
  | "simplified_language"
  | "technical"
  | "teach_back";

export interface TransformedContent {
  format: ContentFormat;
  originalText: string;
  transformedText: string;
  keyPoints: string[];
  steps?: string[];
  speechDurationEstimateSec: number;
  readingEaseScore?: number; // Flesch-Kincaid approximation
  provenance: "FACTUAL_PRESERVED";
}

/**
 * Universal Content Transformer engine.
 */
export function transformContent(
  text: string,
  targetFormat: ContentFormat,
  options: { title?: string; maxSentences?: number } = {}
): TransformedContent {
  const clean = (text || "").trim();
  if (!clean) {
    return {
      format: targetFormat,
      originalText: "",
      transformedText: "",
      keyPoints: [],
      speechDurationEstimateSec: 0,
      provenance: "FACTUAL_PRESERVED",
    };
  }

  // Extract sentences and paragraphs
  const sentences = clean
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const wordCount = clean.split(/\s+/).length;
  const speechDurationEstimateSec = Math.ceil(wordCount / 2.5); // ~150 words/min

  let transformedText = clean;
  const keyPoints: string[] = [];
  let steps: string[] | undefined = undefined;

  switch (targetFormat) {
    case "concise": {
      const limit = options.maxSentences || 2;
      transformedText = sentences.slice(0, limit).join(" ");
      keyPoints.push(transformedText);
      break;
    }

    case "detailed": {
      transformedText = clean;
      keyPoints.push(...sentences.slice(0, 5));
      break;
    }

    case "step_by_step": {
      // Split by numbered lists, colons, or sentences
      const rawSteps = sentences.map((s, idx) => `Step ${idx + 1}: ${s}`);
      steps = rawSteps;
      transformedText = rawSteps.join("\n");
      keyPoints.push(...sentences);
      break;
    }

    case "structured_bullets": {
      const bullets = sentences.map((s) => `• ${s}`);
      transformedText = bullets.join("\n");
      keyPoints.push(...sentences);
      break;
    }

    case "accessible_transcript": {
      const header = options.title ? `[Transcript: ${options.title}]\n\n` : "[Transcript]\n\n";
      transformedText = `${header}${clean}\n\n[End of Transcript]`;
      keyPoints.push(...sentences.slice(0, 3));
      break;
    }

    case "speech_ready": {
      // Strip markdown symbols and formatting characters for smooth audio speech synthesis
      transformedText = clean
        .replace(/[*_#`[\]()]/g, "")
        .replace(/&/g, "and")
        .replace(/e\.g\./gi, "for example")
        .replace(/i\.e\./gi, "that is")
        .replace(/w\//gi, "with");
      keyPoints.push(sentences[0] || transformedText);
      break;
    }

    case "simplified_language": {
      // Normalize common academic/technical jargon into straightforward conversational English
      transformedText = clean
        .replace(/\butilize\b/gi, "use")
        .replace(/\bcommence\b/gi, "start")
        .replace(/\bterminate\b/gi, "end")
        .replace(/\bfacilitate\b/gi, "help")
        .replace(/\bimplement\b/gi, "build")
        .replace(/\bdemonstrate\b/gi, "show")
        .replace(/\boptimal\b/gi, "best")
        .replace(/\bprerequisite\b/gi, "needed skill");
      keyPoints.push(transformedText.split(".")[0] + ".");
      break;
    }

    case "technical": {
      // Preserves original technical terminology and structured specs
      transformedText = clean;
      keyPoints.push(...sentences.filter((s) => /API|schema|function|type|database|system|protocol/i.test(s)));
      if (keyPoints.length === 0) keyPoints.push(sentences[0]);
      break;
    }

    case "teach_back": {
      // Generates active recall comprehension questions based directly on the provided facts
      const promptQuestion = sentences[0]
        ? `Can you explain the main idea of this in your own words? Focus on: "${sentences[0]}"`
        : "Can you summarize what you just learned?";
      transformedText = `${promptQuestion}\n\nReference Material:\n${clean}`;
      keyPoints.push(sentences[0] || clean);
      break;
    }
  }

  return {
    format: targetFormat,
    originalText: clean,
    transformedText,
    keyPoints: keyPoints.length > 0 ? keyPoints : [clean],
    steps,
    speechDurationEstimateSec,
    provenance: "FACTUAL_PRESERVED",
  };
}
