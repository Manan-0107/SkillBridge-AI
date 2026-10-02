import assert from "node:assert/strict";

const locales = [
  { lang: "en-US", yes: "yes", no: "no", repeat: "repeat question", nav: "go to roadmap" },
  { lang: "hi-IN", yes: "हाँ", no: "नहीं", repeat: "फिर से", nav: "रोडमैप खोलो" },
  { lang: "gu-IN", yes: "હા", no: "ના", repeat: "ફરીથી", nav: "રોડમેપ ખોલો" },
  { lang: "fr-FR", yes: "oui", no: "non", repeat: "répète", nav: "feuille de route" },
  { lang: "es-ES", yes: "sí", no: "no", repeat: "repite", nav: "hoja de ruta" },
];

function runConversation(locale) {
  const events = [];
  let state = "asking";
  let questionCount = 0;
  let navigationConfirmed = false;

  const ask = () => {
    state = "asking";
    questionCount += 1;
    events.push("ask");
  };

  const handle = (input) => {
    if (state === "confirm-answer") {
      if (input === locale.yes) {
        events.push("answer-accepted");
        ask();
      } else if (input === locale.no) {
        events.push("answer-rejected");
        ask();
      }
      return;
    }
    if (state === "confirm-navigation") {
      if (input === locale.yes) {
        navigationConfirmed = true;
        state = "navigated";
        events.push("navigated");
      } else if (input === locale.no) {
        events.push("navigation-cancelled");
        ask();
      }
      return;
    }
    if (input === locale.repeat) {
      events.push("repeat");
      ask();
      return;
    }
    if (input === locale.nav) {
      state = "confirm-navigation";
      events.push("navigation-confirmation");
      return;
    }
    state = "confirm-answer";
    events.push("answer-confirmation");
  };

  ask();
  handle("Manan");
  handle(locale.no);
  assert.equal(events.filter((event) => event === "ask").length, 2);
  handle(locale.repeat);
  assert.equal(events.filter((event) => event === "ask").length, 3);
  handle(locale.nav);
  assert.equal(navigationConfirmed, false);
  handle(locale.no);
  assert.equal(navigationConfirmed, false);
  handle(locale.nav);
  handle(locale.yes);
  assert.equal(navigationConfirmed, true);
  assert.equal(state, "navigated");
  assert.equal(questionCount, 4);
}

for (const locale of locales) runConversation(locale);

console.log(`voice conversation: ${locales.length} multilingual turn-taking scenarios passed`);