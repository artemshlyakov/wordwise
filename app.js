(function () {
  "use strict";

  const STORAGE_KEY = "wordwise-library-v1";
  const THEME_KEY = "wordwise-theme";
  const EMOJIS = ["📘", "📖", "📝", "🌿", "🚀", "💡", "🎨", "☕"];
  const LETTERS = ["A", "B", "C", "D"];
  const appContent = document.getElementById("app-content");
  const bookList = document.getElementById("book-list");
  const dialogRoot = document.getElementById("dialog-root");
  const noticeRegion = document.getElementById("notice-region");

  let library = loadLibrary();
  let activeBookId = null;
  let activePageId = null;
  let quiz = null;
  let noticeTimer = null;

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? "#292c29" : "#f7f8f4");
    document.getElementById("theme-icon").textContent = isDark ? "☀" : "☾";
    document.getElementById("theme-label").textContent = isDark ? "Светлая тема" : "Тёмная тема";
    const label = isDark ? "Включить светлую тему" : "Включить тёмную тему";
    document.getElementById("theme-toggle").setAttribute("aria-label", label);
    document.getElementById("theme-toggle").setAttribute("title", label);
    document.getElementById("theme-toggle").setAttribute("aria-pressed", String(isDark));
  }

  function loadTheme() {
    try {
      applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");
    } catch (error) {
      console.error("Не удалось загрузить настройку темы.", error);
      applyTheme("light");
      window.setTimeout(() => showNotice("Не удалось загрузить настройку темы; включена светлая тема.", true), 0);
    }
  }

  function createId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function loadLibrary() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { version: 1, books: [] };
      const parsed = JSON.parse(stored);
      if (!isValidLibrary(parsed)) throw new Error("Формат сохранённых данных не распознан.");
      return parsed;
    } catch (error) {
      console.error("Не удалось загрузить библиотеку.", error);
      window.setTimeout(() => showNotice("Не удалось загрузить сохранённые данные. Проверьте консоль браузера.", true), 0);
      return { version: 1, books: [] };
    }
  }

  function isValidLibrary(value) {
    return Boolean(value && value.version === 1 && Array.isArray(value.books)
      && value.books.every((book) => book && typeof book.id === "string"
        && book.id.trim().length > 0 && typeof book.name === "string"
        && book.name.trim().length > 0 && typeof book.emoji === "string"
        && book.emoji.trim().length > 0
        && Array.isArray(book.pages)
        && book.pages.every((page) => page && typeof page.id === "string"
          && page.id.trim().length > 0 && typeof page.name === "string"
          && page.name.trim().length > 0 && Array.isArray(page.cards)
          && page.cards.every((card) => card && typeof card.id === "string"
            && card.id.trim().length > 0 && typeof card.word === "string"
            && card.word.trim().length > 0 && typeof card.translation === "string"
            && card.translation.trim().length > 0))));
  }

  function saveLibrary() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      render();
      return true;
    } catch (error) {
      console.error("Не удалось сохранить библиотеку.", error);
      showNotice("Не удалось сохранить данные. Возможно, в браузере закончилось место.", true);
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function allCards(book) {
    return book.pages.flatMap((page) => page.cards);
  }

  function canStartQuiz(cards) {
    const translations = new Set(library.books.flatMap(allCards).map((card) => card.translation));
    return cards.length >= 4 && translations.size >= 4;
  }

  function quizUnavailableMessage(cards) {
    return cards.length < 4
      ? "Для теста нужно минимум 4 слова."
      : "Для теста нужны 4 разных перевода в библиотеке.";
  }

  function findBook(bookId) {
    return library.books.find((book) => book.id === bookId) || null;
  }

  function findPage(book, pageId) {
    return book ? book.pages.find((page) => page.id === pageId) || null : null;
  }

  function showNotice(message, isError) {
    window.clearTimeout(noticeTimer);
    noticeRegion.innerHTML = `<div class="notice${isError ? " error" : ""}" role="status">${escapeHtml(message)}</div>`;
    noticeTimer = window.setTimeout(() => { noticeRegion.innerHTML = ""; }, 4200);
  }

  function render() {
    renderSidebar();
    if (quiz) {
      renderQuiz();
      return;
    }
    if (!activeBookId || !findBook(activeBookId)) {
      activeBookId = null;
      activePageId = null;
      renderDashboard();
      return;
    }
    const book = findBook(activeBookId);
    if (activePageId && findPage(book, activePageId)) {
      renderPage(book, findPage(book, activePageId));
    } else {
      activePageId = null;
      renderBook(book);
    }
  }

  function renderSidebar() {
    const selectedBook = findBook(activeBookId);
    document.getElementById("breadcrumb-book").textContent = selectedBook ? selectedBook.name : "Обзор";
    bookList.innerHTML = library.books.length
      ? library.books.map((book) => `<button class="book-nav-item${book.id === activeBookId ? " active" : ""}" type="button" data-action="open-book" data-book-id="${escapeHtml(book.id)}">
          <span class="book-emoji">${escapeHtml(book.emoji)}</span><span class="book-nav-name">${escapeHtml(book.name)}</span><span class="book-nav-count">${allCards(book).length}</span>
        </button>`).join("")
      : `<div class="sidebar-footnote">Добавь книгу — и складывай сюда новые слова.</div>`;
    const count = library.books.reduce((total, book) => total + allCards(book).length, 0);
    document.getElementById("storage-count").textContent = count
      ? `${count} ${wordEnding(count, "слово", "слова", "слов")} в ${library.books.length} ${wordEnding(library.books.length, "книге", "книгах", "книгах")}`
      : "Пока без слов";
  }

  function wordEnding(number, one, few, many) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function renderDashboard() {
    const totalBooks = library.books.length;
    const totalPages = library.books.reduce((total, book) => total + book.pages.length, 0);
    const totalCards = library.books.reduce((total, book) => total + allCards(book).length, 0);
    appContent.innerHTML = `
      <section class="welcome-card">
        <span class="welcome-spark" aria-hidden="true">✳</span>
        <span class="autumn-leaf autumn-leaf-one" aria-hidden="true">🍂</span>
        <span class="autumn-leaf autumn-leaf-two" aria-hidden="true">🍁</span>
        <div class="welcome-copy">
          <p class="eyebrow">Твой словарь. Твой темп.</p>
          <h1>Читай больше.<br>Запоминай надолго.</h1>
          <p>Собирай новые слова по книгам и главам, а потом проверяй себя в коротких тестах.</p>
          <button class="button button-primary" type="button" data-action="new-book"><span aria-hidden="true">+</span> Создать книгу</button>
        </div>
        <div class="book-illustration" aria-hidden="true"><div class="book-stack"></div><div class="book-front"><span>YOUR NEXT</span><span>chapter</span><span>LEARN AS YOU READ</span></div></div>
      </section>
      <div class="section-heading"><div><h2>Твоя библиотека</h2><p>${totalBooks ? `${totalBooks} ${wordEnding(totalBooks, "книга", "книги", "книг")} · ${totalPages} ${wordEnding(totalPages, "глава", "главы", "глав") } · ${totalCards} ${wordEnding(totalCards, "слово", "слова", "слов")}` : "Начни с первой книги — всё остальное сложится само."}</p></div>
        ${totalBooks ? `<button class="text-button" type="button" data-action="new-book">+ Новая книга</button>` : ""}
      </div>
      ${totalBooks ? `<div class="book-grid">${library.books.map((book) => `<button class="book-card" type="button" data-action="open-book" data-book-id="${escapeHtml(book.id)}">
        <span class="book-card-top"><span class="book-card-emoji">${escapeHtml(book.emoji)}</span><span class="book-card-arrow" aria-hidden="true">↗</span></span>
        <h3>${escapeHtml(book.name)}</h3><p>${book.pages.length} ${wordEnding(book.pages.length, "глава", "главы", "глав")} · ${allCards(book).length} ${wordEnding(allCards(book).length, "слово", "слова", "слов")}</p>
      </button>`).join("")}</div>` : `<div class="empty-state"><div><div class="empty-state-icon">📚</div><h3>Пока здесь пусто</h3><p>Создай книгу для чтения, заметок или слов, которые встретились за неделю.</p><button class="button button-primary" type="button" data-action="new-book">Создать первую книгу</button></div></div>`}`;
  }

  function renderBook(book) {
    const cards = allCards(book);
    const quizReady = canStartQuiz(cards);
    appContent.innerHTML = `
      <div class="book-header">
        <div class="book-title-row"><div class="large-book-icon">${escapeHtml(book.emoji)}</div><div><h1>${escapeHtml(book.name)}</h1><p>Собирай лексику по главам и возвращайся к ней в тестах.</p></div></div>
        <div class="book-header-actions">
          <button class="button button-quiet" type="button" data-action="edit-book" data-book-id="${escapeHtml(book.id)}">✎ Изменить</button>
          <button class="button button-quiet" type="button" data-action="delete-book" data-book-id="${escapeHtml(book.id)}">Удалить</button>
          <button class="button button-primary" type="button" data-action="start-quiz" data-book-id="${escapeHtml(book.id)}" ${quizReady ? "" : `disabled title="${quizUnavailableMessage(cards)}"`}>▷ Тест по книге</button>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-card"><span class="stat-label">Главы и страницы</span><strong class="stat-value">${book.pages.length}</strong></div>
        <div class="stat-card"><span class="stat-label">Слова в словаре</span><strong class="stat-value">${cards.length}</strong></div>
        <div class="stat-card"><span class="stat-label">Можно пройти тест</span><strong class="stat-value">${quizReady ? "Да" : "—"}<span class="stat-suffix">${quizReady ? "готов" : cards.length < 4 ? "нужно ещё " + (4 - cards.length) : "нужно 4 разных перевода"}</span></strong></div>
      </div>
      <div class="subsection-heading"><h2>Главы</h2><button class="button button-quiet" type="button" data-action="new-page" data-book-id="${escapeHtml(book.id)}">＋ Добавить главу</button></div>
      ${book.pages.length ? `<div class="page-list">${book.pages.map((page) => `<div class="page-row">
        <span class="page-icon" aria-hidden="true">▤</span><button class="page-info plain-button" type="button" data-action="open-page" data-page-id="${escapeHtml(page.id)}"><h3>${escapeHtml(page.name)}</h3><p>Открыть слова и карточки →</p></button>
        <div class="page-actions"><span class="page-words">${page.cards.length} ${wordEnding(page.cards.length, "слово", "слова", "слов")}</span><button class="button button-quiet" type="button" data-action="start-quiz" data-book-id="${escapeHtml(book.id)}" data-page-id="${escapeHtml(page.id)}" ${canStartQuiz(page.cards) ? "" : `disabled title="${quizUnavailableMessage(page.cards)}"`}>Тест</button>
          <button class="small-icon-button" type="button" aria-label="Переименовать главу" title="Переименовать" data-action="edit-page" data-page-id="${escapeHtml(page.id)}">✎</button>
          <button class="small-icon-button" type="button" aria-label="Удалить главу" title="Удалить" data-action="delete-page" data-page-id="${escapeHtml(page.id)}">×</button></div>
      </div>`).join("")}</div>` : `<div class="empty-state"><div><div class="empty-state-icon">▤</div><h3>Добавь первую главу</h3><p>Раздели слова по главам, страницам или темам — как тебе удобнее.</p><button class="button button-primary" type="button" data-action="new-page" data-book-id="${escapeHtml(book.id)}">Добавить главу</button></div></div>`}`;
  }

  function renderPage(book, page) {
    const canQuiz = canStartQuiz(page.cards);
    appContent.innerHTML = `
      <div class="page-detail-head"><button class="back-button" type="button" data-action="back-to-book">← ${escapeHtml(book.name)}</button><span class="separator">/</span><span class="current-page">${escapeHtml(page.name)}</span></div>
      <div class="page-detail-title"><div><p class="eyebrow">ГЛАВА / СТРАНИЦА</p><h1>${escapeHtml(page.name)}</h1><p>${page.cards.length} ${wordEnding(page.cards.length, "слово", "слова", "слов")} в этой главе</p></div>
        <div class="book-header-actions"><button class="button button-quiet" type="button" data-action="edit-page" data-page-id="${escapeHtml(page.id)}">✎ Изменить</button>
          <button class="button button-primary" type="button" data-action="start-quiz" data-book-id="${escapeHtml(book.id)}" data-page-id="${escapeHtml(page.id)}" ${canQuiz ? "" : `disabled title="${quizUnavailableMessage(page.cards)}"`}>▷ Тест по главе</button>
          <button class="button button-primary" type="button" data-action="new-card" data-page-id="${escapeHtml(page.id)}">＋ Добавить слово</button></div>
      </div>
      ${page.cards.length ? `<div class="card-list">${page.cards.map((card) => `<article class="vocab-card"><span class="page-icon" aria-hidden="true">Aa</span><div class="vocab-word"><strong>${escapeHtml(card.word)}</strong><span>${escapeHtml(card.translation)}</span></div>
        <span class="vocab-page-tag">${escapeHtml(page.name)}</span><div class="card-controls"><button class="small-icon-button" type="button" aria-label="Изменить слово ${escapeHtml(card.word)}" title="Изменить" data-action="edit-card" data-card-id="${escapeHtml(card.id)}">✎</button><button class="small-icon-button" type="button" aria-label="Удалить слово ${escapeHtml(card.word)}" title="Удалить" data-action="delete-card" data-card-id="${escapeHtml(card.id)}">×</button></div></article>`).join("")}</div>` : `<div class="empty-state page-empty"><div><div class="empty-state-icon">Aa</div><h3>Здесь появятся новые слова</h3><p>Добавь первое слово и его перевод, чтобы собрать свою коллекцию.</p></div></div>`}`;
  }

  function renderQuiz() {
    if (quiz.index >= quiz.questions.length) {
      renderQuizResult();
      return;
    }
    const question = quiz.questions[quiz.index];
    const answered = quiz.selected !== null;
    const percent = (quiz.index / quiz.questions.length) * 100;
    appContent.innerHTML = `<div class="quiz-screen">
      <div class="quiz-top"><span class="quiz-progress-text"><strong>Вопрос ${quiz.index + 1}</strong> из ${quiz.questions.length}</span><button class="quiz-exit" type="button" data-action="exit-quiz">Закончить тест ×</button></div>
      <div class="quiz-progress" role="progressbar" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100"><div class="quiz-progress-fill" style="width:${percent}%"></div></div>
      <div class="quiz-card"><p class="quiz-kicker">${escapeHtml(quiz.scopeName)}</p><h1 class="quiz-word">${escapeHtml(question.word)}</h1><p class="quiz-hint">Выбери правильный перевод</p>
        <div class="answer-list">${question.options.map((option, index) => {
          let state = "";
          if (answered && option === question.translation) state = " correct";
          else if (answered && index === quiz.selected) state = " incorrect";
          return `<button class="answer-option${state}" type="button" data-action="answer" data-answer-index="${index}" ${answered ? "disabled" : ""}><span class="answer-letter">${LETTERS[index]}</span><span>${escapeHtml(option)}</span></button>`;
        }).join("")}</div>
        <p class="answer-feedback" aria-live="polite">${answered ? (question.options[quiz.selected] === question.translation ? "Верно! Так держать." : `Пока не совсем. Правильный ответ: ${escapeHtml(question.translation)}`) : " "}</p>
        ${answered ? `<button class="button button-primary quiz-next" type="button" data-action="next-question">${quiz.index + 1 === quiz.questions.length ? "Посмотреть результат →" : "Следующий вопрос →"}</button>` : ""}
      </div>
    </div>`;
  }

  function renderQuizResult() {
    const score = quiz.answers.filter(Boolean).length;
    const percentage = Math.round((score / quiz.questions.length) * 100);
    const heading = percentage === 100 ? "Идеально!" : percentage >= 70 ? "Отличный результат!" : percentage >= 40 ? "Хорошая работа!" : "Продолжай в том же духе!";
    appContent.innerHTML = `<div class="quiz-screen"><div class="result-card"><div class="result-medal">${percentage === 100 ? "🏆" : percentage >= 70 ? "🌟" : "📖"}</div>
      <p class="eyebrow">ТЕСТ ЗАВЕРШЁН</p><h1>${heading}</h1><div class="result-score">${percentage}%</div><p>Правильных ответов: ${score} из ${quiz.questions.length}</p>
      <div class="quiz-review">${quiz.questions.map((question, index) => `<div class="review-row ${quiz.answers[index] ? "right" : "wrong"}"><strong>${escapeHtml(question.word)}</strong><span>${quiz.answers[index] ? "✓" : "×"}</span><strong>${escapeHtml(question.translation)}</strong></div>`).join("")}</div>
      <div class="result-actions"><button class="button button-quiet" type="button" data-action="close-quiz">Вернуться к книге</button><button class="button button-primary" type="button" data-action="retry-quiz">Пройти ещё раз</button></div>
    </div></div>`;
  }

  function openDialog(html, onSubmit) {
    dialogRoot.innerHTML = `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true">${html}</section></div>`;
    const form = dialogRoot.querySelector("form");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onSubmit(new FormData(form), form);
      });
    }
    dialogRoot.querySelector(".dialog-backdrop").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeDialog();
    });
    const firstInput = dialogRoot.querySelector("input:not([type=hidden]), select, button");
    if (firstInput) firstInput.focus();
  }

  function closeDialog() {
    dialogRoot.innerHTML = "";
  }

  function openBookDialog(book) {
    let selectedEmoji = book ? book.emoji : EMOJIS[0];
    const emojiButtons = EMOJIS.map((emoji) => `<button class="emoji-option${emoji === selectedEmoji ? " selected" : ""}" type="button" aria-label="${emoji}" data-emoji="${emoji}">${emoji}</button>`).join("");
    openDialog(`<h2>${book ? "Настройки книги" : "Новая книга"}</h2><p class="dialog-subtitle">${book ? "Поменяй название или выбери другую обложку." : "Создай пространство для слов из своей книги или темы."}</p>
      <form><div class="form-field"><label for="book-name">Название</label><input id="book-name" name="name" maxlength="80" required placeholder="Например, Английский для работы" value="${book ? escapeHtml(book.name) : ""}"></div>
      <div class="form-field"><label>Обложка</label><div class="emoji-options">${emojiButtons}</div></div><div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-dialog">Отмена</button><button class="button button-primary" type="submit">${book ? "Сохранить" : "Создать книгу"}</button></div></form>`,
    (data) => {
      const name = String(data.get("name") || "").trim();
      if (!name) return;
      if (book) {
        book.name = name;
        book.emoji = selectedEmoji;
      } else {
        const newBook = { id: createId(), name, emoji: selectedEmoji, pages: [] };
        library.books.push(newBook);
        activeBookId = newBook.id;
        activePageId = null;
      }
      closeDialog();
      if (saveLibrary()) showNotice(book ? "Книга обновлена." : "Книга создана.");
    });
    dialogRoot.querySelectorAll("[data-emoji]").forEach((button) => button.addEventListener("click", () => {
      selectedEmoji = button.dataset.emoji;
      dialogRoot.querySelectorAll("[data-emoji]").forEach((option) => option.classList.toggle("selected", option === button));
    }));
  }

  function openPageDialog(book, page) {
    openDialog(`<h2>${page ? "Переименовать главу" : "Новая глава"}</h2><p class="dialog-subtitle">${page ? "Измени название страницы." : `Добавь страницу в книгу «${escapeHtml(book.name)}».`}</p>
      <form><div class="form-field"><label for="page-name">Название главы или страницы</label><input id="page-name" name="name" maxlength="80" required placeholder="Например, Глава 1 — The beginning" value="${page ? escapeHtml(page.name) : ""}"></div>
      <div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-dialog">Отмена</button><button class="button button-primary" type="submit">${page ? "Сохранить" : "Добавить главу"}</button></div></form>`,
    (data) => {
      const name = String(data.get("name") || "").trim();
      if (!name) return;
      if (page) page.name = name;
      else book.pages.push({ id: createId(), name, cards: [] });
      closeDialog();
      if (saveLibrary()) showNotice(page ? "Название главы обновлено." : "Глава добавлена.");
    });
  }

  function openCardDialog(book, page, card) {
    openDialog(`<h2>${card ? "Изменить слово" : "Новое слово"}</h2><p class="dialog-subtitle">Сохрани английское слово и его перевод в главе «${escapeHtml(page.name)}».</p>
      <form><div class="form-field"><label for="card-word">Слово на английском</label><input id="card-word" name="word" maxlength="100" required autocomplete="off" placeholder="Например, resilience" value="${card ? escapeHtml(card.word) : ""}"></div>
      <div class="form-field"><label for="card-translation">Перевод</label><input id="card-translation" name="translation" maxlength="160" required autocomplete="off" placeholder="Например, устойчивость" value="${card ? escapeHtml(card.translation) : ""}"></div>
      <div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-dialog">Отмена</button><button class="button button-primary" type="submit">${card ? "Сохранить" : "Добавить слово"}</button></div></form>`,
    (data) => {
      const word = String(data.get("word") || "").trim();
      const translation = String(data.get("translation") || "").trim();
      if (!word || !translation) return;
      if (card) {
        card.word = word;
        card.translation = translation;
      } else page.cards.push({ id: createId(), word, translation });
      closeDialog();
      if (saveLibrary()) showNotice(card ? "Карточка обновлена." : "Слово добавлено.");
    });
  }

  function confirmAction(title, copy, buttonText, danger, callback) {
    openDialog(`<h2>${title}</h2><p class="confirm-copy">${copy}</p><div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-dialog">Отмена</button><button class="button ${danger ? "button-danger" : "button-primary"}" type="button" data-action="confirm-dialog">${buttonText}</button></div>`, null);
    dialogRoot.querySelector('[data-action="confirm-dialog"]').addEventListener("click", () => {
      closeDialog();
      callback();
    });
  }

  function beginQuiz(book, page) {
    const cards = page ? page.cards : allCards(book);
    if (!canStartQuiz(cards)) {
      showNotice("Для теста нужны минимум 4 карточки и 4 разных перевода в вашей библиотеке.", true);
      return;
    }
    const questions = shuffle(cards).map((card) => {
      const correctTranslation = card.translation;
      const otherTranslations = [...new Set(library.books.flatMap(allCards)
        .filter((candidate) => candidate.translation !== correctTranslation)
        .map((candidate) => candidate.translation))];
      const distractors = shuffle(otherTranslations).slice(0, 3);
      const options = shuffle([correctTranslation, ...distractors]);
      return { word: card.word, translation: correctTranslation, options };
    });
    quiz = {
      bookId: book.id,
      pageId: page ? page.id : null,
      scopeName: page ? page.name : book.name,
      questions,
      index: 0,
      selected: null,
      answers: []
    };
    render();
  }

  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function openQuizDialog(book, page) {
    const cards = page ? page.cards : allCards(book);
    const ready = canStartQuiz(cards);
    openDialog(`<div class="quiz-start-modal"><h2>${page ? "Тест по главе" : "Тест по книге"}</h2><p class="dialog-subtitle">${escapeHtml(page ? page.name : book.name)} · ${cards.length} ${wordEnding(cards.length, "слово", "слова", "слов")}</p>
      ${ready ? `<p class="inline-message">Будет ${cards.length} ${wordEnding(cards.length, "вопрос", "вопроса", "вопросов")}. В каждом — 4 варианта ответа.</p><div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-dialog">Отмена</button><button class="button button-primary" type="button" data-action="confirm-quiz">Начать тест →</button></div>` : `<p class="inline-message">${cards.length < 4 ? `Для теста нужно минимум 4 карточки в этой ${page ? "главе" : "книге"}. Добавь ещё ${4 - cards.length} ${wordEnding(4 - cards.length, "слово", "слова", "слов")}.` : "Для 4 вариантов ответа нужны как минимум 4 разных перевода в библиотеке."}</p><div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-dialog">Понятно</button></div>`}</div>`, null);
    const confirmButton = dialogRoot.querySelector('[data-action="confirm-quiz"]');
    if (confirmButton) confirmButton.addEventListener("click", () => {
      closeDialog();
      beginQuiz(book, page);
    });
  }

  function exportLibrary() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), books: library.books }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wordwise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice("Резервная копия скачана.");
  }

  function importLibrary(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showNotice("Не удалось прочитать файл резервной копии.", true);
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = parsed && parsed.version === 1 && Array.isArray(parsed.books)
          ? { version: 1, books: parsed.books }
          : parsed;
        if (!isValidLibrary(imported)) throw new Error("Структура файла не соответствует формату Wordwise.");
        const duplicateIds = new Set();
        imported.books.forEach((book) => {
          if (duplicateIds.has(book.id)) throw new Error("В резервной копии есть повторяющиеся идентификаторы книг.");
          duplicateIds.add(book.id);
          const pageIds = new Set();
          book.pages.forEach((page) => {
            if (pageIds.has(page.id)) throw new Error("В резервной копии есть повторяющиеся идентификаторы глав.");
            pageIds.add(page.id);
            const cardIds = new Set();
            page.cards.forEach((card) => {
              if (cardIds.has(card.id)) throw new Error("В резервной копии есть повторяющиеся идентификаторы карточек.");
              cardIds.add(card.id);
            });
          });
        });
        confirmAction("Загрузить резервную копию?", `Импорт заменит текущую библиотеку (${library.books.length} ${wordEnding(library.books.length, "книга", "книги", "книг")}). Это действие нельзя отменить.`, "Заменить данные", true, () => {
          library = imported;
          activeBookId = null;
          activePageId = null;
          if (saveLibrary()) showNotice("Резервная копия загружена.");
        });
      } catch (error) {
        console.error("Не удалось импортировать резервную копию.", error);
        showNotice(error instanceof Error ? error.message : "Файл резервной копии повреждён или имеет неверный формат.", true);
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    if (!target) return;
    const action = target.getAttribute("data-action");
    const bookId = target.getAttribute("data-book-id");
    const pageId = target.getAttribute("data-page-id");
    const cardId = target.getAttribute("data-card-id");

    if (action === "navigate-library") {
      event.preventDefault();
      closeDialog();
      quiz = null;
      activeBookId = null;
      activePageId = null;
      render();
    } else if (action === "close-dialog") closeDialog();
    else if (action === "new-book") openBookDialog(null);
    else if (action === "open-book") {
      activeBookId = bookId;
      activePageId = null;
      render();
    } else if (action === "edit-book") {
      const book = findBook(bookId);
      if (book) openBookDialog(book);
    } else if (action === "delete-book") {
      const book = findBook(bookId);
      if (book) confirmAction("Удалить книгу?", `Книга «${escapeHtml(book.name)}» и все её главы и карточки будут удалены.`, "Удалить книгу", true, () => {
        library.books = library.books.filter((item) => item.id !== book.id);
        activeBookId = null;
        activePageId = null;
        if (saveLibrary()) showNotice("Книга удалена.");
      });
    } else if (action === "new-page") {
      const book = findBook(bookId || activeBookId);
      if (book) openPageDialog(book, null);
    } else if (action === "open-page") {
      activePageId = pageId;
      render();
    } else if (action === "back-to-book") {
      activePageId = null;
      render();
    } else if (action === "edit-page") {
      const book = findBook(activeBookId);
      const page = findPage(book, pageId);
      if (book && page) openPageDialog(book, page);
    } else if (action === "delete-page") {
      const book = findBook(activeBookId);
      const page = findPage(book, pageId);
      if (book && page) confirmAction("Удалить главу?", `Глава «${escapeHtml(page.name)}» и ${page.cards.length} её ${wordEnding(page.cards.length, "карточка", "карточки", "карточек")} будут удалены.`, "Удалить главу", true, () => {
        book.pages = book.pages.filter((item) => item.id !== page.id);
        if (activePageId === page.id) activePageId = null;
        if (saveLibrary()) showNotice("Глава удалена.");
      });
    } else if (action === "new-card") {
      const book = findBook(activeBookId);
      const page = findPage(book, pageId || activePageId);
      if (book && page) openCardDialog(book, page, null);
    } else if (action === "edit-card" || action === "delete-card") {
      const book = findBook(activeBookId);
      if (!book) return;
      const page = book.pages.find((item) => item.cards.some((card) => card.id === cardId));
      const card = page && page.cards.find((item) => item.id === cardId);
      if (!page || !card) return;
      if (action === "edit-card") openCardDialog(book, page, card);
      else confirmAction("Удалить карточку?", `Слово «${escapeHtml(card.word)}» будет удалено из главы.`, "Удалить слово", true, () => {
        page.cards = page.cards.filter((item) => item.id !== card.id);
        if (saveLibrary()) showNotice("Карточка удалена.");
      });
    } else if (action === "start-quiz") {
      const book = findBook(bookId || activeBookId);
      const page = pageId ? findPage(book, pageId) : null;
      if (book) openQuizDialog(book, page);
    } else if (action === "answer" && quiz && quiz.selected === null) {
      const answerIndex = Number(target.getAttribute("data-answer-index"));
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= 4) return;
      const question = quiz.questions[quiz.index];
      quiz.selected = answerIndex;
      quiz.answers.push(question.options[answerIndex] === question.translation);
      render();
    } else if (action === "next-question" && quiz) {
      quiz.index += 1;
      quiz.selected = null;
      render();
    } else if (action === "exit-quiz" || action === "close-quiz") {
      quiz = null;
      render();
    } else if (action === "retry-quiz" && quiz) {
      const book = findBook(quiz.bookId);
      const page = quiz.pageId ? findPage(book, quiz.pageId) : null;
      quiz = null;
      if (book) beginQuiz(book, page);
    }
  });

  document.getElementById("add-book-button").addEventListener("click", () => openBookDialog(null));
  document.getElementById("sidebar-add-book").addEventListener("click", () => openBookDialog(null));
  document.getElementById("export-button").addEventListener("click", exportLibrary);
  document.getElementById("top-export-button").addEventListener("click", exportLibrary);
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
      console.error("Не удалось сохранить настройку темы.", error);
      showNotice("Тема переключена, но браузер не смог сохранить настройку.", true);
      return;
    }
    showNotice(nextTheme === "dark" ? "Включена тёмная тема." : "Включена светлая тема.");
  });
  document.getElementById("import-button").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("top-import-button").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", (event) => {
    importLibrary(event.target.files[0]);
    event.target.value = "";
  });

  loadTheme();
  render();
}());
