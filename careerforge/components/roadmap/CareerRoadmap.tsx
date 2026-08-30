"use client";

import { useState, useEffect } from "react";
import { Section } from "@/components/ui/Section";
import { roadmaps, roleOptions, courseCatalog, roleGitHubProjects } from "@/lib/data";
import { RoleId, Course, GitHubProject } from "@/lib/types";
import { Card, Tag } from "@/components/ui/Primitives";

// Comprehensive topic research resources (Blogs, Books, Video Playlists)
interface StepResource {
  blogs: { title: string; source: string; url: string; timeToRead: string }[];
  book: { title: string; author: string; summary: string; url: string };
  youtube: { title: string; channel: string; url: string; duration: string }[];
  udemy: { title: string; rating: number; level: string; url: string };
  coursera: { title: string; rating: number; certBy: string; url: string };
}

const stepResourcesByRole: Record<RoleId, Record<number, StepResource>> = {
  frontend: {
    0: {
      blogs: [
        { title: "JavaScript Fundamentals & Deep Scope", source: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", timeToRead: "15 min read" },
        { title: "The Modern JavaScript Handbook", source: "freeCodeCamp", url: "https://www.freecodecamp.org/news/the-complete-javascript-handbook/", timeToRead: "25 min read" },
        { title: "Deep Dive into Modern CSS Layouts & Grid", source: "CSS-Tricks", url: "https://css-tricks.com/snippets/css/complete-guide-grid/", timeToRead: "12 min read" },
      ],
      book: {
        title: "Eloquent JavaScript (4th Edition)",
        author: "Marijn Haverbeke",
        summary: "A modern introduction to JavaScript, programming, and the wonders of the digital world.",
        url: "https://eloquentjavascript.net/",
      },
      youtube: [
        { title: "JavaScript Full Course for Beginners", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=PkZNo7MFNFg", duration: "3.5 hrs" },
        { title: "Modern JavaScript Tutorial Playlist", channel: "The Net Ninja", url: "https://www.youtube.com/playlist?list=PL4cUxeGkcC9haFPT7J25Q9GRB_ZAtZuVM", duration: "Playlist" },
      ],
      udemy: { title: "The Complete JavaScript Course 2026: From Zero to Expert!", rating: 4.8, level: "Beginner to Advanced", url: "https://www.udemy.com/course/the-complete-javascript-course/" },
      coursera: { title: "Meta Front-End Developer Specialization", rating: 4.7, certBy: "Meta", url: "https://www.coursera.org/professional-certificates/meta-front-end-developer" },
    },
    1: {
      blogs: [
        { title: "A Complete Guide to React Component Architecture", source: "React.dev", url: "https://react.dev/learn", timeToRead: "20 min read" },
        { title: "React State Management in 2026", source: "Kent C. Dodds Blog", url: "https://kentcdodds.com/blog", timeToRead: "10 min read" },
      ],
      book: {
        title: "Learning React: Modern Patterns for Developing React Apps",
        author: "Alex Banks & Eve Porcello",
        summary: "Master component-driven architecture, hooks, state management, and declarative UI patterns.",
        url: "https://www.oreilly.com/library/view/learning-react-2nd/9781492051718/",
      },
      youtube: [
        { title: "React 19 & Next.js Full Course", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=bMknfKXIFA8", duration: "5 hrs" },
      ],
      udemy: { title: "React - The Complete Guide (incl Hooks, React Router, Redux)", rating: 4.7, level: "Intermediate", url: "https://www.udemy.com/course/react-the-complete-guide-incl-redux/" },
      coursera: { title: "Front-End Web Development with React", rating: 4.7, certBy: "HKUST", url: "https://www.coursera.org/learn/front-end-react" },
    },
    2: {
      blogs: [
        { title: "TypeScript in 50 Lessons — Types & Generics", source: "TypeScript Official", url: "https://www.typescriptlang.org/docs/", timeToRead: "18 min read" },
        { title: "Effective TypeScript Patterns in Production", source: "Dan Vanderkam Blog", url: "https://effectivetypescript.com/", timeToRead: "14 min read" },
      ],
      book: {
        title: "Effective TypeScript: 62 Specific Ways to Improve Your TypeScript",
        author: "Dan Vanderkam",
        summary: "Guide to building bulletproof web applications with type safety and advanced generics.",
        url: "https://effectivetypescript.com/",
      },
      youtube: [
        { title: "TypeScript Course for Beginners", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=BwuLxPH8IDs", duration: "1.5 hrs" },
      ],
      udemy: { title: "Understanding TypeScript", rating: 4.8, level: "All Levels", url: "https://www.udemy.com/course/understanding-typescript/" },
      coursera: { title: "Programming with JavaScript & TypeScript", rating: 4.6, certBy: "Meta", url: "https://www.coursera.org/learn/programming-with-javascript" },
    },
    3: {
      blogs: [
        { title: "Core Web Vitals & Web Performance Optimization", source: "web.dev by Google", url: "https://web.dev/vitals/", timeToRead: "12 min read" },
        { title: "The A11Y Project: Checklist for Web Accessibility", source: "A11Y Project", url: "https://www.a11yproject.com/checklist/", timeToRead: "10 min read" },
      ],
      book: {
        title: "High Performance Browser Networking",
        author: "Ilya Grigorik",
        summary: "What every web developer should know about networking and web performance.",
        url: "https://hpbn.co/",
      },
      youtube: [
        { title: "Web Performance & Core Web Vitals Crash Course", channel: "Google Chrome Developers", url: "https://www.youtube.com/c/GoogleChromeDevelopers", duration: "2 hrs" },
      ],
      udemy: { title: "Web Performance Masterclass: Fast Websites That Convert", rating: 4.6, level: "Advanced", url: "https://www.udemy.com/course/web-performance/" },
      coursera: { title: "Web Accessibility Compliance & WCAG", rating: 4.8, certBy: "W3Cx", url: "https://www.coursera.org/learn/web-accessibility" },
    },
    4: {
      blogs: [
        { title: "Testing JavaScript & React Applications Like a Pro", source: "Kent C. Dodds", url: "https://kentcdodds.com/blog/common-mistakes-with-react-testing-library", timeToRead: "11 min read" },
      ],
      book: {
        title: "Refactoring UI",
        author: "Adam Wathan & Steve Schoger",
        summary: "Practical design tactics for developers to build clean, professional interfaces.",
        url: "https://www.refactoringui.com/",
      },
      youtube: [
        { title: "Testing React Apps with Jest & React Testing Library", channel: "Academind", url: "https://www.youtube.com/watch?v=JBSUgDxICg8", duration: "1.5 hrs" },
      ],
      udemy: { title: "Testing React with Jest and React Testing Library", rating: 4.7, level: "Intermediate", url: "https://www.udemy.com/course/react-testing-with-jest-and-enzyme/" },
      coursera: { title: "Software Testing and Automation Specialization", rating: 4.6, certBy: "University of Minnesota", url: "https://www.coursera.org/specializations/software-testing-automation" },
    },
    5: {
      blogs: [
        { title: "Building a Production-Grade Developer Portfolio", source: "Hashnode Blog", url: "https://hashnode.com", timeToRead: "8 min read" },
      ],
      book: {
        title: "The Pragmatic Programmer: 20th Anniversary Edition",
        author: "David Thomas & Andrew Hunt",
        summary: "Your journey to mastery — writing flexible, maintainable, and robust software.",
        url: "https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/",
      },
      youtube: [
        { title: "How to Build a Full-Stack Portfolio that Gets You Hired", channel: "JavaScript Mastery", url: "https://www.youtube.com/c/JavaScriptMastery", duration: "3 hrs" },
      ],
      udemy: { title: "100 Days of Code: The Complete Web Development Bootcamp", rating: 4.7, level: "All Levels", url: "https://www.udemy.com/course/100-days-of-code/" },
      coursera: { title: "Full Stack Web Development with React Specialization", rating: 4.7, certBy: "HKUST", url: "https://www.coursera.org/specializations/full-stack-react" },
    },
  },
  backend: {
    0: {
      blogs: [
        { title: "Node.js Event Loop, Streams & Concurrency Under the Hood", source: "Node.js Official", url: "https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick", timeToRead: "15 min read" },
      ],
      book: {
        title: "Node.js Design Patterns (3rd Edition)",
        author: "Mario Casciaro & Luciano Mammino",
        summary: "Master enterprise patterns, asynchronous programming, microservices, and streaming.",
        url: "https://www.nodejsdesignpatterns.com/",
      },
      youtube: [
        { title: "Node.js and Express.js Full Course", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=Oe421EPjeBE", duration: "8 hrs" },
      ],
      udemy: { title: "The Complete Node.js Developer Course", rating: 4.7, level: "Intermediate", url: "https://www.udemy.com/course/the-complete-nodejs-developer-course-2/" },
      coursera: { title: "Server-side Development with NodeJS, Express and MongoDB", rating: 4.7, certBy: "HKUST", url: "https://www.coursera.org/learn/server-side-nodejs" },
    },
    1: {
      blogs: [
        { title: "PostgreSQL Query Optimization & Indexing Guide", source: "Use The Index, Luke", url: "https://use-the-index-luke.com/", timeToRead: "20 min read" },
      ],
      book: {
        title: "Designing Data-Intensive Applications",
        author: "Martin Kleppmann",
        summary: "The definitive guide to distributed databases, replication, partition, transactions, and stream processing.",
        url: "https://dataintensive.net/",
      },
      youtube: [
        { title: "Database Systems & SQL Deep Dive", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=HXV3zeRR3h4", duration: "4 hrs" },
      ],
      udemy: { title: "The Complete SQL Bootcamp: Go from Zero to Hero", rating: 4.7, level: "All Levels", url: "https://www.udemy.com/course/the-complete-sql-bootcamp/" },
      coursera: { title: "Databases for Data Scientists Specialization", rating: 4.6, certBy: "University of Colorado", url: "https://www.coursera.org/specializations/databases-for-data-scientists" },
    },
    2: {
      blogs: [
        { title: "REST vs GraphQL vs gRPC: Architectural Decisions", source: "Martin Fowler", url: "https://martinfowler.com/articles/richardsonMaturityModel.html", timeToRead: "14 min read" },
      ],
      book: {
        title: "RESTful Web APIs: Services for a Changing World",
        author: "Leonard Richardson & Mike Amundsen",
        summary: "Best practices for designing scalable, maintainable APIs.",
        url: "https://www.oreilly.com/library/view/restful-web-apis/9781449359713/",
      },
      youtube: [
        { title: "REST API Design & Architecture Best Practices", channel: "Amigoscode", url: "https://www.youtube.com/watch?v=-MTSQjw5DrM", duration: "2 hrs" },
      ],
      udemy: { title: "REST APIs with Flask and Python", rating: 4.6, level: "Intermediate", url: "https://www.udemy.com/course/rest-api-flask-and-python/" },
      coursera: { title: "API Design and Fundamentals of Google Cloud's Apigee API Platform", rating: 4.6, certBy: "Google Cloud", url: "https://www.coursera.org/learn/api-design-apigee" },
    },
    3: {
      blogs: [
        { title: "System Design Primer & Scalability Rules", source: "GitHub / donnemartin", url: "https://github.com/donnemartin/system-design-primer", timeToRead: "30 min read" },
      ],
      book: {
        title: "System Design Interview – An Insider's Guide",
        author: "Alex Xu",
        summary: "Step-by-step frameworks to solve real-world architectural scalability questions.",
        url: "https://bytebytego.com/",
      },
      youtube: [
        { title: "System Design for Beginners", channel: "ByteByteGo", url: "https://www.youtube.com/c/ByteByteGo", duration: "Playlist" },
      ],
      udemy: { title: "System Design Interview Prep", rating: 4.7, level: "Advanced", url: "https://www.udemy.com/course/system-design-interview-prep/" },
      coursera: { title: "Software Architecture for Big Data", rating: 4.5, certBy: "University of Toronto", url: "https://www.coursera.org/learn/software-architecture-big-data" },
    },
    4: {
      blogs: [
        { title: "OWASP Top 10 Web Application Security Vulnerabilities", source: "OWASP Foundation", url: "https://owasp.org/www-project-top-ten/", timeToRead: "18 min read" },
      ],
      book: {
        title: "Clean Architecture: A Craftsman's Guide to Software Structure",
        author: "Robert C. Martin",
        summary: "Essential rules for building maintainable, decoupled backend software systems.",
        url: "https://www.oreilly.com/library/view/clean-architecture-a/9780134494272/",
      },
      youtube: [
        { title: "Backend Security & Auth Complete Guide", channel: "Hussein Nasser", url: "https://www.youtube.com/c/HusseinNasser-software-engineering", duration: "Playlist" },
      ],
      udemy: { title: "Web Security & Ethical Hacking for Developers", rating: 4.6, level: "Intermediate", url: "https://www.udemy.com/course/web-security-for-developers/" },
      coursera: { title: "Cybersecurity Specialization", rating: 4.7, certBy: "University of Maryland", url: "https://www.coursera.org/specializations/cyber-security" },
    },
    5: {
      blogs: [
        { title: "Deploying Microservices on Kubernetes and Cloud", source: "Kubernetes.io", url: "https://kubernetes.io/docs/tutorials/", timeToRead: "20 min read" },
      ],
      book: {
        title: "Building Microservices (2nd Edition)",
        author: "Sam Newman",
        summary: "Designing fine-grained systems that scale with business needs.",
        url: "https://samnewman.io/books/building_microservices_2nd_edition/",
      },
      youtube: [
        { title: "Docker & Kubernetes Full Course", channel: "TechWorld with Nana", url: "https://www.youtube.com/c/TechWorldwithNana", duration: "4 hrs" },
      ],
      udemy: { title: "Docker & Kubernetes: The Practical Guide", rating: 4.8, level: "Intermediate", url: "https://www.udemy.com/course/docker-kubernetes-the-practical-guide/" },
      coursera: { title: "Google IT Automation with Python", rating: 4.8, certBy: "Google", url: "https://www.coursera.org/professional-certificates/google-it-automation" },
    },
  },
  data: {
    0: {
      blogs: [
        { title: "Python for Data Analysis & Pandas 101", source: "Real Python", url: "https://realpython.com/learning-paths/data-science-python-core-skills/", timeToRead: "15 min read" },
      ],
      book: {
        title: "Python for Data Analysis (3rd Edition)",
        author: "Wes McKinney (Creator of Pandas)",
        summary: "Data wrangling with Pandas, NumPy, and Jupyter notebooks.",
        url: "https://wesmckinney.com/book/",
      },
      youtube: [
        { title: "Python Data Science Tutorial", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=LHBE6Q9XlzI", duration: "12 hrs" },
      ],
      udemy: { title: "Python for Data Science and Machine Learning Bootcamp", rating: 4.6, level: "All Levels", url: "https://www.udemy.com/course/python-for-data-science-and-machine-learning-bootcamp/" },
      coursera: { title: "IBM Data Analyst Professional Certificate", rating: 4.6, certBy: "IBM", url: "https://www.coursera.org/professional-certificates/ibm-data-analyst" },
    },
    1: {
      blogs: [
        { title: "Practical Statistics for Data Scientists & A/B Testing", source: "Towards Data Science", url: "https://towardsdatascience.com", timeToRead: "14 min read" },
      ],
      book: {
        title: "Practical Statistics for Data Scientists",
        author: "Peter Bruce & Andrew Bruce",
        summary: "50+ essential concepts using R and Python.",
        url: "https://www.oreilly.com/library/view/practical-statistics-for/9781492072935/",
      },
      youtube: [
        { title: "Statistics and Probability Full Course", channel: "StatQuest with Josh Starmer", url: "https://www.youtube.com/c/joshstarmer", duration: "Playlist" },
      ],
      udemy: { title: "Statistics for Data Science and Business Analysis", rating: 4.6, level: "Beginner", url: "https://www.udemy.com/course/statistics-for-data-science-and-business-analysis/" },
      coursera: { title: "Applied Data Science with Python Specialization", rating: 4.5, certBy: "University of Michigan", url: "https://www.coursera.org/specializations/data-science-python" },
    },
    2: {
      blogs: [
        { title: "Machine Learning Roadmap & Scikit-Learn Guide", source: "Scikit-Learn.org", url: "https://scikit-learn.org/stable/user_guide.html", timeToRead: "20 min read" },
      ],
      book: {
        title: "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow",
        author: "Aurélien Géron",
        summary: "The gold standard practical textbook for machine learning and deep neural networks.",
        url: "https://www.oreilly.com/library/view/hands-on-machine-learning/9781098125967/",
      },
      youtube: [
        { title: "Machine Learning Specialization by Andrew Ng", channel: "DeepLearning.AI", url: "https://www.youtube.com/c/Deeplearningai", duration: "Playlist" },
      ],
      udemy: { title: "Machine Learning A-Z: AI, Python & R", rating: 4.6, level: "Beginner to Advanced", url: "https://www.udemy.com/course/machinelearning/" },
      coursera: { title: "Machine Learning Specialization", rating: 4.9, certBy: "DeepLearning.AI & Stanford", url: "https://www.coursera.org/specializations/machine-learning-introduction" },
    },
    3: {
      blogs: [
        { title: "Deep Learning Architectures & Transformer Attention", source: "Jay Alammar Blog", url: "https://jalammar.github.io/illustrated-transformer/", timeToRead: "22 min read" },
      ],
      book: {
        title: "Deep Learning (Adaptive Computation and Machine Learning)",
        author: "Ian Goodfellow, Yoshua Bengio & Aaron Courville",
        summary: "The definitive theoretical textbook on deep learning mathematics and architectures.",
        url: "https://www.deeplearningbook.org/",
      },
      youtube: [
        { title: "PyTorch for Deep Learning Full Course", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=V_xro1bcAuA", duration: "24 hrs" },
      ],
      udemy: { title: "PyTorch for Deep Learning Bootcamp", rating: 4.7, level: "Intermediate", url: "https://www.udemy.com/course/pytorch-for-deep-learning/" },
      coursera: { title: "Deep Learning Specialization", rating: 4.9, certBy: "DeepLearning.AI", url: "https://www.coursera.org/specializations/deep-learning" },
    },
    4: {
      blogs: [
        { title: "MLOps: Continuous Delivery and Automation Pipelines for ML", source: "Google Cloud Architecture", url: "https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning", timeToRead: "18 min read" },
      ],
      book: {
        title: "Designing Machine Learning Systems",
        author: "Chip Huyen",
        summary: "An iterative process for production-ready applications.",
        url: "https://www.oreilly.com/library/view/designing-machine-learning/9781098107956/",
      },
      youtube: [
        { title: "MLOps Full Course", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=9I-mPy0x7s0", duration: "3 hrs" },
      ],
      udemy: { title: "Deployment of Machine Learning Models", rating: 4.6, level: "Advanced", url: "https://www.udemy.com/course/deployment-of-machine-learning-models/" },
      coursera: { title: "Machine Learning Engineering for Production (MLOps)", rating: 4.8, certBy: "DeepLearning.AI", url: "https://www.coursera.org/specializations/mach-learning-engineering-for-production-mlops" },
    },
    5: {
      blogs: [
        { title: "Writing High-Impact Data Science Case Studies & Portfolios", source: "Kaggle", url: "https://www.kaggle.com", timeToRead: "10 min read" },
      ],
      book: {
        title: "Storytelling with Data: A Data Visualization Guide",
        author: "Cole Nussbaumer Knaflic",
        summary: "How to communicate complex technical discoveries with clarity and executive impact.",
        url: "https://www.storytellingwithdata.com/books",
      },
      youtube: [
        { title: "End-to-End Data Science Project Walkthrough", channel: "Ken Jee", url: "https://www.youtube.com/c/KenJee1", duration: "Playlist" },
      ],
      udemy: { title: "Data Science Career Guide & Real World Projects", rating: 4.6, level: "All Levels", url: "https://www.udemy.com/course/the-data-science-course-complete-data-science-bootcamp/" },
      coursera: { title: "IBM Data Science Professional Certificate", rating: 4.6, certBy: "IBM", url: "https://www.coursera.org/professional-certificates/ibm-data-science" },
    },
  },
  product: {
    0: {
      blogs: [{ title: "Product Management 101 Guide", source: "Mind the Product", url: "https://www.mindtheproduct.com/", timeToRead: "10 min" }],
      book: { title: "Inspired: How to Create Tech Products Customers Love", author: "Marty Cagan", summary: "The product manager bible for discovering and delivering tech products.", url: "https://svpg.com/books/inspired-how-to-create-tech-products-customers-love-2nd-edition/" },
      youtube: [{ title: "Product Management for Beginners", channel: "Product School", url: "https://www.youtube.com/c/ProductSchoolSanFrancisco", duration: "Playlist" }],
      udemy: { title: "Become a Product Manager", rating: 4.5, level: "Beginner", url: "https://www.udemy.com/course/become-a-product-manager-learn-the-skills-earn-the-title/" },
      coursera: { title: "Digital Product Management", rating: 4.6, certBy: "University of Virginia", url: "https://www.coursera.org/specializations/uva-darden-digital-product-management" },
    },
    1: {
      blogs: [{ title: "User Research & Customer Discovery", source: "Nielsen Norman Group", url: "https://www.nngroup.com/", timeToRead: "12 min" }],
      book: { title: "The Mom Test", author: "Rob Fitzpatrick", summary: "How to talk to customers & learn if your business is a good idea when everyone is lying to you.", url: "https://www.momtestbook.com/" },
      youtube: [{ title: "Customer Discovery Masterclass", channel: "Y Combinator", url: "https://www.youtube.com/c/ycombinator", duration: "1 hr" }],
      udemy: { title: "User Research Essentials", rating: 4.6, level: "Intermediate", url: "https://www.udemy.com/course/user-research-basics/" },
      coursera: { title: "User Experience Research and Design", rating: 4.7, certBy: "University of Michigan", url: "https://www.coursera.org/specializations/michiganux" },
    },
    2: {
      blogs: [{ title: "Product Metrics That Actually Matter", source: "Reforge", url: "https://www.reforge.com/blog", timeToRead: "15 min" }],
      book: { title: "Lean Analytics", author: "Alistair Croll & Benjamin Yoskovitz", summary: "Use data to build a better startup faster.", url: "https://leananalyticsbook.com/" },
      youtube: [{ title: "Product Analytics Crash Course", channel: "Mixpanel", url: "https://www.youtube.com", duration: "1.5 hrs" }],
      udemy: { title: "Product Management: Agile, Scrum & Metrics", rating: 4.6, level: "Intermediate", url: "https://www.udemy.com/course/product-management-metrics/" },
      coursera: { title: "Agile with Atlassian Jira", rating: 4.7, certBy: "Atlassian", url: "https://www.coursera.org/learn/agile-atlassian-jira" },
    },
    3: {
      blogs: [{ title: "Prioritization Frameworks: RICE vs Kano", source: "Intercom Blog", url: "https://www.intercom.com/blog", timeToRead: "10 min" }],
      book: { title: "Escaping the Build Trap", author: "Melissa Perri", summary: "How effective product management creates real value.", url: "https://melissaperri.com/book" },
      youtube: [{ title: "Roadmapping & Prioritization", channel: "Lenny Rachitsky", url: "https://www.youtube.com/@LennysPodcast", duration: "1 hr" }],
      udemy: { title: "Product Management: Prioritization Techniques", rating: 4.5, level: "Intermediate", url: "https://www.udemy.com/course/product-prioritization/" },
      coursera: { title: "Software Product Management Specialization", rating: 4.7, certBy: "University of Alberta", url: "https://www.coursera.org/specializations/product-management" },
    },
    4: {
      blogs: [{ title: "Leading Cross-Functional Engineering Teams", source: "First Round Review", url: "https://review.firstround.com/", timeToRead: "14 min" }],
      book: { title: "Continuous Discovery Habits", author: "Teresa Torres", summary: "Discover products that bring customer and business value.", url: "https://www.producttalk.org/continuous-discovery-habits/" },
      youtube: [{ title: "Product Leadership Workshop", channel: "Mind the Product", url: "https://www.youtube.com/c/MindTheProduct", duration: "2 hrs" }],
      udemy: { title: "Advanced Product Management: Vision, Strategy & Metrics", rating: 4.7, level: "Advanced", url: "https://www.udemy.com/course/advanced-product-management-vision-strategy-metrics/" },
      coursera: { title: "Product Strategy", rating: 4.6, certBy: "Northwestern University", url: "https://www.coursera.org/learn/product-strategy" },
    },
    5: {
      blogs: [{ title: "Product Management Portfolio & Case Studies", source: "Exponent", url: "https://www.tryexponent.com/", timeToRead: "12 min" }],
      book: { title: "Cracking the PM Interview", author: "Gayle Laakmann McDowell & Jackie Bavaro", summary: "How to land a product manager job in tech.", url: "https://www.crackingthepminterview.com/" },
      youtube: [{ title: "PM Mock Interview & Case Study", channel: "Exponent", url: "https://www.youtube.com/c/ExponentTV", duration: "Playlist" }],
      udemy: { title: "Product Management Interview Prep Masterclass", rating: 4.7, level: "All Levels", url: "https://www.udemy.com/course/product-management-interview/" },
      coursera: { title: "Google Project Management Professional Certificate", rating: 4.8, certBy: "Google", url: "https://www.coursera.org/professional-certificates/google-project-management" },
    },
  },
  design: {
    0: {
      blogs: [{ title: "Figma 101: Auto Layout, Components & Variants", source: "Figma Blog", url: "https://www.figma.com/resource-library/", timeToRead: "15 min" }],
      book: { title: "The Design of Everyday Things", author: "Don Norman", summary: "The cognitive psychology and fundamental principles of intuitive design.", url: "https://jnd.org/the-design-of-everyday-things-revised-and-expanded-edition/" },
      youtube: [{ title: "Figma UI Design Full Course", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=c9Wg6Cb_YlU", duration: "4 hrs" }],
      udemy: { title: "User Experience Design Essentials - Adobe XD / Figma", rating: 4.7, level: "Beginner", url: "https://www.udemy.com/course/ui-ux-web-design-using-adobe-xd/" },
      coursera: { title: "Google UX Design Professional Certificate", rating: 4.8, certBy: "Google", url: "https://www.coursera.org/professional-certificates/google-ux-design" },
    },
    1: {
      blogs: [{ title: "10 Usability Heuristics for User Interface Design", source: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/ten-usability-heuristics/", timeToRead: "12 min" }],
      book: { title: "Don't Make Me Think, Revisited", author: "Steve Krug", summary: "A common sense approach to web usability.", url: "https://sensible.com/dont-make-me-think/" },
      youtube: [{ title: "UX Research Methods", channel: "NNgroup", url: "https://www.youtube.com/c/NNgroup", duration: "Playlist" }],
      udemy: { title: "UX & Web Design Master Course: Strategy, Design, Development", rating: 4.6, level: "All Levels", url: "https://www.udemy.com/course/ux-web-design-master-course-strategy-design-development/" },
      coursera: { title: "Foundations of User Experience (UX) Design", rating: 4.8, certBy: "Google", url: "https://www.coursera.org/learn/foundations-user-experience-design" },
    },
    2: {
      blogs: [{ title: "Building Scalable Design Systems in Figma", source: "DesignSystems.com", url: "https://www.designsystems.com/", timeToRead: "15 min" }],
      book: { title: "Atomic Design", author: "Brad Frost", summary: "Methodology for crafting sustainable user interface design systems.", url: "https://atomicdesign.bradfrost.com/" },
      youtube: [{ title: "Design Systems in Figma", channel: "Mizko", url: "https://www.youtube.com/c/Mizko", duration: "2 hrs" }],
      udemy: { title: "Design Systems in Figma", rating: 4.7, level: "Advanced", url: "https://www.udemy.com/course/design-systems-in-figma/" },
      coursera: { title: "Create High-Fidelity Designs and Prototypes in Figma", rating: 4.8, certBy: "Google", url: "https://www.coursera.org/learn/high-fidelity-designs-prototypes-figma" },
    },
    3: {
      blogs: [{ title: "Micro-Interactions & Animation Principles in UI", source: "Smashing Magazine", url: "https://www.smashingmagazine.com", timeToRead: "10 min" }],
      book: { title: "Microinteractions: Designing with Details", author: "Dan Saffer", summary: "How small details make great products.", url: "https://www.oreilly.com/library/view/microinteractions/9781449342715/" },
      youtube: [{ title: "Interactive Prototyping in Figma", channel: "Figma", url: "https://www.youtube.com/c/Figmadesign", duration: "Playlist" }],
      udemy: { title: "Motion Design with Figma: Animations & Micro-interactions", rating: 4.6, level: "Intermediate", url: "https://www.udemy.com/course/motion-design-figma/" },
      coursera: { title: "Interaction Design Specialization", rating: 4.6, certBy: "UC San Diego", url: "https://www.coursera.org/specializations/interaction-design" },
    },
    4: {
      blogs: [{ title: "Design Critiques: How to Give & Receive Constructive Feedback", source: "InVision Blog", url: "https://www.invisionapp.com/inside-design", timeToRead: "8 min" }],
      book: { title: "Articulating Design Decisions", author: "Tom Greever", summary: "Communicate with stakeholders, keep your sanity, and deliver the best user experience.", url: "https://www.oreilly.com/library/view/articulating-design-decisions/9781491921555/" },
      youtube: [{ title: "Design Critique Masterclass", channel: "The Futur", url: "https://www.youtube.com/c/thefuturishere", duration: "1.5 hrs" }],
      udemy: { title: "Product Design (UI/UX) Masterclass", rating: 4.6, level: "Intermediate", url: "https://www.udemy.com/course/ui-ux-design-masterclass/" },
      coursera: { title: "Conduct UX Research and Test Early Concepts", rating: 4.8, certBy: "Google", url: "https://www.coursera.org/learn/conduct-ux-research-test-early-concepts" },
    },
    5: {
      blogs: [{ title: "How to Build a World-Class UX Case Study", source: "Case Study Club", url: "https://www.casestudy.club/", timeToRead: "12 min" }],
      book: { title: "Sprint: How to Solve Big Problems and Test New Ideas in Just Five Days", author: "Jake Knapp", summary: "Google Ventures methodology for rapid design innovation.", url: "https://www.thesprintbook.com/" },
      youtube: [{ title: "UX Portfolio Review & Case Study Breakdown", channel: "femke.design", url: "https://www.youtube.com/c/FemkeDesign", duration: "Playlist" }],
      udemy: { title: "Build a Killer UX Design Portfolio", rating: 4.7, level: "All Levels", url: "https://www.udemy.com/course/ux-portfolio/" },
      coursera: { title: "Design a User Experience for Social Good & Prepare for Jobs", rating: 4.8, certBy: "Google", url: "https://www.coursera.org/learn/design-a-user-experience-for-social-good" },
    },
  },
  devops: {
    0: {
      blogs: [{ title: "Linux Command Line & Shell Scripting Guide", source: "Linux.org", url: "https://www.linux.org/", timeToRead: "15 min" }],
      book: { title: "The Linux Command Line (2nd Edition)", author: "William Shotts", summary: "A complete introduction to the terminal and shell scripting.", url: "https://linuxcommand.org/tlcl.php" },
      youtube: [{ title: "Linux for Beginners Full Course", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=wBp0Rb-ZJak", duration: "5 hrs" }],
      udemy: { title: "Linux Mastery: Master the Linux Command Line in 11.5 Hours", rating: 4.7, level: "All Levels", url: "https://www.udemy.com/course/linux-mastery/" },
      coursera: { title: "Google IT Support Professional Certificate", rating: 4.8, certBy: "Google", url: "https://www.coursera.org/professional-certificates/google-it-support" },
    },
    1: {
      blogs: [{ title: "Docker & Kubernetes Architecture Explained", source: "Kubernetes.io", url: "https://kubernetes.io/docs/concepts/", timeToRead: "18 min" }],
      book: { title: "Kubernetes: Up and Running (3rd Edition)", author: "Brendan Burns, Joe Beda & Kelsey Hightower", summary: "Dive into the future of infrastructure by the creators of Kubernetes.", url: "https://www.oreilly.com/library/view/kubernetes-up-and/9781098110192/" },
      youtube: [{ title: "Docker and Kubernetes Tutorial", channel: "TechWorld with Nana", url: "https://www.youtube.com/c/TechWorldwithNana", duration: "3 hrs" }],
      udemy: { title: "Docker & Kubernetes: The Practical Guide", rating: 4.8, level: "Intermediate", url: "https://www.udemy.com/course/docker-kubernetes-the-practical-guide/" },
      coursera: { title: "Architecting with Google Kubernetes Engine", rating: 4.7, certBy: "Google Cloud", url: "https://www.coursera.org/specializations/architecting-google-kubernetes-engine" },
    },
    2: {
      blogs: [{ title: "Automating CI/CD Pipelines with GitHub Actions", source: "GitHub Docs", url: "https://docs.github.com/en/actions", timeToRead: "12 min" }],
      book: { title: "Continuous Delivery: Reliable Software Releases", author: "Jez Humble & David Farley", summary: "Automating the build, test, and deployment process.", url: "https://continuousdelivery.com/" },
      youtube: [{ title: "GitHub Actions Tutorial - CI/CD DevOps Pipeline", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=R8_veQiYBjI", duration: "2 hrs" }],
      udemy: { title: "GitHub Actions - The Complete Guide", rating: 4.7, level: "Intermediate", url: "https://www.udemy.com/course/github-actions-the-complete-guide/" },
      coursera: { title: "DevOps and Software Engineering Professional Certificate", rating: 4.7, certBy: "IBM", url: "https://www.coursera.org/professional-certificates/devops-and-software-engineering" },
    },
    3: {
      blogs: [{ title: "Infrastructure as Code: Terraform Best Practices", source: "HashiCorp Learn", url: "https://developer.hashicorp.com/terraform/tutorials", timeToRead: "15 min" }],
      book: { title: "Terraform: Up & Running (3rd Edition)", author: "Yevgeniy Brikman", summary: "Writing infrastructure as code across AWS, Azure, and Google Cloud.", url: "https://www.terraformupandrunning.com/" },
      youtube: [{ title: "Terraform Course - Automate your AWS Cloud Infrastructure", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=SLB_c_ayRMo", duration: "2.5 hrs" }],
      udemy: { title: "Terraform for the Absolute Beginner with Labs", rating: 4.7, level: "Beginner", url: "https://www.udemy.com/course/terraform-beginner-to-advanced/" },
      coursera: { title: "Cloud Engineering with Google Cloud", rating: 4.7, certBy: "Google Cloud", url: "https://www.coursera.org/professional-certificates/cloud-engineering-gcp" },
    },
    4: {
      blogs: [{ title: "Prometheus, Grafana & Distributed Tracing Guide", source: "Prometheus.io", url: "https://prometheus.io/docs/introduction/overview/", timeToRead: "14 min" }],
      book: { title: "Site Reliability Engineering: How Google Runs Production Systems", author: "Betsy Beyer, Chris Jones, Jennifer Petoff & Niall Richard Murphy", summary: "The official Google SRE handbook on scaling and reliability.", url: "https://sre.google/sre-book/table-of-contents/" },
      youtube: [{ title: "Monitoring and Observability Crash Course", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=mLPg49bCEVE", duration: "2 hrs" }],
      udemy: { title: "Prometheus | The Complete Hands-On Guide", rating: 4.6, level: "Intermediate", url: "https://www.udemy.com/course/prometheus-the-complete-hands-on-course/" },
      coursera: { title: "Google Cloud DevOps Engineer Professional Certificate", rating: 4.6, certBy: "Google Cloud", url: "https://www.coursera.org/professional-certificates/sre-devops-engineer-google-cloud" },
    },
    5: {
      blogs: [{ title: "AWS Well-Architected Framework: Reliability & Security", source: "AWS Architecture", url: "https://aws.amazon.com/architecture/well-architected/", timeToRead: "20 min" }],
      book: { title: "The DevOps Handbook (2nd Edition)", author: "Gene Kim, Jez Humble, Patrick Debois & John Willis", summary: "How to create world-class agility, reliability, and security in technology organizations.", url: "https://itrevolution.com/product/the-devops-handbook-second-edition/" },
      youtube: [{ title: "AWS Certified Solutions Architect Course", channel: "freeCodeCamp", url: "https://www.youtube.com/watch?v=Ia-UEYYR44s", duration: "10 hrs" }],
      udemy: { title: "Ultimate AWS Certified Solutions Architect Associate", rating: 4.7, level: "All Levels", url: "https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/" },
      coursera: { title: "AWS Fundamentals Specialization", rating: 4.6, certBy: "Amazon Web Services", url: "https://www.coursera.org/specializations/aws-fundamentals" },
    },
  },
};

export function CareerRoadmap({ role }: { role: RoleId }) {
  const steps = roadmaps[role];
  const courses = courseCatalog[role];
  const githubProjects = roleGitHubProjects[role] || [];
  const roleLabel = roleOptions.find((r) => r.id === role)?.label ?? "";

  const [activeTab, setActiveTab] = useState<"milestones" | "courses" | "projects">("milestones");
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(0);
  const [completedStages, setCompletedStages] = useState<Record<number, boolean>>({});

  // Load completed stages from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`careerforge.roadmap_progress.${role}`);
      if (raw) setCompletedStages(JSON.parse(raw));
      else setCompletedStages({});
    } catch {
      // ignore
    }
  }, [role]);

  const toggleStageCompleted = (idx: number) => {
    const next = { ...completedStages, [idx]: !completedStages[idx] };
    setCompletedStages(next);
    try {
      localStorage.setItem(`careerforge.roadmap_progress.${role}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const completedCount = Object.keys(completedStages).filter(
    (k) => completedStages[Number(k)] && Number(k) < steps.length
  ).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const selectedStep = selectedStepIndex !== null ? steps[selectedStepIndex] : null;
  const selectedResource =
    selectedStepIndex !== null ? stepResourcesByRole[role]?.[selectedStepIndex] : null;

  return (
    <Section
      id="roadmap"
      eyebrow="Career Progression &amp; Learning Hub"
      title={`Your Path to ${roleLabel}`}
      description="Interactive milestone progression, recommended technical books, architecture guides, and open-source GitHub projects."
    >
      {/* Overall Progress Tracker Bar */}
      <div className="mb-6 rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-graphite">Career Track Milestone Progress</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-800 border border-neutral-200">
                {completedCount} of {steps.length} Stages Complete
              </span>
            </div>
            <p className="mt-1 text-xs text-graphite">
              Track your journey toward becoming a production-grade {roleLabel}.
            </p>
          </div>
          <div className="text-right">
            <span className="font-display text-2xl italic text-ink font-bold">{progressPercent}%</span>
            <span className="text-xs text-graphite ml-1">Overall</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 border border-line/60">
          <div
            className="h-full bg-neutral-900 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Sub-Navigation: Milestones Path vs Full Course Catalog vs GitHub Repos */}
      <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("milestones")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "milestones"
              ? "bg-neutral-900 text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          <span>🗺️ Milestones &amp; Deep Research</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("courses")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "courses"
              ? "bg-neutral-900 text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          <span>📚 Curated Course Catalog ({courses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "projects"
              ? "bg-neutral-900 text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          <span>⭐ Open-Source GitHub Repositories ({githubProjects.length})</span>
        </button>
      </div>

      {/* ─── TAB 1: MILESTONES & TOPIC RESEARCH PORTAL ─────────────────────── */}
      {activeTab === "milestones" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          
          {/* Left Column: Interactive Roadmap Steps List */}
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Select a stage to view learning materials
            </p>

            <ol className="relative space-y-3">
              {steps.map((step, i) => {
                const isSelected = selectedStepIndex === i;
                const isDone = Boolean(completedStages[i]);
                return (
                  <li key={step.title}>
                    <div
                      onClick={() => setSelectedStepIndex(i)}
                      className={`group flex items-start gap-3.5 rounded-2xl border p-4 transition-all cursor-pointer ${
                        isSelected
                          ? "border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900/5"
                          : isDone
                          ? "border-emerald-200 bg-emerald-50/30 hover:border-emerald-300"
                          : "border-neutral-200 bg-white/70 hover:border-neutral-300 hover:bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStageCompleted(i);
                        }}
                        title={isDone ? "Mark as in-progress" : "Mark as completed"}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isDone
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : isSelected
                            ? "bg-neutral-900 text-white"
                            : "border border-neutral-300 bg-neutral-100 text-neutral-700 group-hover:border-neutral-900"
                        }`}
                      >
                        {isDone ? "✓" : i + 1}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-semibold truncate ${isDone ? "text-emerald-950" : "text-neutral-900"}`}>
                            {step.title}
                          </p>
                          <span className={`text-[11px] font-medium ${isDone ? "text-emerald-700 font-semibold" : "text-blue-600 group-hover:underline"}`}>
                            {isDone ? "Completed ✓" : isSelected ? "Active" : "Research →"}
                          </span>
                        </div>
                        
                        <p className="mt-1 text-xs text-neutral-500 leading-relaxed line-clamp-2">
                          {step.detail}
                        </p>

                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {step.skills.map((s) => (
                            <Tag key={s}>{s}</Tag>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Right Column: Deep Research & Learning Material for Selected Stage */}
          <div className="lg:col-span-7">
            {selectedStep && selectedResource ? (
              <div className="sticky top-20 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6 animate-in fade-in duration-150">
                
                {/* Stage Header */}
                <div className="border-b border-neutral-100 pb-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      <span>Stage {selectedStepIndex! + 1} Research Hub</span>
                      <span>&bull;</span>
                      <span className="text-emerald-700 font-bold">Curated Resources</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleStageCompleted(selectedStepIndex!)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                        completedStages[selectedStepIndex!]
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <span>{completedStages[selectedStepIndex!] ? "✓ Completed" : "○ Mark as Complete"}</span>
                    </button>
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900">{selectedStep.title}</h3>
                  <p className="mt-1 text-xs text-neutral-600 leading-relaxed">{selectedStep.detail}</p>
                </div>

                {/* 1. Technical Blogs & Guides */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📝</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                      Technical Blogs &amp; Deep Dives
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {selectedResource.blogs.map((b) => (
                      <a
                        key={b.title}
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-xs transition-colors hover:border-neutral-400 hover:bg-white group"
                      >
                        <div>
                          <p className="font-semibold text-neutral-900 group-hover:text-blue-600">{b.title}</p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">{b.source} &bull; {b.timeToRead}</p>
                        </div>
                        <span className="text-neutral-400 group-hover:text-blue-600 font-bold">↗</span>
                      </a>
                    ))}
                  </div>
                </div>

                {/* 2. Top Book Recommendation */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📖</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                      Authoritative Book Recommendation
                    </h4>
                  </div>

                  <a
                    href={selectedResource.book.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-neutral-200 bg-amber-50/40 p-4 transition-colors hover:border-amber-400 group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-neutral-900 group-hover:text-amber-900">
                          {selectedResource.book.title}
                        </p>
                        <p className="text-xs font-medium text-neutral-600">
                          by {selectedResource.book.author}
                        </p>
                      </div>
                      <span className="rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                        Book
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
                      {selectedResource.book.summary}
                    </p>
                  </a>
                </div>

                {/* 3. Video Playlists & Structured Courses (YouTube, Udemy, Coursera) */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎥</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                      Video Playlists &amp; Online Courses
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* YouTube Playlist */}
                    {selectedResource.youtube.map((yt) => (
                      <a
                        key={yt.title}
                        href={yt.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-xs hover:border-red-500 hover:bg-white transition-colors group"
                      >
                        <div className="flex items-center gap-2 text-red-600 font-bold mb-1">
                          <span>🔴 YouTube</span>
                          <span className="text-[10px] font-normal text-neutral-400">({yt.duration})</span>
                        </div>
                        <p className="font-semibold text-neutral-900 group-hover:text-red-700 truncate">{yt.title}</p>
                        <p className="text-[11px] text-neutral-500">{yt.channel}</p>
                      </a>
                    ))}

                    {/* Udemy Course */}
                    <a
                      href={selectedResource.udemy.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-xs hover:border-purple-500 hover:bg-white transition-colors group"
                    >
                      <div className="flex items-center justify-between text-purple-600 font-bold mb-1">
                        <span>🟣 Udemy Course</span>
                        <span className="text-[11px] text-neutral-500">★ {selectedResource.udemy.rating}</span>
                      </div>
                      <p className="font-semibold text-neutral-900 group-hover:text-purple-700 truncate">{selectedResource.udemy.title}</p>
                      <p className="text-[11px] text-neutral-500">{selectedResource.udemy.level}</p>
                    </a>

                    {/* Coursera Certificate */}
                    <a
                      href={selectedResource.coursera.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-xs hover:border-blue-500 hover:bg-white transition-colors group sm:col-span-2"
                    >
                      <div className="flex items-center justify-between text-blue-600 font-bold mb-1">
                        <span>🔵 Coursera Certificate</span>
                        <span className="text-[11px] text-neutral-500">★ {selectedResource.coursera.rating}</span>
                      </div>
                      <p className="font-semibold text-neutral-900 group-hover:text-blue-700 truncate">{selectedResource.coursera.title}</p>
                      <p className="text-[11px] text-neutral-500">Certified by {selectedResource.coursera.certBy}</p>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-xs text-neutral-400">
                Select any stage from the left to view research blogs, books, and courses.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: FULL INTEGRATED COURSE CATALOG ─────────────────────────── */}
      {activeTab === "courses" && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500">
            Top-rated professional certificates and video courses for <strong>{roleLabel}</strong>.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course: Course) => (
              <a
                key={course.title}
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <Card className="h-full transition-all hover:border-neutral-900 hover:shadow-md">
                  <div className="mb-3 flex items-center justify-between">
                    <Tag>{course.provider}</Tag>
                    <span className="text-xs font-semibold text-amber-700">★ {course.rating.toFixed(1)}</span>
                  </div>
                  <p className="text-sm font-semibold leading-snug text-neutral-900 group-hover:text-blue-600">
                    {course.title}
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">{course.level}</p>
                  <p className="mt-4 text-xs font-semibold text-neutral-900 group-hover:underline">
                    Open {course.provider} course →
                  </p>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: CURATED OPEN-SOURCE GITHUB PROJECTS ────────────────────── */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500">
            High-value open-source repositories and architectural codebases mapped to <strong>{roleLabel}</strong>.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {githubProjects.map((proj: GitHubProject) => (
              <div
                key={proj.id}
                className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs hover:border-neutral-900 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-900">
                      <svg className="w-4 h-4 text-neutral-900 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                      {proj.repo}
                    </span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      ★ {proj.stars}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                    {proj.name}
                  </h4>
                  <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
                    {proj.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {proj.topics.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
                  <span className="text-[11px] font-semibold text-neutral-400">
                    Difficulty: <strong className="text-neutral-700">{proj.difficulty}</strong>
                  </span>

                  <a
                    href={proj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-semibold text-neutral-900 hover:text-blue-600 underline decoration-neutral-300 group-hover:decoration-blue-600"
                  >
                    <span>Inspect Codebase</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
