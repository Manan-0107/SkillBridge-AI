// .agents/plugins/ubix-architecture/scripts/pre-invocation-reminder.mjs
// PreInvocation Hook: Injects transient governance reminder

console.log(
  JSON.stringify({
    injectSteps: [
      {
        ephemeralMessage:
          "UBIX Architecture Governance Active: Preserve dependency direction (UI -> API -> Domain -> DB), reuse canonical modules, enforce server-authoritative sessions, and deliver features as complete vertical slices with WCAG accessibility and real browser verification.",
      },
    ],
  })
);
