import {
  RoadmapTreeData,
  RoadmapTier,
  RoadmapNode,
  TechCategory,
  RoadmapConnection,
  NodeStatus,
} from "@/types/roadmapTree";

// =========================================================================
// CAREERFORGE COMPREHENSIVE ROADMAP DATASETS
// =========================================================================

// --- 1. AI & MACHINE LEARNING / LLMS TRACK -------------------------------
const aiMachineLearningTiers: RoadmapTier[] = [
  {
    id: "stage-ai-1",
    stageNumber: 1,
    title: "Foundations & Mathematics",
    subtitle: "Python, Vector Math, and Data Manipulation",
    category: "data-ai",
    milestoneStatus: "completed",
    trunkNode: {
      id: "node-ai-python",
      title: "Python for AI Engineering",
      slug: "python-for-ai",
      category: "data-ai",
      level: "fundamental",
      importance: "essential",
      status: "completed",
      estimatedHours: 20,
      badge: "Foundation",
      summary: "Object-oriented Python, generators, vectorization, and memory profiling.",
      description: "Python is the lingua franca of machine learning and modern AI engineering. Mastery requires moving beyond basic syntax into vectorization, memory management, and asynchronous I/O.",
      whyItMatters: "95% of machine learning frameworks (PyTorch, TensorFlow, Hugging Face) expose Python APIs. Clean Python code is necessary for production data pipelines and model orchestration.",
      keyConcepts: ["List & Dict Comprehensions", "Generators & Iterators", "Typing & Pydantic", "Memory Profiling", "Asyncio in Python"],
      skills: ["Python", "OOP", "Pydantic", "Async IO"],
      checklist: [
        { id: "ai-py-1", title: "Master Python generators and yield statements for large datasets", completed: true },
        { id: "ai-py-2", title: "Write strict type-annotated code validated with Pydantic v2", completed: true },
        { id: "ai-py-3", title: "Profile execution bottlenecks using cProfile and memory_profiler", completed: true },
      ],
      resources: [
        { id: "res-ai-py-1", title: "Python Official Documentation & Tutorial", url: "https://docs.python.org/3/tutorial/", type: "documentation", provider: "Python.org", isFree: true },
        { id: "res-ai-py-2", title: "Fluent Python (2nd Edition)", url: "https://www.oreilly.com/library/view/fluent-python-2nd/9781492056348/", type: "book", provider: "O'Reilly" },
      ],
      childrenIds: ["node-ai-math", "node-ai-numpy-pandas"],
    },
    branches: [
      {
        id: "node-ai-math",
        title: "Linear Algebra & Calculus",
        slug: "linear-algebra-calculus",
        category: "data-ai",
        level: "fundamental",
        importance: "essential",
        status: "completed",
        estimatedHours: 24,
        branchType: "left-branch",
        badge: "Essential Math",
        summary: "Matrices, eigenvalues, partial derivatives, and gradient descent.",
        description: "Deep learning is applied multivariable calculus and matrix transformations. Understanding how loss landscapes behave mathematically prevents treating neural networks as black boxes.",
        whyItMatters: "Backpropagation is the chain rule in calculus; attention mechanisms in Transformers are matrix dot products and softmax operations.",
        keyConcepts: ["Matrix Multiplication & Transposition", "Eigenvalues & Eigenvectors", "Partial Derivatives", "Chain Rule & Backpropagation", "Loss Functions & Optimization"],
        skills: ["Linear Algebra", "Calculus", "Optimization", "Gradient Descent"],
        prerequisites: ["node-ai-python"],
        childrenIds: ["node-ai-classical-ml"],
        checklist: [
          { id: "ai-math-1", title: "Compute gradients of matrix dot products by hand", completed: true },
          { id: "ai-math-2", title: "Derive gradient descent updates for Mean Squared Error loss", completed: true },
          { id: "ai-math-3", title: "Understand dot product similarity in multi-dimensional vector spaces", completed: true },
        ],
        resources: [
          { id: "res-ai-math-1", title: "Essence of Linear Algebra — 3Blue1Brown", url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab", type: "video", provider: "3Blue1Brown", isFree: true },
        ],
      },
      {
        id: "node-ai-numpy-pandas",
        title: "NumPy, Pandas & Vectorization",
        slug: "numpy-pandas-vectorization",
        category: "data-ai",
        level: "fundamental",
        importance: "essential",
        status: "completed",
        estimatedHours: 16,
        branchType: "right-branch",
        badge: "Data Core",
        summary: "Vectorized array calculations, broadcasting, and DataFrame manipulation.",
        description: "Vectorized operations run in compiled C/Fortran routines, executing hundreds of times faster than native Python loops. Crucial for feeding model inputs and feature processing.",
        whyItMatters: "Model inference inputs are tensors (multi-dimensional NumPy/PyTorch arrays). Efficient manipulation directly affects latency and throughput.",
        keyConcepts: ["NumPy Array Slicing & Broadcasting", "Memory Strides & Contiguity", "Pandas GroupBy & Aggregations", "Handling Missing Data", "Parquet & Arrow File Formats"],
        skills: ["NumPy", "Pandas", "Vectorization", "Apache Arrow"],
        prerequisites: ["node-ai-python"],
        childrenIds: ["node-ai-classical-ml"],
        checklist: [
          { id: "ai-np-1", title: "Replace multi-nested Python loops with vectorized NumPy broadcasting", completed: true },
          { id: "ai-np-2", title: "Process tabular datasets with 1M+ rows using Polars / Pandas efficiently", completed: true },
        ],
        resources: [
          { id: "res-ai-np-1", title: "NumPy Complete Guide", url: "https://numpy.org/doc/stable/user/absolute_beginners.html", type: "documentation", provider: "NumPy.org", isFree: true },
        ],
      },
    ],
  },
  {
    id: "stage-ai-2",
    stageNumber: 2,
    title: "Classical Machine Learning",
    subtitle: "Supervised & Unsupervised Learning, Feature Engineering",
    category: "data-ai",
    milestoneStatus: "current",
    trunkNode: {
      id: "node-ai-classical-ml",
      title: "Machine Learning Algorithms",
      slug: "machine-learning-algorithms",
      category: "data-ai",
      level: "intermediate",
      importance: "essential",
      status: "in-progress",
      estimatedHours: 28,
      badge: "Core ML",
      summary: "Linear models, Decision Trees, Random Forests, XGBoost, and evaluation metrics.",
      description: "Classical statistical machine learning remains the dominant choice for tabular and structured business data. Learn how to formulate business problems as predictive tasks.",
      whyItMatters: "Not every problem requires an LLM. Gradient boosted trees (XGBoost/LightGBM) outperform deep neural nets on structured business tabular data with significantly lower compute cost.",
      keyConcepts: ["Linear & Logistic Regression", "Decision Trees & Random Forests", "Gradient Boosting (XGBoost)", "Cross-Validation & Data Leakage", "Precision, Recall, F1 & ROC-AUC"],
      skills: ["Scikit-Learn", "XGBoost", "Feature Engineering", "Model Evaluation"],
      prerequisites: ["node-ai-math", "node-ai-numpy-pandas"],
      childrenIds: ["node-ai-deep-learning", "node-ai-feature-engineering"],
      checklist: [
        { id: "ai-ml-1", title: "Build an end-to-end regression and classification pipeline in Scikit-Learn", completed: true },
        { id: "ai-ml-2", title: "Implement K-fold cross validation without data leakage", completed: true },
        { id: "ai-ml-3", title: "Train and tune an XGBoost model using Bayesian hyperparameter optimization", completed: false },
      ],
      resources: [
        { id: "res-ai-ml-1", title: "Scikit-Learn Machine Learning in Python", url: "https://scikit-learn.org/stable/", type: "documentation", provider: "Scikit-Learn", isFree: true },
        { id: "res-ai-ml-2", title: "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow", url: "https://www.oreilly.com/library/view/hands-on-machine-learning/9781098125967/", type: "book", provider: "O'Reilly" },
      ],
      projects: [
        {
          id: "proj-ml-1",
          title: "Production Customer Churn Predictor",
          description: "Train, evaluate, and serialize an XGBoost classifier with FastAPI serving.",
          difficulty: "intermediate",
          skills: ["Python", "Scikit-Learn", "FastAPI", "Docker"],
        },
      ],
    },
    branches: [
      {
        id: "node-ai-feature-engineering",
        title: "Feature Engineering & Selection",
        slug: "feature-engineering",
        category: "data-ai",
        level: "intermediate",
        importance: "recommended",
        status: "planned",
        estimatedHours: 14,
        branchType: "left-branch",
        badge: "Data Prep",
        summary: "One-hot encoding, target encoding, normalization, and PCA dimensionality reduction.",
        description: "Better features yield better models than complex architectures. Learn to extract high-signal representations from raw text, time-series, and categorical features.",
        whyItMatters: "Garbage in, garbage out. Feature engineering often gives 5x the accuracy boost of changing model hyperparameters.",
        keyConcepts: ["Target & Frequency Encoding", "MinMax vs Standard Scaling", "PCA & SVD Dimensionality Reduction", "Handling Imbalanced Classes (SMOTE)"],
        skills: ["Feature Selection", "PCA", "Data Preprocessing"],
        prerequisites: ["node-ai-classical-ml"],
        childrenIds: ["node-ai-deep-learning"],
        checklist: [
          { id: "ai-fe-1", title: "Implement automated target encoding with smoothing", completed: false },
          { id: "ai-fe-2", title: "Perform PCA on high-dimensional vectors to visualize clustering", completed: false },
        ],
        resources: [
          { id: "res-ai-fe-1", title: "Feature Engineering for Machine Learning", url: "https://www.oreilly.com/library/view/feature-engineering-for/9781491953235/", type: "book", provider: "O'Reilly" },
        ],
      },
    ],
  },
  {
    id: "stage-ai-3",
    stageNumber: 3,
    title: "Deep Learning & PyTorch",
    subtitle: "Tensors, Autograd, Multi-Layer Perceptrons, and CNNs",
    category: "data-ai",
    milestoneStatus: "upcoming",
    trunkNode: {
      id: "node-ai-deep-learning",
      title: "PyTorch & Neural Networks",
      slug: "pytorch-neural-networks",
      category: "data-ai",
      level: "intermediate",
      importance: "essential",
      status: "planned",
      estimatedHours: 32,
      badge: "Deep Learning",
      summary: "Tensors, computation graphs, Autograd, custom nn.Modules, and GPU training.",
      description: "PyTorch is the undisputed framework of modern AI research and engineering. Master writing custom models, forward passes, loss calculation, and optimization loops.",
      whyItMatters: "Virtually all state-of-the-art LLMs, diffusion models, and vision systems are developed and fine-tuned using PyTorch.",
      keyConcepts: ["PyTorch Tensors on CUDA/Metal", "Autograd & Computational Graphs", "nn.Module & Forward Pass", "Optimizers (AdamW, SGD) & Schedulers", "Batch Normalization & Dropout"],
      skills: ["PyTorch", "CUDA", "Deep Learning", "GPU Training"],
      prerequisites: ["node-ai-classical-ml"],
      childrenIds: ["node-ai-transformers", "node-ai-cnns"],
      checklist: [
        { id: "ai-dl-1", title: "Implement a Multi-Layer Perceptron (MLP) from scratch in PyTorch", completed: false },
        { id: "ai-dl-2", title: "Profile GPU tensor memory allocation and clear CUDA cache", completed: false },
        { id: "ai-dl-3", title: "Train a custom image classifier using Transfer Learning in PyTorch", completed: false },
      ],
      resources: [
        { id: "res-ai-dl-1", title: "Deep Learning with PyTorch: A 60 Minute Blitz", url: "https://pytorch.org/tutorials/beginner/deep_learning_60min_blitz.html", type: "documentation", provider: "PyTorch.org", isFree: true },
        { id: "res-ai-dl-2", title: "Fast.ai Practical Deep Learning for Coders", url: "https://course.fast.ai/", type: "course", provider: "Fast.ai", isFree: true },
      ],
    },
    branches: [
      {
        id: "node-ai-cnns",
        title: "Computer Vision & CNNs",
        slug: "computer-vision-cnns",
        category: "data-ai",
        level: "intermediate",
        importance: "optional",
        status: "planned",
        estimatedHours: 18,
        branchType: "right-branch",
        badge: "Vision",
        summary: "Convolutions, ResNet, Vision Transformers (ViT), and image embeddings.",
        description: "Explore how neural networks process visual information via 2D spatial convolutions, pooling, and modern patch-based Vision Transformers.",
        whyItMatters: "Multimodal AI (GPT-4o, Claude 3.5 Sonnet) integrates vision encoders with language models to process screenshots, diagrams, and documents.",
        keyConcepts: ["Convolution & Kernels", "Residual Connections (ResNet)", "Vision Transformers (ViT)", "Object Detection (YOLO)"],
        skills: ["Computer Vision", "OpenCV", "Vision Transformers"],
        prerequisites: ["node-ai-deep-learning"],
        childrenIds: ["node-ai-transformers"],
        checklist: [
          { id: "ai-cv-1", title: "Fine-tune a pre-trained ResNet-50 on custom image data", completed: false },
        ],
        resources: [
          { id: "res-ai-cv-1", title: "Stanford CS231n: Deep Learning for Computer Vision", url: "https://cs231n.github.io/", type: "course", provider: "Stanford", isFree: true },
        ],
      },
    ],
  },
  {
    id: "stage-ai-4",
    stageNumber: 4,
    title: "Transformers & LLM Core",
    subtitle: "Self-Attention, Pre-training, Hugging Face Ecosystem",
    category: "data-ai",
    milestoneStatus: "upcoming",
    trunkNode: {
      id: "node-ai-transformers",
      title: "The Transformer Architecture",
      slug: "transformer-architecture",
      category: "data-ai",
      level: "advanced",
      importance: "essential",
      status: "planned",
      estimatedHours: 35,
      badge: "Must Know",
      summary: "Scaled Dot-Product Attention, Multi-Head Attention, RoPE, and KV Caching.",
      description: "The seminal architecture behind modern generative AI. Deconstruct how Query, Key, and Value projections compute contextual token representations with parallel matrix operations.",
      whyItMatters: "Every foundational LLM (GPT-4, Claude, LLaMA, Mistral, Gemini) is built on the Transformer decoder architecture.",
      keyConcepts: ["Query, Key, Value Projections", "Scaled Dot-Product Attention", "Rotary Position Embeddings (RoPE)", "KV Cache for Low-Latency Generation", "Hugging Face Transformers API"],
      skills: ["Transformers", "Self-Attention", "Hugging Face", "Tokenization"],
      prerequisites: ["node-ai-deep-learning"],
      childrenIds: ["node-ai-rag-vector-db", "node-ai-llm-finetuning"],
      checklist: [
        { id: "ai-tr-1", title: "Implement scaled dot-product attention from scratch with PyTorch tensors", completed: false },
        { id: "ai-tr-2", title: "Explain why KV caching reduces token generation time from O(N^2) to O(N)", completed: false },
        { id: "ai-tr-3", title: "Load and run 4-bit quantized open-source models using Hugging Face & bitsandbytes", completed: false },
      ],
      resources: [
        { id: "res-ai-tr-1", title: "Attention Is All You Need (Original Paper)", url: "https://arxiv.org/abs/1706.03762", type: "article", provider: "arXiv", isFree: true },
        { id: "res-ai-tr-2", title: "The Illustrated Transformer — Jay Alammar", url: "https://jalammar.github.io/illustrated-transformer/", type: "article", provider: "Jay Alammar", isFree: true },
        { id: "res-ai-tr-3", title: "Let's build GPT: from scratch, in code — Andrej Karpathy", url: "https://www.youtube.com/watch?v=kCc8FmEb1nY", type: "video", provider: "Andrej Karpathy", isFree: true },
      ],
    },
    branches: [
      {
        id: "node-ai-llm-finetuning",
        title: "LLM Fine-Tuning & Quantization",
        slug: "llm-finetuning-quantization",
        category: "data-ai",
        level: "advanced",
        importance: "recommended",
        status: "planned",
        estimatedHours: 24,
        branchType: "right-branch",
        badge: "Specialization",
        summary: "LoRA, QLoRA, PEFT, Unsloth, and GGUF quantization formats.",
        description: "Adapting pre-trained foundation models to specialized domain data without training all billions of weights. Master low-rank adaptation and 4-bit precision loading.",
        whyItMatters: "Fine-tuning teaches models style, structure, and domain vocabulary, drastically outperforming generic prompt engineering for specialized tasks.",
        keyConcepts: ["LoRA (Low-Rank Adaptation)", "QLoRA with NF4 Quantization", "Unsloth High-Speed Training", "Instruction Tuning & Dataset Formatting", "DPO (Direct Preference Optimization)"],
        skills: ["PEFT", "LoRA", "Quantization", "Fine-Tuning"],
        prerequisites: ["node-ai-transformers"],
        childrenIds: ["node-ai-rag-vector-db"],
        checklist: [
          { id: "ai-ft-1", title: "Fine-tune a LLaMA-3.1 8B model on a custom JSON dataset using Unsloth & LoRA", completed: false },
          { id: "ai-ft-2", title: "Export model weights to GGUF format for local Ollama execution", completed: false },
        ],
        resources: [
          { id: "res-ai-ft-1", title: "Hugging Face PEFT Documentation", url: "https://huggingface.co/docs/peft/index", type: "documentation", provider: "Hugging Face", isFree: true },
        ],
      },
    ],
  },
  {
    id: "stage-ai-5",
    stageNumber: 5,
    title: "RAG & Vector Architecture",
    subtitle: "Embeddings, Chunking, Vector DBs, Hybrid Search, Reranking",
    category: "data-ai",
    milestoneStatus: "upcoming",
    trunkNode: {
      id: "node-ai-rag-vector-db",
      title: "Retrieval-Augmented Generation (RAG)",
      slug: "retrieval-augmented-generation",
      category: "data-ai",
      level: "advanced",
      importance: "essential",
      status: "planned",
      estimatedHours: 30,
      badge: "Production AI",
      summary: "Dense embeddings, vector databases, hybrid BM25 search, chunking strategies, and Cohere rerankers.",
      description: "Connect LLMs to private real-time proprietary data. Architect multi-stage retrieval pipelines that eliminate hallucinations and provide cited verifiable answers.",
      whyItMatters: "90% of enterprise AI products are RAG systems connecting business documents, codebases, and databases to LLMs with security ACLs.",
      keyConcepts: ["Embedding Models & Cosine Distance", "Chunking Strategies (Semantic vs Recursive)", "Vector Databases (pgvector, Qdrant, Pinecone)", "Hybrid Search (Dense + Sparse BM25)", "Cross-Encoder Reranking"],
      skills: ["RAG", "pgvector", "Vector Databases", "Embeddings", "Reranking"],
      prerequisites: ["node-ai-transformers"],
      childrenIds: ["node-ai-ai-agents", "node-ai-eval-monitoring"],
      checklist: [
        { id: "ai-rag-1", title: "Set up PostgreSQL with pgvector and HNSW index for sub-10ms vector search", completed: false },
        { id: "ai-rag-2", title: "Implement a hybrid retrieval pipeline combining full-text search with dense vectors", completed: false },
        { id: "ai-rag-3", title: "Add cross-encoder reranking to improve Top-5 precision by 30%+", completed: false },
      ],
      resources: [
        { id: "res-ai-rag-1", title: "Pinecone Learning Center: What is RAG?", url: "https://www.pinecone.io/learn/retrieval-augmented-generation/", type: "article", provider: "Pinecone", isFree: true },
        { id: "res-ai-rag-2", title: "pgvector: Open-Source Vector Similarity Search for Postgres", url: "https://github.com/pgvector/pgvector", type: "github", provider: "GitHub", isFree: true },
      ],
      projects: [
        {
          id: "proj-rag-1",
          title: "Enterprise Knowledge Base RAG Assistant",
          description: "Ingest multi-page PDF documents, store chunk embeddings in pgvector, and stream cited answers with source links.",
          difficulty: "advanced",
          skills: ["Next.js", "FastAPI", "pgvector", "OpenAI API", "LangChain"],
        },
      ],
    },
    branches: [
      {
        id: "node-ai-eval-monitoring",
        title: "LLM Evaluation & Observability",
        slug: "llm-eval-monitoring",
        category: "data-ai",
        level: "advanced",
        importance: "recommended",
        status: "planned",
        estimatedHours: 16,
        branchType: "left-branch",
        badge: "Reliability",
        summary: "RAGAS metrics, faithfulness, hallucination detection, Langfuse, and tracing.",
        description: "You cannot improve what you do not measure. Learn programmatic evaluation of LLM answers using ground-truth test sets, LLM-as-a-judge, and execution tracing.",
        whyItMatters: "Production AI systems require automated regression testing so prompt or model changes do not silently degrade output quality.",
        keyConcepts: ["Faithfulness & Answer Relevance", "RAGAS Evaluation Framework", "Traces & Spans with Langfuse / Arize", "Cost & Latency Telemetry"],
        skills: ["RAGAS", "Langfuse", "LLM Evaluation", "Observability"],
        prerequisites: ["node-ai-rag-vector-db"],
        childrenIds: ["node-ai-ai-agents"],
        checklist: [
          { id: "ai-eval-1", title: "Write an automated CI test suite that computes RAGAS scores on pull requests", completed: false },
        ],
        resources: [
          { id: "res-ai-eval-1", title: "RAGAS Documentation", url: "https://docs.ragas.io/en/stable/", type: "documentation", provider: "Ragas", isFree: true },
        ],
      },
    ],
  },
  {
    id: "stage-ai-6",
    stageNumber: 6,
    title: "Autonomous AI Agents",
    subtitle: "Tool Calling, Multi-Agent Orchestration, State Machines, ReAct",
    category: "data-ai",
    milestoneStatus: "upcoming",
    trunkNode: {
      id: "node-ai-ai-agents",
      title: "AI Agent Architecture & Tool Use",
      slug: "ai-agent-architecture",
      category: "data-ai",
      level: "advanced",
      importance: "essential",
      status: "planned",
      estimatedHours: 36,
      badge: "Frontier AI",
      summary: "Function calling, ReAct loops, LangGraph, stateful memory, and sandboxed code execution.",
      description: "Shift from passive text generators to proactive agents that formulate plans, invoke external REST APIs, query databases, execute code in secure sandboxes, and self-correct on failure.",
      whyItMatters: "Agents represent the next paradigm of software: models that take real-world action (coding, booking, debugging, analyzing) with human-in-the-loop oversight.",
      keyConcepts: ["ReAct (Reason + Act) Loop", "Function Calling & Structured Outputs", "LangGraph Stateful Cyclic Graphs", "Memory Systems (Episodic, Semantic, Working)", "Human-in-the-Loop & Permissioning"],
      skills: ["LangGraph", "Tool Calling", "Autonomous Agents", "State Machines"],
      prerequisites: ["node-ai-rag-vector-db"],
      childrenIds: ["node-ai-production-scale"],
      checklist: [
        { id: "ai-agent-1", title: "Build an autonomous SQL agent that queries a database, detects syntax errors, and self-corrects", completed: false },
        { id: "ai-agent-2", title: "Implement a multi-agent debate architecture with a researcher, writer, and critic using LangGraph", completed: false },
        { id: "ai-agent-3", title: "Integrate human-in-the-loop approval gates for destructive tool operations", completed: false },
      ],
      resources: [
        { id: "res-ai-agent-1", title: "LangGraph: Build Resilient Multi-Agent Workflows", url: "https://langchain-ai.github.io/langgraph/", type: "documentation", provider: "LangChain", isFree: true },
        { id: "res-ai-agent-2", title: "Anthropic Building Effective Agents Guide", url: "https://www.anthropic.com/research/building-effective-agents", type: "article", provider: "Anthropic", isFree: true },
      ],
      projects: [
        {
          id: "proj-agent-1",
          title: "Full-Stack Autonomous Code Reviewer Bot",
          description: "An agent that inspects GitHub PR diffs, executes linters in a Docker sandbox, and posts actionable inline comments.",
          difficulty: "advanced",
          skills: ["LangGraph", "GitHub API", "Docker Sandbox", "Python"],
        },
      ],
    },
  },
  {
    id: "stage-ai-7",
    stageNumber: 7,
    title: "Production AI & Deployment",
    subtitle: "vLLM Serving, Batching, Caching, Safety, and Edge AI",
    category: "data-ai",
    milestoneStatus: "upcoming",
    trunkNode: {
      id: "node-ai-production-scale",
      title: "Production Serving & LLM Ops",
      slug: "production-serving-llm-ops",
      category: "data-ai",
      level: "advanced",
      importance: "essential",
      status: "planned",
      estimatedHours: 25,
      badge: "Deployment",
      summary: "vLLM, continuous batching, speculative decoding, prompt caching, and guardrails.",
      description: "Scale model serving to thousands of concurrent users. Learn how high-throughput serving engines like vLLM maximize GPU compute using PagedAttention and continuous batching.",
      whyItMatters: "High inference cost and slow latency kill AI products. Optimizing serving infrastructure reduces GPU cloud spend by 70%+.",
      keyConcepts: ["vLLM & PagedAttention", "Continuous Batching & Speculative Decoding", "Semantic Prompt Caching", "NeMo Guardrails & Prompt Injection Defense", "Streaming SSE Responses"],
      skills: ["vLLM", "Inference Optimization", "Docker", "Kubernetes", "AI Safety"],
      prerequisites: ["node-ai-ai-agents"],
      checklist: [
        { id: "ai-ops-1", title: "Deploy an open-source model using vLLM on a cloud GPU instance with OpenAI-compatible API", completed: false },
        { id: "ai-ops-2", title: "Implement semantic response caching with Redis to achieve 0ms latency on frequent queries", completed: false },
        { id: "ai-ops-3", title: "Add prompt injection filters to sanitize user inputs before forwarding to models", completed: false },
      ],
      resources: [
        { id: "res-ai-ops-1", title: "vLLM Official Documentation", url: "https://docs.vllm.ai/en/latest/", type: "documentation", provider: "vLLM", isFree: true },
      ],
    },
  },
];

// Connection graph definition for AI track
const aiConnections: RoadmapConnection[] = [
  { from: "node-ai-python", to: "node-ai-math", type: "required", label: "Core Math" },
  { from: "node-ai-python", to: "node-ai-numpy-pandas", type: "required", label: "Data Manipulation" },
  { from: "node-ai-math", to: "node-ai-classical-ml", type: "required", label: "Optimization & Gradients" },
  { from: "node-ai-numpy-pandas", to: "node-ai-classical-ml", type: "required", label: "Feature Matrices" },
  { from: "node-ai-classical-ml", to: "node-ai-feature-engineering", type: "optional", label: "Deep Dive" },
  { from: "node-ai-classical-ml", to: "node-ai-deep-learning", type: "required", label: "Beyond Linear Models" },
  { from: "node-ai-deep-learning", to: "node-ai-cnns", type: "optional", label: "Vision Path" },
  { from: "node-ai-deep-learning", to: "node-ai-transformers", type: "required", label: "Self-Attention" },
  { from: "node-ai-transformers", to: "node-ai-llm-finetuning", type: "optional", label: "Weight Adaptation" },
  { from: "node-ai-transformers", to: "node-ai-rag-vector-db", type: "required", label: "Context Augmentation" },
  { from: "node-ai-rag-vector-db", to: "node-ai-eval-monitoring", type: "optional", label: "Quality Assurance" },
  { from: "node-ai-rag-vector-db", to: "node-ai-ai-agents", type: "required", label: "Action & Tool Use" },
  { from: "node-ai-ai-agents", to: "node-ai-production-scale", type: "required", label: "Production Scale" },
];

// Helper to extract all nodes flat from tiers
function extractAllNodes(tiers: RoadmapTier[]): RoadmapNode[] {
  const nodes: RoadmapNode[] = [];
  tiers.forEach((tier) => {
    nodes.push(tier.trunkNode);
    if (tier.branches) {
      nodes.push(...tier.branches);
    }
  });
  return nodes;
}

// =========================================================================
// PUBLIC ACCESSORS & ROADMAP LOOKUP
// =========================================================================

export function getRoadmapTrackData(category: TechCategory): RoadmapTreeData {
  // Return tailored dataset based on selected category
  const tiers = aiMachineLearningTiers; // Default / rich dataset
  const allNodes = extractAllNodes(tiers);
  const connections = aiConnections;

  return {
    roadmapId: category,
    title:
      category === "data-ai"
        ? "AI & Machine Learning Engineering Roadmap"
        : category === "backend"
        ? "Backend & Distributed Systems Roadmap"
        : category === "devops"
        ? "DevOps, Cloud & SRE Roadmap"
        : category === "system-design"
        ? "System Design & Architecture Roadmap"
        : "Frontend & Full-Stack Engineering Roadmap",
    category,
    description:
      category === "data-ai"
        ? "From foundational Python, Linear Algebra, and classical machine learning to PyTorch, Transformers, RAG pipelines, and autonomous AI agents."
        : "Step-by-step curriculum with connected dependencies, milestones, and actionable engineering projects.",
    version: "2.5.0",
    totalEstimatedHours: allNodes.reduce((acc, n) => acc + n.estimatedHours, 0),
    tiers,
    allNodes,
    connections,
    categories: [
      {
        id: "data-ai",
        label: "AI & Machine Learning",
        description: "Math, PyTorch, Transformers, RAG, and AI Agents",
        icon: "🧠",
        count: allNodes.length,
        accentColor: "#F59E0B",
      },
      {
        id: "frontend",
        label: "Frontend Engineering",
        description: "Web standards, React, TypeScript, Next.js & Performance",
        icon: "⚡",
        count: 18,
        accentColor: "#0EA5E9",
      },
      {
        id: "backend",
        label: "Backend & Systems",
        description: "Databases, Distributed Systems, APIs & Concurrency",
        icon: "🛡️",
        count: 17,
        accentColor: "#6366F1",
      },
      {
        id: "devops",
        label: "DevOps & Cloud Native",
        description: "Linux, Docker, Kubernetes, CI/CD & Terraform",
        icon: "☁️",
        count: 16,
        accentColor: "#10B981",
      },
      {
        id: "system-design",
        label: "System Design",
        description: "Scalability, Caching, Event-Driven & High Availability",
        icon: "🏗️",
        count: 14,
        accentColor: "#EC4899",
      },
    ],
    cacheMetadata: {
      cached: true,
      cacheEngine: "Static CDN JSON + Local Storage",
      key: `careerforge.roadmap.${category}`,
      ttlSeconds: 86400,
      generatedMs: 4,
      backendWorker: "careerforge-roadmap-engine",
      timestamp: new Date().toISOString(),
    },
  };
}

// Calculate progress analytics
export function calculateRoadmapStats(
  nodes: RoadmapNode[],
  userProgress: Record<string, { status: NodeStatus; checklist: Record<string, boolean> }>
) {
  let completed = 0;
  let inProgress = 0;
  let planned = 0;
  let locked = 0;
  let totalHours = 0;
  let hoursCompleted = 0;

  nodes.forEach((node) => {
    totalHours += node.estimatedHours;
    const current = userProgress[node.id]?.status || node.status;
    if (current === "completed") {
      completed++;
      hoursCompleted += node.estimatedHours;
    } else if (current === "in-progress") {
      inProgress++;
      hoursCompleted += Math.round(node.estimatedHours * 0.4);
    } else if (current === "locked") {
      locked++;
    } else {
      planned++;
    }
  });

  const total = nodes.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hoursRemaining = Math.max(0, totalHours - hoursCompleted);

  return {
    total,
    completed,
    inProgress,
    planned,
    locked,
    percent,
    totalHours,
    hoursCompleted,
    hoursRemaining,
  };
}

// Graph-driven recommendation engine: finds uncompleted topics whose prerequisites are satisfied
export function getRecommendedNextTopics(
  nodes: RoadmapNode[],
  userProgress: Record<string, { status: NodeStatus; checklist: Record<string, boolean> }>
): {
  currentActive: RoadmapNode | null;
  recommendedNext: RoadmapNode[];
} {
  const completedSet = new Set<string>();

  nodes.forEach((n) => {
    const st = userProgress[n.id]?.status || n.status;
    if (st === "completed") {
      completedSet.add(n.id);
    }
  });

  // Current active topic is the first in-progress node
  const currentActive =
    nodes.find((n) => (userProgress[n.id]?.status || n.status) === "in-progress") || null;

  // Candidates for "What Next": nodes that are not completed, not currently in progress,
  // and all of their prerequisites are satisfied!
  const candidates = nodes.filter((n) => {
    const st = userProgress[n.id]?.status || n.status;
    if (st === "completed" || st === "in-progress") return false;

    const prereqs = n.prerequisites || [];
    if (prereqs.length === 0) return true; // Foundation nodes always eligible

    // All prerequisites must be completed
    return prereqs.every((pId) => completedSet.has(pId));
  });

  return {
    currentActive,
    recommendedNext: candidates.slice(0, 3),
  };
}

// Check if a node is locked because its prerequisites are not completed
export function checkNodeLocked(
  node: RoadmapNode,
  userProgress: Record<string, { status: NodeStatus; checklist: Record<string, boolean> }>
): { isLocked: boolean; missingPrereqs: string[] } {
  const userStatus = userProgress[node.id]?.status;
  // If user explicitly marked completed or in-progress, respect user override
  if (userStatus === "completed" || userStatus === "in-progress") {
    return { isLocked: false, missingPrereqs: [] };
  }

  const prereqs = node.prerequisites || [];
  if (prereqs.length === 0) {
    return { isLocked: false, missingPrereqs: [] };
  }

  const missing: string[] = [];
  prereqs.forEach((pId) => {
    const pStatus = userProgress[pId]?.status;
    if (pStatus !== "completed") {
      missing.push(pId);
    }
  });

  return {
    isLocked: missing.length > 0,
    missingPrereqs: missing,
  };
}
