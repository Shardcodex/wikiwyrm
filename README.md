# **WikiWyrm** – A World‑Building Wiki Engine for Authors

WikiWyrm is an AGPL‑3 self‑hosted knowledge base tailored to novelists, RPG game‑masters, and other world builders.  
It is derived from the Wiki.js code base but ships with:

* **Infobox plugin** (Markdown → HTML tables)
* **Author‑centric UX**: Characters, Locations, Magic, Timelines
* **Invite‑only** with plans for free and paid tier private worlds
*  **Privacy First** wiki. Meaning, your ideas stay your ideas unless you choose to share them. No more fretting or finding privacy gatekept by higher-tier subscriptions.

> **Status:** Private alpha – sign up for the waiting list on [wikiwyrm.com](https://wikiwyrm.com).

---

## Quick start (local)
```bash
git clone https://github.com/Shardcodex/wikiwyrm.git
cd wikiwyrm
npm ci --legacy-peer-deps
npm run dev
# browse http://localhost:3000
```

## Docker
```bash
docker compose up -d   # builds & starts on :3000
```
## Documentation
| Doc | Purpose |
|-----|---------|
| [`docs/install.md`](docs/install.md) | All deployment options |
| [`docs/infobox.md`](docs/infobox.md) | Using the `{infobox}` block |
| [`docs/theme.md`](docs/theme.md) | Customising the fantasy theme |

## Contributing
We welcome PRs for bug fixes & improvements. Please read our [Code of Conduct](/CODE_OF_CONDUCT.md) and open an issue to discuss major changes. All contributions are released under the **AGPL‑3** license.

## License
WikiWyrm is licensed under the **GNU AGPL v3.0.** See the [LICENSE](/license.md) file for details.
