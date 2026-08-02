/**
 * Deep technical interview question templates by role.
 * Each question includes type, focus area, expected signals, and voice-delivery-friendly phrasing.
 * These are merged with AI-generated resume-specific questions during interview creation.
 */

const PYTHON_DEVELOPER = [
  {
    type: "Technical",
    question: "Explain the difference between __init__ and __new__ in Python. When would you override __new__?",
    focus: "OOP internals",
    expectedSignals: ["metaclass awareness", "instance vs class creation", "singleton pattern"],
  },
  {
    type: "Technical",
    question: "How does Python's GIL affect multithreading? What alternatives exist for CPU-bound parallel tasks?",
    focus: "concurrency",
    expectedSignals: ["GIL mechanism", "multiprocessing", "asyncio for I/O", "C extensions"],
  },
  {
    type: "Technical",
    question: "Walk me through Python's MRO — Method Resolution Order. How does it handle diamond inheritance?",
    focus: "inheritance",
    expectedSignals: ["C3 linearization", "super() chain", "mro() method", "practical example"],
  },
  {
    type: "Technical",
    question: "What is a metaclass in Python? Describe a real-world scenario where you would use one.",
    focus: "advanced OOP",
    expectedSignals: ["type as metaclass", "class creation control", "ORM or validation use case"],
  },
  {
    type: "Technical",
    question: "How would you optimize a Python application that processes one million database records? Walk me through your approach.",
    focus: "performance optimization",
    expectedSignals: ["generators", "batch processing", "connection pooling", "profiling tools"],
  },
  {
    type: "Technical",
    question: "Explain Python decorators. Write a mental model of a decorator that logs function execution time and retries on failure.",
    focus: "decorators",
    expectedSignals: ["closure", "functools.wraps", "args/kwargs forwarding", "practical pattern"],
  },
  {
    type: "Technical",
    question: "What are Python context managers? Explain the protocol and give an example beyond file handling.",
    focus: "resource management",
    expectedSignals: ["__enter__/__exit__", "contextlib", "database transactions", "lock management"],
  },
  {
    type: "Technical",
    question: "Compare list comprehensions, generator expressions, and map/filter in Python. When would you choose each?",
    focus: "Pythonic patterns",
    expectedSignals: ["memory efficiency", "lazy evaluation", "readability trade-offs", "performance"],
  },
  {
    type: "Technical",
    question: "How does Python's garbage collector work? What is reference counting and when does the cyclic collector run?",
    focus: "memory management",
    expectedSignals: ["refcount", "gc module", "weak references", "memory leaks"],
  },
  {
    type: "Technical",
    question: "Explain asyncio in Python. How do you handle ten thousand concurrent HTTP requests without threading?",
    focus: "async programming",
    expectedSignals: ["event loop", "coroutines", "aiohttp", "gather/TaskGroup", "backpressure"],
  },
  {
    type: "Technical",
    question: "What is the difference between deepcopy, shallow copy, and assignment in Python? When does each cause bugs?",
    focus: "data handling",
    expectedSignals: ["mutable defaults", "nested object references", "copy module", "practical example"],
  },
  {
    type: "System Design",
    question: "Design a task queue system in Python that handles retries, dead letter queues, and priority scheduling.",
    focus: "system design",
    expectedSignals: ["Celery or custom", "Redis/RabbitMQ", "retry backoff", "monitoring"],
  },
  {
    type: "Debugging",
    question: "You have a Python web service that uses 4GB of RAM and keeps growing. How would you diagnose the memory leak?",
    focus: "debugging",
    expectedSignals: ["tracemalloc", "objgraph", "gc.get_objects", "heap profiling", "weak references"],
  },
  {
    type: "Testing",
    question: "How do you structure tests for a Python application with external API dependencies? Explain your mocking strategy.",
    focus: "testing",
    expectedSignals: ["pytest fixtures", "mock/patch", "dependency injection", "integration vs unit"],
  },
  {
    type: "Architecture",
    question: "Explain the difference between Flask, Django, and FastAPI. For a real-time analytics dashboard, which would you choose and why?",
    focus: "framework selection",
    expectedSignals: ["async support", "ORM trade-offs", "WebSocket handling", "performance benchmarks"],
  },
];

