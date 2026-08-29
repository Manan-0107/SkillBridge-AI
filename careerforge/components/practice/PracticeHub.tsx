"use client";

import { useState, useRef, useEffect } from "react";
import { Section } from "@/components/ui/Section";
import { Card, PrimaryButton, Tag } from "@/components/ui/Primitives";
import { useApp } from "@/lib/store";
import { speakText, stopSpeaking, startSpeechRecognition, SpeechRecognitionController } from "@/lib/voice";

const PRACTICE_QUESTIONS: Record<
  string,
  Array<{
    id: string;
    type: "Technical" | "Behavioral" | "System Design";
    question: string;
    hint: string;
  }>
> = {
  frontend: [
    {
      id: "fe-1",
      type: "Technical",
      question: "Explain the JavaScript Event Loop, and how microtasks (Promises) differ from macrotasks (setTimeout) in execution priority.",
      hint: "Mention the call stack, microtask queue priority, and rendering frame ticks.",
    },
    {
      id: "fe-2",
      type: "Technical",
      question: "How does React 18/19 reconciliation and virtual DOM diffing work under the hood? When should you use useMemo or useCallback?",
      hint: "Discuss component re-renders, fiber tree reconciliation, and referential equality.",
    },
    {
      id: "fe-3",
      type: "Behavioral",
      question: "Tell me about a time you faced a critical performance bottleneck or bug in production. How did you diagnose and resolve it?",
      hint: "Use the STAR method: Situation, Task, Action (profiling/Lighthouse), and Result (quantified metrics).",
    },
  ],
  backend: [
    {
      id: "be-1",
      type: "Technical",
      question: "What are the trade-offs between REST and GraphQL architectures? When would you choose one over the other?",
      hint: "Discuss over-fetching, caching layers, schema complexity, and payload overhead.",
    },
    {
      id: "be-2",
      type: "System Design",
      question: "Design a scalable rate-limiting system for a public API handling 50,000 requests per second.",
      hint: "Mention Token Bucket vs Leaky Bucket algorithms, Redis distributed stores, and 429 response headers.",
    },
    {
      id: "be-3",
      type: "Behavioral",
      question: "Describe a situation where you had to negotiate an architectural decision or technical debt with a product manager.",
      hint: "Highlight business alignment, risk mitigation, and compromise strategies.",
    },
  ],
  data: [
    {
      id: "data-1",
      type: "Technical",
      question: "Explain the bias-variance tradeoff in machine learning and techniques used to mitigate overfitting.",
      hint: "Mention L1/L2 regularization, cross-validation, dropout, and ensemble methods.",
    },
    {
      id: "data-2",
      type: "System Design",
      question: "How would you design a real-time feature store and model evaluation pipeline for streaming predictions?",
      hint: "Discuss Kafka/Pulsar ingestion, low-latency key-value stores, and drift detection.",
    },
  ],
  product: [
    {
      id: "prod-1",
      type: "Behavioral",
      question: "How do you prioritize competing feature requests from enterprise customers versus engineering technical debt?",
      hint: "Use RICE scoring (Reach, Impact, Confidence, Effort) and data-backed validation.",
    },
  ],
};

const tools = [
  {
    name: "Codédex",
    role: "Primary recommendation",
    description: "Gamified, quest-based coding practice with visual progression — best starting point.",
    url: "https://www.codedex.io/",
  },
  {
    name: "Codepip",
    role: "Focused Drills",
    description: "Bite-sized coding games that build specific CSS & JS skills fast.",
    url: "https://codepip.com/",
  },
  {
    name: "System Design Primer",
    role: "Architecture Guide",
    description: "Comprehensive open-source repository for scaling systems and acing engineering interviews.",
    url: "https://github.com/donnemartin/system-design-primer",
  },
];

