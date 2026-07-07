// scripts/update-projects.js
//
// Fetches all public, non-fork repos for the given GitHub user and
// rewrites the block between <!-- PROJECTS-START --> and <!-- PROJECTS-END -->
// in README.md with a table of projects, sorted by most recently updated.
//
// Repos already hand-featured in the "Flagship Projects" section are
// excluded here so nothing shows up twice — edit FEATURED_REPOS below
// whenever you add or remove a flagship writeup.
//
// Runs inside GitHub Actions, authenticated with the built-in GITHUB_TOKEN,
// so it isn't rate-limited.

const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GH_USERNAME || "Hamza-Shahid555";
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = path.join(__dirname, "..", "README.md");

const START_MARKER = "<!-- PROJECTS-START -->";
const END_MARKER = "<!-- PROJECTS-END -->";

// Repos already hand-written in the Flagship Projects section.
// Keep this in sync manually — it's the only thing you ever need to touch.
const FEATURED_REPOS = new Set([
  "OmniGesture",
  "xLSTM-Bench",
  "Zero-Shot-Financial-Forecasting-with-Transformers",
  "End_to_End_APS_ML_Project",
  "Customer-Churn-Prediction-using-ANN",
  "Deep-learning",
  "Machin_learning_A_to_Z",
  "Neural-Networks-and-Deep-Learning",
]);

async function fetchRepos() {
  const repos = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}&sort=updated`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
      }
    );

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    if (data.length === 0) break;

    repos.push(...data);
    page++;
  }

  return repos.filter(
    (r) =>
      !r.fork &&
      r.name.toLowerCase() !== USERNAME.toLowerCase() &&
      !FEATURED_REPOS.has(r.name)
  );
}

function buildTable(repos) {
  if (repos.length === 0) {
    return "_All current projects are featured above. New repos will appear here automatically._";
  }

  const header =
    "| Project | Description | Language | ⭐ Stars | Last Updated |\n" +
    "|---|---|---|---|---|\n";

  const rows = repos.map((r) => {
    const name = `[${r.name}](${r.html_url})`;
    const desc = (r.description || "—").replace(/\|/g, "\\|");
    const lang = r.language || "—";
    const stars = r.stargazers_count;
    const updated = new Date(r.updated_at).toISOString().split("T")[0];
    return `| ${name} | ${desc} | ${lang} | ${stars} | ${updated} |`;
  });

  return header + rows.join("\n");
}

function updateReadme(table) {
  const readme = fs.readFileSync(README_PATH, "utf8");

  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      "Could not find PROJECTS-START / PROJECTS-END markers in README.md"
    );
  }

  const before = readme.slice(0, startIdx + START_MARKER.length);
  const after = readme.slice(endIdx);

  const newReadme = `${before}\n${table}\n${after}`;
  fs.writeFileSync(README_PATH, newReadme);
}

(async () => {
  console.log(`Fetching repos for ${USERNAME}...`);
  const repos = await fetchRepos();
  console.log(`Found ${repos.length} non-featured project(s).`);

  const table = buildTable(repos);
  updateReadme(table);

  console.log("README.md updated.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
