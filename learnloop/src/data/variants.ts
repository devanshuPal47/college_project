import type { Code } from "../lib/progress";

/**
 * Learner choice, done the way the research suggests: the *system* still picks what to learn next (the checks and
 * the roadmap are fixed), while the learner picks the theme they care about. Same learning goal, different story.
 */
export type Variant = { id: string; emoji: string; label: string; blurb: string; goal?: string; steps?: string[]; starter?: Partial<Code> };
export type Mode = "guided" | "challenge";

export const MODES: { id: Mode; emoji: string; label: string; blurb: string }[] = [
  { id: "guided", emoji: "🧭", label: "Guided", blurb: "Step-by-step instructions and hints available. Best for learning something new." },
  { id: "challenge", emoji: "⚡", label: "Challenge", blurb: "Just the goal, no steps. Earn 1.5× XP. Best when you want to test yourself." },
];

export const VARIANTS: Record<string, Variant[]> = {
  "profile-card": [
    { id: "me", emoji: "🙋", label: "About me", blurb: "A card introducing you" },
    { id: "pet", emoji: "🐶", label: "My pet", blurb: "A card for your dog, cat or any animal", goal: "Build a profile card for your pet using only HTML.", steps: ["Add an <h1> with your pet's name.", "Add an <img> with a src and alt text describing the photo.", "Add a <p> about what your pet loves.", "Add a link (<a>) to a place you'd take them, with a real href."] },
    { id: "band", emoji: "🎸", label: "Favorite artist", blurb: "A fan card for music you love", goal: "Build a fan card for your favorite artist or band using only HTML.", steps: ["Add an <h1> with the artist's name.", "Add an <img> with a src and alt text.", "Add a <p> on why you love them.", "Add a link (<a>) to their website or a song, with a real href."] },
  ],
  "style-card": [
    { id: "ada", emoji: "👩‍💻", label: "Ada Lovelace", blurb: "The first programmer" },
    { id: "chef", emoji: "👨‍🍳", label: "Chef card", blurb: "A cooking-themed card", goal: "Make the chef's card look polished using CSS.", starter: { html: '<div class="card">\n  <h1>Chef Marco</h1>\n  <p>Fresh pasta, slow sauces and way too much garlic.</p>\n</div>' } },
    { id: "astro", emoji: "🧑‍🚀", label: "Astronaut", blurb: "A space-themed card", goal: "Make the astronaut's card look out of this world using CSS.", starter: { html: '<div class="card">\n  <h1>Captain Nova</h1>\n  <p>Eleven missions, zero gravity, and one very good playlist.</p>\n</div>' } },
  ],
  "nav-bar": [
    { id: "site", emoji: "🌐", label: "Generic site", blurb: "A simple website nav" },
    { id: "cafe", emoji: "☕", label: "Coffee shop", blurb: "Menu, Locations, Order", starter: { html: '<nav>\n  <div class="logo">Bean There</div>\n  <ul>\n    <li><a href="#">Menu</a></li>\n    <li><a href="#">Locations</a></li>\n    <li><a href="#">Order</a></li>\n  </ul>\n</nav>' } },
    { id: "game", emoji: "🎮", label: "Game studio", blurb: "Games, Team, Jobs", starter: { html: '<nav>\n  <div class="logo">PixelForge</div>\n  <ul>\n    <li><a href="#">Games</a></li>\n    <li><a href="#">Team</a></li>\n    <li><a href="#">Jobs</a></li>\n  </ul>\n</nav>' } },
  ],
  counter: [
    { id: "clicks", emoji: "🖱️", label: "Click counter", blurb: "The classic" },
    { id: "coffee", emoji: "☕", label: "Coffee tracker", blurb: "Count your cups today", goal: "Make a tracker that adds one cup each time you click the button.", starter: { html: '<div id="app">\n  <p>Cups of coffee today:</p>\n  <h1 id="count">0</h1>\n  <button id="inc">☕ +1</button>\n</div>' } },
    { id: "steps", emoji: "👟", label: "Step counter", blurb: "Count your steps", goal: "Make a step counter that adds one step each time you click the button.", starter: { html: '<div id="app">\n  <p>Steps today:</p>\n  <h1 id="count">0</h1>\n  <button id="inc">👟 +1</button>\n</div>' } },
  ],
  todo: [
    { id: "todo", emoji: "✅", label: "To-do list", blurb: "Tasks to finish" },
    { id: "shop", emoji: "🛒", label: "Shopping list", blurb: "Things to buy", goal: "Add items to a shopping list from an input, and remove them with a click.", starter: { html: '<div id="app">\n  <input id="task" placeholder="Add an item" />\n  <button id="add">Add</button>\n  <ul id="list"></ul>\n</div>' } },
    { id: "read", emoji: "📚", label: "Reading list", blurb: "Books to read", goal: "Add books to a reading list from an input, and remove them with a click.", starter: { html: '<div id="app">\n  <input id="task" placeholder="Add a book" />\n  <button id="add">Add</button>\n  <ul id="list"></ul>\n</div>' } },
  ],
  gallery: [
    { id: "photos", emoji: "🖼️", label: "Photo gallery", blurb: "Tiles of pictures" },
    { id: "shop", emoji: "🛍️", label: "Product grid", blurb: "A tiny online store", goal: "Build a product grid that shows 3 columns on desktop and 1 column on narrow screens.", starter: { html: '<div class="gallery">\n  <div class="tile">Sneakers</div>\n  <div class="tile">Backpack</div>\n  <div class="tile">Cap</div>\n  <div class="tile">Hoodie</div>\n  <div class="tile">Watch</div>\n  <div class="tile">Socks</div>\n</div>' } },
    { id: "team", emoji: "🧑‍🤝‍🧑", label: "Team page", blurb: "Meet the people", goal: "Build a team page grid that shows 3 columns on desktop and 1 column on narrow screens.", starter: { html: '<div class="gallery">\n  <div class="tile">Ada</div>\n  <div class="tile">Linus</div>\n  <div class="tile">Grace</div>\n  <div class="tile">Alan</div>\n  <div class="tile">Margaret</div>\n  <div class="tile">Tim</div>\n</div>' } },
  ],
};
