// Shared quiz engine for Kerala PSC Suite
// Each part page includes: this engine + one part-XX.js data file

(function () {
  "use strict";

  // Global state
  const state = {
    questions: [],
    answers: {},
    checked: false,
    partTitle: "",
    partNumber: ""
  };

  // Called by each part HTML page
  window.initQuiz = function (partNumber, partTitle, questions) {
    state.partNumber = partNumber;
    state.partTitle = partTitle;
    state.questions = questions;
    state.answers = {};
    state.checked = false;

    // Set page title
    document.title = "Part " + partNumber + " — " + partTitle + " | Kerala PSC Suite";

    const headerTitle = document.getElementById("quizTitle");
    const headerMeta = document.getElementById("quizMeta");
    if (headerTitle) headerTitle.textContent = "Part " + partNumber + " — " + partTitle;
    if (headerMeta) headerMeta.textContent = questions.length + " questions · Choose one option per question";

    renderQuestions();
    renderControls();
  };

  function renderQuestions() {
    const container = document.getElementById("quizContainer");
    if (!container) return;

    container.innerHTML = "";

    state.questions.forEach(function (q, index) {
      const qDiv = document.createElement("div");
      qDiv.className = "question";
      qDiv.id = "q-" + index;

      const qnum = document.createElement("span");
      qnum.className = "qnum";
      qnum.textContent = "Q" + (index + 1);
      qDiv.appendChild(qnum);

      const qtext = document.createElement("div");
      qtext.className = "qtext";
      qtext.textContent = q.question;
      qDiv.appendChild(qtext);

      const optionsDiv = document.createElement("div");
      optionsDiv.className = "options";

      q.options.forEach(function (opt, optIndex) {
        const label = document.createElement("label");
        label.className = "option";
        label.id = "q-" + index + "-opt-" + optIndex;

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "q-" + index;
        input.value = optIndex;
        input.addEventListener("change", function () {
          if (state.checked) return; // lock after checking
          state.answers[index] = optIndex;
        });

        const span = document.createElement("span");
        span.textContent = opt;

        label.appendChild(input);
        label.appendChild(span);
        optionsDiv.appendChild(label);
      });

      qDiv.appendChild(optionsDiv);

      if (q.explanation) {
        const exp = document.createElement("div");
        exp.className = "explanation";
        exp.id = "exp-" + index;
        exp.innerHTML = "<strong>Explanation:</strong> " + q.explanation;
        qDiv.appendChild(exp);
      }

      container.appendChild(qDiv);
    });
  }

  function renderControls() {
    const container = document.getElementById("quizContainer");
    if (!container) return;

    const controls = document.createElement("div");
    controls.className = "controls";

    const checkBtn = document.createElement("button");
    checkBtn.className = "btn btn-primary";
    checkBtn.id = "checkBtn";
    checkBtn.textContent = "Check Answers";
    checkBtn.addEventListener("click", checkAnswers);

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn btn-secondary";
    resetBtn.id = "resetBtn";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", resetQuiz);

    controls.appendChild(checkBtn);
    controls.appendChild(resetBtn);
    container.appendChild(controls);

    const scoreBox = document.createElement("div");
    scoreBox.className = "score-box";
    scoreBox.id = "scoreBox";
    scoreBox.innerHTML =
      '<div class="big" id="scoreBig">0 / 0</div>' +
      '<div class="label" id="scoreLabel">Your score</div>';
    container.appendChild(scoreBox);
  }

  function checkAnswers() {
    if (state.checked) return;
    state.checked = true;

    let correct = 0;
    let attempted = 0;

    state.questions.forEach(function (q, index) {
      const chosen = state.answers[index];
      const correctIndex = q.answer;

      if (chosen !== undefined) attempted++;

      q.options.forEach(function (_, optIndex) {
        const label = document.getElementById("q-" + index + "-opt-" + optIndex);
        if (!label) return;
        const input = label.querySelector("input");
        if (input) input.disabled = true;

        if (optIndex === correctIndex) {
          label.classList.add("correct");
        } else if (optIndex === chosen && chosen !== correctIndex) {
          label.classList.add("wrong");
        }
      });

      const exp = document.getElementById("exp-" + index);
      if (exp) exp.classList.add("show");

      if (chosen === correctIndex) correct++;
    });

    const total = state.questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    const scoreBox = document.getElementById("scoreBox");
    const scoreBig = document.getElementById("scoreBig");
    const scoreLabel = document.getElementById("scoreLabel");

    if (scoreBox && scoreBig && scoreLabel) {
      scoreBig.textContent = correct + " / " + total + "  (" + pct + "%)";
      scoreLabel.textContent = "Attempted: " + attempted + " of " + total;
      scoreBox.classList.add("show");
    }

    const checkBtn = document.getElementById("checkBtn");
    if (checkBtn) {
      checkBtn.disabled = true;
      checkBtn.textContent = "Checked ✓";
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function resetQuiz() {
    state.answers = {};
    state.checked = false;

    state.questions.forEach(function (_, index) {
      const label = document.getElementById("q-" + index + "-opt-0");
      if (label) {
        // uncheck all radios in this question
        state.questions[index].options.forEach(function (__, optIndex) {
          const l = document.getElementById("q-" + index + "-opt-" + optIndex);
          if (l) {
            l.classList.remove("correct", "wrong");
            const input = l.querySelector("input");
            if (input) {
              input.checked = false;
              input.disabled = false;
            }
          }
        });
      }
      const exp = document.getElementById("exp-" + index);
      if (exp) exp.classList.remove("show");
    });

    const scoreBox = document.getElementById("scoreBox");
    if (scoreBox) scoreBox.classList.remove("show");

    const checkBtn = document.getElementById("checkBtn");
    if (checkBtn) {
      checkBtn.disabled = false;
      checkBtn.textContent = "Check Answers";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
})();