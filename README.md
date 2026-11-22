# hieuxyz's Valenced Plugins

A collection of plugins for the [Valenced](https://github.com/Valenced/valenced) Discord client.

## Repository URL

To install plugins directly in Valenced, add this repository link under **Valenced Settings > Plugins > Plugin Repositories**:

```
https://hieuxyz00.github.io/valenced-plugins/index.json
```

---

## Included Plugins

| Plugin | ID | Description |
|---|---|---|
| **Export Messages** | `hieuxyz.export-messages` | Export Discord messages and channel history to HTML, JSON, or text. |
| **Hieuxyz Lib** | `hieuxyz.lib` | Shared component library and utilities for hieuxyz plugins. |
| **No Reply Mention** | `hieuxyz.no-reply-mention` | Automatically disable mention when replying to messages. |
| **Pinned Mentions** | `hieuxyz.pinned-mentions` | Pin frequently mentioned users to the top of autocomplete suggestions with per-server and global support. |
| **Staff Tags** | `hieuxyz.staff-tags` | Custom staff tags, badges, and server roles for Discord members. |
| **Translator** | `hieuxyz.translator` | In-app chat translation for incoming and outgoing messages. |
| **Voice Utils** | `hieuxyz.voice-utils` | Set voice channel statuses and perform bulk voice moderation (disconnect, move, mute, deafen). |

---

## Building from Source

### Prerequisites

- **Bun** or **Node.js**
- **JDK 25** and **Android SDK** (for compiling native Kotlin Xposed modules)

### Build Commands

```sh
# Install dependencies
bun install

# Build JS bundles for all plugins
bun run build

# Package all plugins (.zip) for release
./gradlew --no-daemon packageAllPlugins

# Type check
bun run lint:types

# Lint
bun run lint
```

---

## Author

- **hieuxyz** ([@hieuxyz00](https://github.com/hieuxyz00))

## Contributors

- **hieuxyz** ([@hieuxyz00](https://github.com/hieuxyz00)) - Author & Maintainer
- **Antigravity** (Google DeepMind)
- **Claude Opus 5.5** (Anthropic)

## Note

> [!NOTE]
> This project was developed with the assistance of AI.

## License

This project is licensed under the [GPL-3.0 License](LICENSE).