const FRONTEND_DEVELOPER = [
  {
    type: "Technical",
    question: "Explain the virtual DOM reconciliation algorithm in React. What triggers unnecessary re-renders and how do you prevent them?",
    focus: "React internals",
    expectedSignals: ["fiber architecture", "diffing algorithm", "React.memo", "useMemo/useCallback", "key prop"],
  },
  {
    type: "Technical",
    question: "How would you implement code splitting and lazy loading in a React application? What metrics would you track?",
    focus: "performance optimization",
    expectedSignals: ["React.lazy", "Suspense", "dynamic import", "bundle analysis", "LCP/FCP"],
  },
  {
    type: "Technical",
    question: "Explain the browser event loop. How do microtasks differ from macrotasks? Give a concrete ordering example.",
    focus: "JavaScript runtime",
    expectedSignals: ["call stack", "task queue", "microtask queue", "Promise vs setTimeout", "requestAnimationFrame"],
  },
  {
    type: "Technical",
    question: "What is the critical rendering path? How would you optimize a page that takes 5 seconds to become interactive?",
    focus: "web performance",
    expectedSignals: ["CSSOM", "render blocking", "async/defer scripts", "preload/prefetch", "TTI optimization"],
  },
  {
    type: "Technical",
    question: "Compare React state management approaches: Context API, Redux, Zustand, and Jotai. When would you pick each?",
    focus: "state management",
    expectedSignals: ["re-render scope", "devtools", "middleware", "atomic vs centralized", "selector patterns"],
  },
  {
    type: "Technical",
    question: "How do you handle authentication in a single-page application? Explain token storage, refresh flow, and CSRF protection.",
    focus: "security",
    expectedSignals: ["httpOnly cookies vs localStorage", "refresh token rotation", "XSS mitigation", "CORS"],
  },
  {
    type: "Technical",
    question: "Explain CSS specificity rules. How would you architect a CSS system for a large-scale application with 50 plus components?",
    focus: "CSS architecture",
    expectedSignals: ["BEM or CSS modules", "specificity calculation", "cascade layers", "design tokens"],
  },
  {
    type: "Technical",
    question: "What are Web Workers? How would you use them to process a large dataset without blocking the main thread?",
    focus: "concurrency",
    expectedSignals: ["dedicated vs shared workers", "structured clone", "transferable objects", "Comlink"],
  },
  {
    type: "Technical",
    question: "How would you implement an accessible dropdown menu that works with screen readers, keyboard navigation, and mobile?",
    focus: "accessibility",
    expectedSignals: ["ARIA roles", "focus management", "keyboard traps", "screen reader testing", "WAI-ARIA patterns"],
  },
  {
    type: "Technical",
    question: "Explain React Server Components. How do they differ from SSR and client components? What are the trade-offs?",
    focus: "modern React",
    expectedSignals: ["zero bundle size", "streaming", "server/client boundary", "data fetching patterns"],
  },
  {
    type: "System Design",
    question: "Design a real-time collaborative text editor for the browser. How would you handle conflicts and offline support?",
    focus: "system design",
    expectedSignals: ["CRDT or OT", "WebSocket", "IndexedDB", "operational transform", "conflict resolution"],
  },
  {
    type: "Debugging",
    question: "A production React app has a memory leak that causes the tab to crash after 30 minutes. How do you investigate?",
    focus: "debugging",
    expectedSignals: ["Chrome DevTools heap snapshot", "detached DOM nodes", "event listener cleanup", "useEffect cleanup"],
  },
  {
    type: "Testing",
    question: "How do you test a complex form with validation, async submission, and error states? What testing library and strategy?",
    focus: "testing",
    expectedSignals: ["React Testing Library", "user-event", "MSW for API mocking", "accessibility assertions"],
  },
  {
    type: "Architecture",
    question: "How would you migrate a large jQuery application to React without rewriting everything at once?",
    focus: "migration strategy",
    expectedSignals: ["strangler fig pattern", "micro-frontends", "module federation", "incremental adoption"],
  },
  {
    type: "Performance",
    question: "Your React app's Lighthouse score is 35. Walk me through your optimization strategy to get it above 90.",
    focus: "web vitals",
    expectedSignals: ["CLS fixes", "image optimization", "code splitting", "font loading", "caching strategy"],
  },
];

