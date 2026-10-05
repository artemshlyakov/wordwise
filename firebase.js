import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const isConfigured = Object.values(firebaseConfig).every((value) =>
  typeof value === "string" && value.length > 0 && !value.startsWith("YOUR_")
);

let auth = null;
let db = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

function requireConfigured() {
  if (!isConfigured || !auth || !db) {
    throw new Error("Firebase пока не настроен. Добавьте параметры веб-приложения в firebase-config.js.");
  }
}

function booksCollection(userId) {
  return collection(db, "users", userId, "books");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function unpackBookDocument(bookDocument) {
  const data = bookDocument.data();
  const { _wordwiseOrder, ...book } = data;
  return { book: { ...book, id: bookDocument.id }, order: _wordwiseOrder };
}

function loadOrderedBooks(documents) {
  return documents.map(unpackBookDocument)
    .sort((left, right) => {
      const leftOrder = Number.isInteger(left.order) ? left.order : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isInteger(right.order) ? right.order : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.book.id.localeCompare(right.book.id);
    })
    .map(({ book }) => book);
}

export {
  auth,
  createUserWithEmailAndPassword,
  isConfigured,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
};

export async function loadCloudLibrary(userId) {
  requireConfigured();
  const snapshot = await getDocs(booksCollection(userId));
  return { version: 1, books: loadOrderedBooks(snapshot.docs) };
}

export function watchCloudLibrary(userId, onChange, onError) {
  requireConfigured();
  return onSnapshot(booksCollection(userId), (snapshot) => {
    onChange({ version: 1, books: loadOrderedBooks(snapshot.docs) });
  }, onError);
}

export async function saveCloudLibrary(userId, books, previousBooks) {
  requireConfigured();
  const previousById = new Map(previousBooks.map((book, index) => [book.id, { book, order: index }]));
  const nextById = new Map(books.map((book) => [book.id, book]));
  const changes = [];

  books.forEach((book, index) => {
    const previous = previousById.get(book.id);
    if (!previous || previous.order !== index || stableJson(book) !== stableJson(previous.book)) {
      changes.push({ type: "set", id: book.id, data: { ...book, _wordwiseOrder: index } });
    }
  });
  previousBooks.forEach((book) => {
    if (!nextById.has(book.id)) changes.push({ type: "delete", id: book.id });
  });

  for (let offset = 0; offset < changes.length; offset += 450) {
    const batch = writeBatch(db);
    changes.slice(offset, offset + 450).forEach((change) => {
      const bookRef = doc(db, "users", userId, "books", change.id);
      if (change.type === "delete") batch.delete(bookRef);
      else batch.set(bookRef, change.data);
    });
    await batch.commit();
  }
}