export function PracticeHub() {
  const { targetRole, user } = useApp();
  const role = targetRole || "frontend";
  const questions = PRACTICE_QUESTIONS[role] || PRACTICE_QUESTIONS.frontend;

  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const speechControllerRef = useRef<SpeechRecognitionController | null>(null);
  const activeQuestion = questions[activeQuestionIdx] || questions[0];

  useEffect(() => {
    return () => {
      stopSpeaking();
      speechControllerRef.current?.stop();
    };
  }, []);

  const handleReadQuestion = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speakText(`Question: ${activeQuestion.question}`, {
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const handleToggleListening = () => {
    if (listening) {
      speechControllerRef.current?.stop();
      setListening(false);
      return;
    }

    const controller = startSpeechRecognition({
      onTranscript: (transcript) => {
        setUserAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
      },
      onListeningChange: (isList) => setListening(isList),
      onError: () => setListening(false),
    });
    speechControllerRef.current = controller;
  };

  const handleEvaluate = async () => {
    if (!userAnswer.trim() || evaluating) return;
    setEvaluating(true);
    setAiFeedback(null);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              text: `Please evaluate this interview answer for a ${role} interview.\n\nQuestion: "${activeQuestion.question}"\n\nCandidate's Answer:\n"${userAnswer}"\n\nProvide constructive feedback covering:\n1. STAR / Clarity Score (1-10)\n2. Technical Accuracy & Strengths\n3. Key Missing Points or Improvements\n4. An Exemplary Model Answer`,
            },
          ],
          userProfile: { name: user?.name || "Candidate", targetRole: role },
          targetRole: role,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiFeedback(data.reply || "Evaluation completed.");
      }
    } catch {
      setAiFeedback("Great attempt! Ensure you structure your answer with clear metrics, tradeoffs, and concrete architecture decisions.");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <Section
      id="practice"
      eyebrow="Voice Interview Simulator"
      title="Interactive Voice & Mock Interview Practice"
      description="Simulate real technical and behavioral interview questions with browser-native speech synthesis, voice response dictation, and instant AI evaluation."
    >
      {/* Voice-Guided Mock Interview Simulator Card */}
      <div className="mb-10 rounded-2xl border border-neutral-300 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Tag>{activeQuestion.type}</Tag>
            <span className="text-xs font-semibold text-graphite uppercase tracking-wider">
              Question {activeQuestionIdx + 1} of {questions.length} ({role})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Click to Hear Question Aloud */}
            <button
              type="button"
              onClick={handleReadQuestion}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                speaking
                  ? "bg-blue-600 text-white animate-pulse"
                  : "bg-mist text-graphite hover:bg-neutral-200 hover:text-ink"
              }`}
              title="Read question aloud (Speech Synthesis)"
            >
              <span>{speaking ? "⏹ Stop Audio" : "🔊 Listen Question"}</span>
            </button>

            {/* Question Switcher */}
            <button
              type="button"
              onClick={() => {
                setActiveQuestionIdx((prev) => (prev + 1) % questions.length);
                setUserAnswer("");
                setAiFeedback(null);
                stopSpeaking();
              }}
              className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-graphite hover:border-ink hover:text-ink transition-colors"
            >
              Next Question →
            </button>
          </div>
        </div>

        {/* Question Title */}
        <h3 className="font-display text-lg sm:text-xl italic text-ink leading-relaxed">
          &ldquo;{activeQuestion.question}&rdquo;
        </h3>
        <p className="mt-2 text-xs text-graphite bg-mist/60 p-2.5 rounded-lg border border-line/60">
          💡 <strong>Interviewer Tip:</strong> {activeQuestion.hint}
        </p>

        {/* User Answer Textarea & Voice Input */}
        <div className="mt-5 space-y-3">
          <div className="relative">
            <textarea
              rows={4}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Speak or type your answer here..."
              className="w-full rounded-xl border border-line bg-mist/30 p-3.5 text-sm text-ink placeholder:text-graphite/60 focus:border-ink focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={handleToggleListening}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                listening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-mist text-ink hover:bg-line"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${listening ? "bg-white animate-ping" : "bg-red-500"}`} />
              <span>{listening ? "Recording... Click to Stop" : "🎙️ Speak Answer (Voice STT)"}</span>
            </button>

            {/* AI Feedback Button */}
            <PrimaryButton
              type="button"
              onClick={handleEvaluate}
              disabled={evaluating || !userAnswer.trim()}
            >
              {evaluating ? "Evaluating Answer…" : "🤖 Evaluate with AI"}
            </PrimaryButton>
          </div>
        </div>

        {/* AI Evaluation Output */}
        {aiFeedback && (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs leading-relaxed text-ink space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-900 text-sm">AI Interviewer Evaluation:</span>
              <button
                type="button"
                onClick={() => speakText(aiFeedback)}
                className="text-[11px] font-semibold text-blue-700 hover:underline"
              >
                🔊 Read Feedback
              </button>
            </div>
            <p className="whitespace-pre-line text-neutral-800">{aiFeedback}</p>
          </div>
        )}
      </div>

      {/* Gamified Coding Environments */}
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-graphite">
        External Gamified Practice Sandboxes
      </h4>
      <div className="grid gap-4 sm:grid-cols-3">
        {tools.map((tool) => (
          <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer">
            <Card className="h-full transition-colors hover:border-ink">
              <p className="text-xs font-medium uppercase tracking-wide text-graphite">
                {tool.role}
              </p>
              <p className="mt-2 font-display text-xl italic text-ink">{tool.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-graphite">
                {tool.description}
              </p>
              <p className="mt-4 text-xs font-medium text-ink underline decoration-line underline-offset-4">
                Launch →
              </p>
            </Card>
          </a>
        ))}
      </div>
    </Section>
  );
}