const BACKEND_DEVELOPER = [
  {
    type: "Technical",
    question: "Design a rate limiter for an API handling ten thousand requests per second. What algorithm would you use and why?",
    focus: "rate limiting",
    expectedSignals: ["token bucket", "sliding window", "Redis", "distributed rate limiting", "burst handling"],
  },
  {
    type: "Technical",
    question: "Explain the CAP theorem. For a payment processing system, would you choose consistency or availability, and why?",
    focus: "distributed systems",
    expectedSignals: ["partition tolerance", "eventual consistency", "strong consistency", "practical trade-offs"],
  },
  {
    type: "Technical",
    question: "How would you design a database schema for a multi-tenant SaaS application? Compare row-level isolation versus schema-per-tenant.",
    focus: "database architecture",
    expectedSignals: ["RLS", "tenant_id column", "connection pooling", "data isolation", "migration complexity"],
  },
  {
    type: "Technical",
    question: "Explain database indexing strategies. When would you use a composite index versus separate indexes? How do you identify slow queries?",
    focus: "database optimization",
    expectedSignals: ["B-tree", "covering index", "EXPLAIN ANALYZE", "index selectivity", "index-only scans"],
  },
  {
    type: "Technical",
    question: "How would you implement an event-driven architecture with eventual consistency? What happens when an event handler fails?",
    focus: "event-driven systems",
    expectedSignals: ["event sourcing", "dead letter queue", "idempotency", "saga pattern", "outbox pattern"],
  },
  {
    type: "Technical",
    question: "Compare REST, GraphQL, and gRPC. For a microservices backend with both public API and internal service communication, which would you use where?",
    focus: "API design",
    expectedSignals: ["REST for public", "gRPC for internal", "GraphQL for BFF", "protobuf", "schema evolution"],
  },
  {
    type: "Technical",
    question: "How do you handle database migrations in production with zero downtime? What if a migration needs to rename a column used by the running code?",
    focus: "deployment",
    expectedSignals: ["expand-contract pattern", "backward compatible", "blue-green", "migration ordering"],
  },
  {
    type: "Technical",
    question: "Explain connection pooling. Your Node.js server has 50 concurrent requests but only 10 database connections. What happens and how do you tune it?",
    focus: "resource management",
    expectedSignals: ["pool size", "queue depth", "timeout configuration", "PgBouncer", "connection lifecycle"],
  },
  {
    type: "Technical",
    question: "How would you implement distributed caching? When does cache invalidation fail, and what strategies prevent stale data?",
    focus: "caching",
    expectedSignals: ["Redis cluster", "TTL", "cache-aside", "write-through", "cache stampede prevention"],
  },
  {
    type: "Technical",
    question: "Design an authentication system with JWT, refresh tokens, and session revocation. How do you handle token theft?",
    focus: "security",
    expectedSignals: ["short-lived access tokens", "refresh rotation", "token blacklist", "fingerprinting"],
  },
  {
    type: "System Design",
    question: "Design a URL shortener that handles one billion URLs. Walk me through the data model, encoding strategy, and read/write path.",
    focus: "system design",
    expectedSignals: ["base62 encoding", "hash collision", "read replica", "cache layer", "analytics"],
  },
  {
    type: "Debugging",
    question: "Your API response time jumped from 50ms to 2 seconds overnight. No code was deployed. How do you investigate?",
    focus: "debugging",
    expectedSignals: ["metrics dashboard", "slow query log", "connection saturation", "DNS/network", "dependency health"],
  },
  {
    type: "Testing",
    question: "How do you test a payment processing pipeline with external payment provider integration? What do you mock and what do you test end-to-end?",
    focus: "testing",
    expectedSignals: ["contract testing", "sandbox environment", "idempotency testing", "failure injection"],
  },
  {
    type: "Architecture",
    question: "When would you split a monolith into microservices? What are the operational costs that teams underestimate?",
    focus: "architecture decisions",
    expectedSignals: ["deployment complexity", "distributed tracing", "data consistency", "team boundaries"],
  },
  {
    type: "DevOps",
    question: "Explain your CI/CD pipeline for a backend service. How do you handle database migrations, rollbacks, and feature flags?",
    focus: "deployment",
    expectedSignals: ["automated testing", "canary deploys", "rollback strategy", "feature flag service"],
  },
];

