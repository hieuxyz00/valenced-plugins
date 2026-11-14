# hieuxyz's Valenced Plugins

A collection of plugins for the [Valenced](https://github.com/Valenced/valenced) Discord Android client.

## Repository URL

To install plugins directly in Valenced, add this repository link under **Valenced Settings > Plugins > Plugin Repositories**:

```
https://hieuxyz00.github.io/valenced-plugins/index.json
```

---

## Included Plugins

| Plugin | ID | Description |
|---|---|---|
| **Hieuxyz Lib** | `hieuxyz.lib` | Shared component library featuring PiP modal, HTML & gradient color picker, emoji & Discord vector icon picker, and HSV/RGB color utilities. |
| **BypassNSFWGate** | `hieuxyz.bypass-nsfw-gate` | Automatically bypasses NSFW channel gates, age-restricted server warnings, and suppresses Discord age verification popups while forcing adult account status. |
| **Staff Tags** | `hieuxyz.staff-tags` | Custom staff tags, badges, and server roles rendered in Discord chat via Xposed, with support for custom text, Discord vector icons, gradients, and role colors. |
| **Translator** | `hieuxyz.translator` | In-app chat translation for incoming and outgoing messages with multi-provider fallback (Google, Microsoft, MyMemory), support for embeds & components v2, and quick settings via long-press on the chat bar button. |

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

## Note

> [!NOTE]
> This project was developed with the assistance of AI.

## License

This project is licensed under the [GPL-3.0 License](LICENSE).
