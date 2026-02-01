# Living Library Status Dashboard

This repository hosts the status dashboard and live data for the Living Library demo.

## What This Repo Contains
- **index.html**: Main status dashboard — open this for a live overview of the library (auto-refreshes every 5 seconds; also published via GitHub Pages).
- **living-library-status.html**: Same dashboard — used for code/data edits; index.html is the public entry point.
- **library.json**: The data backbone. All nodes and edges (the library graph) are listed here — updates as the graph evolves.
- **build-log.md**: Human-readable, timestamped log of all project changes and decisions.

## Live View
- **Main Status Page:** [GitHub Pages Live Dashboard](https://rodgutierrezbasualto.github.io/living-library-status/)
- Auto-refreshing — shows current state & log

## How This Works
- Every 5 seconds, index.html checks for updates and reloads if new changes are pushed
- As nodes are added or modified, they become visible here
- build-log.md acts as a transparent changelog for every significant edit

## Usage
- No special install needed; just view the status page or open any file above for the full current state.

---
If you have questions or need onboarding, open an issue or ping @RodGutierrezBasualto.