const FULLSTACK_DEVELOPER = [
  {
    type: "Technical",
    question: "How do you decide what logic belongs on the frontend versus the backend? Give an example where putting logic in the wrong place caused a bug.",
    focus: "architecture boundary",
    expectedSignals: ["validation duplication", "security", "performance", "user experience"],
  },
  {
    type: "Technical",
    question: "Explain how a browser request travels from URL bar to rendered page. Cover DNS, TCP, TLS, HTTP, and rendering.",
    focus: "web fundamentals",
    expectedSignals: ["DNS resolution", "TCP handshake", "TLS negotiation", "HTTP/2", "critical rendering path"],
  },
  {
    type: "Technical",
    question: "How would you implement real-time features like live notifications and typing indicators? Compare WebSocket, SSE, and polling.",
    focus: "real-time communication",
    expectedSignals: ["WebSocket for bidirectional", "SSE for server push", "reconnection", "scaling with Redis pub/sub"],
  },
  {
    type: "Technical",
    question: "Design the data flow for a file upload feature that handles resume files up to 10MB with progress tracking and virus scanning.",
    focus: "file handling",
    expectedSignals: ["chunked upload", "presigned URLs", "progress events", "async virus scan", "cleanup"],
  },
  {
    type: "Technical",
    question: "How do you handle optimistic UI updates? What happens when the server rejects the optimistic change?",
    focus: "UX engineering",
    expectedSignals: ["immediate UI update", "rollback on failure", "conflict resolution", "retry queue"],
  },
  {
    type: "Technical",
    question: "Explain CORS. A frontend on localhost:3000 calls an API on localhost:5000. What headers are needed and what are preflight requests?",
    focus: "security",
    expectedSignals: ["Origin header", "Access-Control-Allow headers", "OPTIONS preflight", "credentials mode"],
  },
  {
    type: "Technical",
    question: "How would you implement end-to-end type safety from database schema to frontend UI? What tools and patterns would you use?",
    focus: "type safety",
    expectedSignals: ["TypeScript", "Prisma/Drizzle", "tRPC or OpenAPI codegen", "Zod", "shared types"],
  },
  {
    type: "System Design",
    question: "Design a dashboard that shows real-time analytics with charts updating every 5 seconds for 1000 concurrent users.",
    focus: "system design",
    expectedSignals: ["WebSocket broadcasting", "data aggregation", "chart library", "connection management"],
  },
  {
    type: "Technical",
    question: "How do you implement pagination for a large dataset? Compare offset-based, cursor-based, and keyset pagination.",
    focus: "data fetching",
    expectedSignals: ["offset performance issues", "cursor stability", "infinite scroll", "total count trade-off"],
  },
  {
    type: "Technical",
    question: "Explain Server-Side Rendering versus Static Site Generation versus Client-Side Rendering. For an e-commerce site, which pages get which strategy?",
    focus: "rendering strategies",
    expectedSignals: ["SSR for dynamic", "SSG for catalog", "CSR for dashboard", "ISR", "hydration"],
  },
  {
    type: "Debugging",
    question: "Users report that a form sometimes submits twice. It only happens on slow connections. How do you investigate and fix it?",
    focus: "debugging",
    expectedSignals: ["debounce", "idempotency key", "disabled button state", "network retry", "server-side dedup"],
  },
  {
    type: "Testing",
    question: "How would you set up end-to-end testing for a full-stack app with authentication, file upload, and real-time features?",
    focus: "testing",
    expectedSignals: ["Playwright/Cypress", "test database", "auth fixtures", "CI integration", "flaky test handling"],
  },
  {
    type: "Architecture",
    question: "How do you manage environment configuration across frontend build, backend server, and database for dev, staging, and production?",
    focus: "configuration",
    expectedSignals: ["env vars", "build-time vs runtime", "secrets management", "feature flags"],
  },
  {
    type: "Performance",
    question: "Your full-stack app loads in 8 seconds on mobile. Walk me through profiling both frontend and backend to cut it to under 2 seconds.",
    focus: "performance",
    expectedSignals: ["Lighthouse", "network waterfall", "API latency", "image optimization", "caching"],
  },
  {
    type: "Security",
    question: "List the top 5 security vulnerabilities in a full-stack JavaScript application and how you prevent each one.",
    focus: "security",
    expectedSignals: ["XSS", "CSRF", "SQL injection", "broken auth", "SSRF", "input validation"],
  },
];

