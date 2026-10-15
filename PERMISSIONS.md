# Permission justification (all targets)

| Permission | Type | Why | What happens without it |
| ---------- | ---- | --- | ----------------------- |
| `activeTab` | required | Read the DOM of the tab where the user clicks Analyze. Narrowest way to access page content. | Analysis cannot run. |
| `scripting` | required | Programmatically inject `content.js` on user action (no persistent `<all_urls>` content scripts, no broad host permissions). | Injection fails on unprepared tabs. |
| `storage` | required | Persist settings + last result + opt-in history in `storage.local` only. | Settings reset every session. |
| `http://*/*`, `https://*/*` | **optional_host** | Only requested when the user clicks **Check robots.txt**; narrowed at runtime to `<origin>/*` via `permissions.request`. Nothing is fetched automatically. | robots.txt check shows “permission not granted”; all core analysis still works. |
| `sidePanel` / `sidebar_action` | manifest-declared UI | Side panel entry (`sidepanel.html`) for persistent inspection. No extra data access. | Panel unavailable; popup + dashboard still work. |

Content Security Policy (all pages): `script-src 'self'; object-src 'self'`. No remote code, no `eval`, no inline event handlers.

Firefox differences: `background.scripts` instead of `service_worker`, plus `browser_specific_settings.gecko` (id + min version) and `sidebar_action`. No permission differences.