const JAVA_DEVELOPER = [
  {
    type: "Technical",
    question: "Explain the JVM memory model. What is the difference between stack and heap, and how does garbage collection decide what to collect?",
    focus: "JVM internals",
    expectedSignals: ["heap generations", "GC roots", "G1/ZGC", "stack frames", "metaspace"],
  },
  {
    type: "Technical",
    question: "Compare HashMap, ConcurrentHashMap, and TreeMap. When would you choose each and what are the thread-safety implications?",
    focus: "collections",
    expectedSignals: ["O(1) vs O(log n)", "segment locking", "fail-fast iterators", "ordering"],
  },
  {
    type: "Technical",
    question: "Explain Java's Stream API with an example. When should you use parallel streams and when should you avoid them?",
    focus: "functional programming",
    expectedSignals: ["lazy evaluation", "ForkJoinPool", "stateful operations", "thread safety"],
  },
  {
    type: "Technical",
    question: "What is the difference between checked and unchecked exceptions? How do you design a clean exception hierarchy for a microservice?",
    focus: "error handling",
    expectedSignals: ["exception hierarchy", "custom exceptions", "error codes", "Spring @ControllerAdvice"],
  },
  {
    type: "Technical",
    question: "Explain Spring Boot's dependency injection. What is the difference between @Component, @Service, @Repository, and @Controller?",
    focus: "Spring framework",
    expectedSignals: ["IoC container", "bean lifecycle", "component scanning", "proxy pattern"],
  },
  {
    type: "Technical",
    question: "How does the synchronized keyword work? Compare it with ReentrantLock, volatile, and atomic classes.",
    focus: "concurrency",
    expectedSignals: ["monitor lock", "happens-before", "fairness policy", "CAS operations"],
  },
  {
    type: "Technical",
    question: "Explain the SOLID principles with Java examples. Which principle is violated most frequently and how do you detect it?",
    focus: "design principles",
    expectedSignals: ["SRP", "OCP", "LSP", "ISP", "DIP", "real refactoring examples"],
  },
  {
    type: "Technical",
    question: "What are Java generics? Explain type erasure, bounded wildcards, and the PECS principle with practical examples.",
    focus: "type system",
    expectedSignals: ["type erasure", "extends vs super", "producer extends consumer super", "raw types"],
  },
  {
    type: "Technical",
    question: "Explain Spring Security's filter chain. How would you implement JWT authentication with role-based access control?",
    focus: "security",
    expectedSignals: ["filter chain order", "SecurityContext", "UserDetailsService", "method security"],
  },
  {
    type: "Technical",
    question: "Compare JPA, Hibernate, and JDBC. When would you drop down from JPA to raw JDBC and why?",
    focus: "data access",
    expectedSignals: ["N+1 problem", "lazy loading", "batch operations", "native queries", "performance"],
  },
  {
    type: "System Design",
    question: "Design an order management microservice with Spring Boot. How do you handle distributed transactions across payment and inventory services?",
    focus: "system design",
    expectedSignals: ["saga pattern", "event sourcing", "API gateway", "circuit breaker", "eventual consistency"],
  },
  {
    type: "Debugging",
    question: "A Spring Boot application has a memory leak causing OutOfMemoryError after 6 hours. How do you diagnose it?",
    focus: "debugging",
    expectedSignals: ["heap dump", "MAT/VisualVM", "GC logs", "classloader leaks", "connection pools"],
  },
  {
    type: "Testing",
    question: "How do you write integration tests for a Spring Boot REST API with database and external service dependencies?",
    focus: "testing",
    expectedSignals: ["@SpringBootTest", "Testcontainers", "MockMvc", "WireMock", "test profiles"],
  },
  {
    type: "Architecture",
    question: "Explain the difference between Java 8, 11, 17, and 21 features. What features changed how you write production code?",
    focus: "Java evolution",
    expectedSignals: ["records", "sealed classes", "pattern matching", "virtual threads", "text blocks"],
  },
  {
    type: "Performance",
    question: "Your Java microservice has a P99 latency of 800ms. Walk me through profiling and optimizing it to under 100ms.",
    focus: "performance",
    expectedSignals: ["JFR", "async-profiler", "GC tuning", "connection pooling", "object allocation"],
  },
];

const MERN_STACK_DEVELOPER = [
  {
    type: "Technical",
    question: "Explain React's fiber architecture and reconciliation algorithm. How does concurrent mode improve user experience?",
    focus: "React internals",
    expectedSignals: ["fiber tree", "time slicing", "priority lanes", "Suspense boundaries"],
  },
  {
    type: "Technical",
    question: "What are the rules of React hooks? Explain stale closure problems with useEffect and how useRef solves them.",
    focus: "React hooks",
    expectedSignals: ["closure over state", "dependency array", "cleanup function", "ref stability"],
  },
  {
    type: "Technical",
    question: "Explain the Node.js event loop phases in detail. What happens when you mix setImmediate, process.nextTick, and setTimeout?",
    focus: "Node.js runtime",
    expectedSignals: ["timer phase", "poll phase", "check phase", "microtask queue priority"],
  },
  {
    type: "Technical",
    question: "How does MongoDB handle indexing? Explain compound indexes, covered queries, and when to use aggregation pipelines.",
    focus: "MongoDB",
    expectedSignals: ["B-tree indexes", "explain plan", "index intersection", "pipeline stages", "$lookup"],
  },
  {
    type: "Technical",
    question: "Compare Express middleware with Koa's onion model and Fastify's plugin system. How does middleware ordering affect security?",
    focus: "Express.js",
    expectedSignals: ["middleware chain", "error middleware", "async middleware", "encapsulation"],
  },
  {
    type: "Technical",
    question: "How would you implement JWT authentication with refresh token rotation in a MERN app? Where do you store tokens securely?",
    focus: "authentication",
    expectedSignals: ["httpOnly cookies", "refresh rotation", "token blacklist", "XSS vs CSRF"],
  },
  {
    type: "Technical",
    question: "Explain MongoDB's aggregation framework. Design a pipeline that calculates user engagement metrics with grouping and windowing.",
    focus: "data processing",
    expectedSignals: ["$match", "$group", "$lookup", "$facet", "$window"],
  },
  {
    type: "Technical",
    question: "Compare Next.js rendering strategies: SSR, SSG, ISR, and RSC. For an e-commerce product page, which would you choose?",
    focus: "rendering",
    expectedSignals: ["getServerSideProps", "getStaticProps", "revalidation", "streaming"],
  },
  {
    type: "Technical",
    question: "How would you handle file uploads in a MERN app with progress tracking, validation, and cloud storage integration?",
    focus: "file handling",
    expectedSignals: ["Multer", "presigned URLs", "stream processing", "progress events"],
  },
  {
    type: "Technical",
    question: "Explain React's Context API vs Redux vs Zustand. For an app with 50 components sharing auth and theme state, which do you pick?",
    focus: "state management",
    expectedSignals: ["re-render optimization", "middleware", "devtools", "selector patterns"],
  },
  {
    type: "System Design",
    question: "Design a real-time chat application with the MERN stack. Include typing indicators, read receipts, and message history search.",
    focus: "system design",
    expectedSignals: ["Socket.IO", "MongoDB change streams", "message indexing", "presence system"],
  },
  {
    type: "Debugging",
    question: "A React component re-renders 30 times when a user types in an input. How do you find and fix the performance issue?",
    focus: "debugging",
    expectedSignals: ["React DevTools Profiler", "memo", "useCallback", "state lifting", "debounce"],
  },
  {
    type: "Testing",
    question: "How do you test a MERN full-stack feature end-to-end? What tools do you use for frontend, API, and database testing?",
    focus: "testing",
    expectedSignals: ["Jest", "React Testing Library", "Supertest", "MongoDB Memory Server"],
  },
  {
    type: "DevOps",
    question: "How would you containerize and deploy a MERN application? Explain your Docker, CI/CD, and monitoring strategy.",
    focus: "deployment",
    expectedSignals: ["multi-stage Docker", "docker-compose", "GitHub Actions", "health checks"],
  },
  {
    type: "Security",
    question: "List the top security vulnerabilities in a MERN application. How do you prevent NoSQL injection and XSS in React?",
    focus: "security",
    expectedSignals: ["NoSQL injection", "sanitize input", "dangerouslySetInnerHTML", "CSP headers"],
  },
];

const SOFTWARE_ENGINEER_GENERAL = [
  {
    type: "Technical",
    question: "Explain the time and space complexity trade-offs between a hash map and a balanced binary search tree. When would you choose each?",
    focus: "data structures",
    expectedSignals: ["O(1) vs O(log n)", "worst case", "ordered operations", "hash collisions"],
  },
  {
    type: "Technical",
    question: "Describe a situation where you chose the wrong data structure initially. What was the impact and how did you fix it?",
    focus: "engineering judgment",
    expectedSignals: ["problem analysis", "performance impact", "migration strategy", "lesson learned"],
  },
  {
    type: "Technical",
    question: "Explain SOLID principles. Pick two and give a concrete example of violating and then fixing the violation.",
    focus: "design principles",
    expectedSignals: ["single responsibility", "open-closed", "dependency inversion", "practical refactoring"],
  },
  {
    type: "Technical",
    question: "How do you approach code reviews? What are the most impactful things you look for beyond syntax?",
    focus: "engineering culture",
    expectedSignals: ["correctness", "edge cases", "performance", "readability", "test coverage"],
  },
  {
    type: "Technical",
    question: "Explain the difference between concurrency and parallelism. Give an example of each from a project you have worked on.",
    focus: "concurrency",
    expectedSignals: ["definition clarity", "I/O vs CPU bound", "practical implementation", "thread safety"],
  },
  {
    type: "System Design",
    question: "Design a notification system that supports email, SMS, push, and in-app notifications with user preferences and rate limiting.",
    focus: "system design",
    expectedSignals: ["event-driven", "channel abstraction", "user preferences", "retry/DLQ", "template engine"],
  },
  {
    type: "Technical",
    question: "What is technical debt? How do you convince stakeholders to prioritize paying it down? Give a specific example.",
    focus: "engineering leadership",
    expectedSignals: ["concrete examples", "business impact", "incremental approach", "metrics"],
  },
  {
    type: "Technical",
    question: "Explain how you would debug a production issue at 2 AM with no access to the codebase. What tools and logs do you need?",
    focus: "incident response",
    expectedSignals: ["monitoring alerts", "log aggregation", "runbooks", "communication", "rollback"],
  },
  {
    type: "Architecture",
    question: "Compare monolithic, microservices, and serverless architectures. For a startup with 3 engineers, which would you recommend?",
    focus: "architecture",
    expectedSignals: ["team size", "operational overhead", "deployment speed", "scaling needs"],
  },
  {
    type: "Technical",
    question: "How do you handle versioning for APIs that external clients depend on? What is your deprecation strategy?",
    focus: "API lifecycle",
    expectedSignals: ["semantic versioning", "backward compatibility", "sunset headers", "migration guides"],
  },
  {
    type: "Testing",
    question: "What is the testing pyramid? How do you decide the right ratio of unit, integration, and end-to-end tests?",
    focus: "testing strategy",
    expectedSignals: ["unit speed", "integration confidence", "E2E cost", "flaky test management"],
  },
  {
    type: "Debugging",
    question: "A feature works on your machine but fails in CI. The logs show no errors. Walk me through your debugging approach.",
    focus: "debugging",
    expectedSignals: ["environment differences", "timing issues", "seed data", "Docker parity", "verbose logging"],
  },
  {
    type: "Technical",
    question: "Explain eventual consistency. How would you design a shopping cart that survives network partitions?",
    focus: "distributed systems",
    expectedSignals: ["local-first", "sync protocol", "conflict resolution", "last-write-wins vs merge"],
  },
  {
    type: "HR",
    question: "Tell me about a time you disagreed with a technical decision made by your team. How did you handle it?",
    focus: "collaboration",
    expectedSignals: ["respectful debate", "data-driven", "compromise", "outcome"],
  },
  {
    type: "HR",
    question: "Describe the most complex bug you have ever fixed. What made it hard and what did you learn?",
    focus: "problem solving",
    expectedSignals: ["systematic approach", "persistence", "root cause", "prevention"],
  },
];

const ROLE_MAP = {
  python: PYTHON_DEVELOPER,
  "python developer": PYTHON_DEVELOPER,
  "python engineer": PYTHON_DEVELOPER,
  "django developer": PYTHON_DEVELOPER,
  "fastapi developer": PYTHON_DEVELOPER,
  java: JAVA_DEVELOPER,
  "java developer": JAVA_DEVELOPER,
  "java engineer": JAVA_DEVELOPER,
  "spring boot": JAVA_DEVELOPER,
  "spring developer": JAVA_DEVELOPER,
  "kotlin developer": JAVA_DEVELOPER,
  mern: MERN_STACK_DEVELOPER,
  "mern stack": MERN_STACK_DEVELOPER,
  "mern developer": MERN_STACK_DEVELOPER,
  "mean stack": MERN_STACK_DEVELOPER,
  "mean developer": MERN_STACK_DEVELOPER,
  "mongodb developer": MERN_STACK_DEVELOPER,
  frontend: FRONTEND_DEVELOPER,
  "frontend developer": FRONTEND_DEVELOPER,
  "frontend engineer": FRONTEND_DEVELOPER,
  "react developer": FRONTEND_DEVELOPER,
  "ui developer": FRONTEND_DEVELOPER,
  "ui engineer": FRONTEND_DEVELOPER,
  "angular developer": FRONTEND_DEVELOPER,
  "vue developer": FRONTEND_DEVELOPER,
  backend: BACKEND_DEVELOPER,
  "backend developer": BACKEND_DEVELOPER,
  "backend engineer": BACKEND_DEVELOPER,
  "api developer": BACKEND_DEVELOPER,
  "node developer": BACKEND_DEVELOPER,
  "node.js developer": BACKEND_DEVELOPER,
  "express developer": BACKEND_DEVELOPER,
  fullstack: FULLSTACK_DEVELOPER,
  "full stack": FULLSTACK_DEVELOPER,
  "full-stack": FULLSTACK_DEVELOPER,
  "fullstack developer": FULLSTACK_DEVELOPER,
  "full stack developer": FULLSTACK_DEVELOPER,
  "full-stack developer": FULLSTACK_DEVELOPER,
  "full stack engineer": FULLSTACK_DEVELOPER,
  "full-stack engineer": FULLSTACK_DEVELOPER,
  "software developer": SOFTWARE_ENGINEER_GENERAL,
  "software engineer": SOFTWARE_ENGINEER_GENERAL,
  developer: SOFTWARE_ENGINEER_GENERAL,
  engineer: SOFTWARE_ENGINEER_GENERAL,
  sde: SOFTWARE_ENGINEER_GENERAL,
};

/**
 * Returns the best-match question template for a given role string.
 * Falls back to the general software engineer template.
 */
export function getTemplateForRole(role) {
  const normalized = String(role || "").trim().toLowerCase();

  // Direct match
  if (ROLE_MAP[normalized]) return ROLE_MAP[normalized];

  // Partial match
  for (const [key, template] of Object.entries(ROLE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return template;
    }
  }

  return SOFTWARE_ENGINEER_GENERAL;
}

/**
 * Returns a subset of template questions for the given role,
 * optionally personalized with candidate name.
 */
export function selectTemplateQuestions(role, count = 5, candidateName = "") {
  const template = getTemplateForRole(role);
  const selected = [];
  const typeDistribution = { Technical: 0, "System Design": 0, Debugging: 0, Testing: 0, HR: 0 };
  const maxPerType = Math.ceil(count / 3);

  for (const question of template) {
    const category = typeDistribution[question.type] !== undefined ? question.type : "Technical";
    if ((typeDistribution[category] || 0) >= maxPerType) continue;

    const personalized = { ...question };
    if (candidateName && personalized.question) {
      // Occasionally address the candidate by name for a human-like feel
      if (selected.length === 0 || selected.length === Math.floor(count / 2)) {
        personalized.question = `${candidateName}, ${personalized.question.charAt(0).toLowerCase()}${personalized.question.slice(1)}`;
      }
    }
    selected.push(personalized);
    typeDistribution[category] = (typeDistribution[category] || 0) + 1;

    if (selected.length >= count) break;
  }

  return selected;
}

export const ALL_TEMPLATES = {
  PYTHON_DEVELOPER,
  JAVA_DEVELOPER,
  MERN_STACK_DEVELOPER,
  FRONTEND_DEVELOPER,
  BACKEND_DEVELOPER,
  FULLSTACK_DEVELOPER,
  SOFTWARE_ENGINEER_GENERAL,
};
