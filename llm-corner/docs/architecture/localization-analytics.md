# Localization and analytics

## Launch languages

The release language set is:

- English (`en`);
- Traditional Chinese (`zh-Hant`);
- Cantonese written in Traditional Chinese (`yue-Hant`).

Do not treat Traditional Chinese and Cantonese as interchangeable strings. They may share glyph coverage, layout, and fallback fonts, but player-facing wording requires separate reviewed translations. English remains the fallback for a missing key.

All new player-facing strings should use stable semantic keys rather than being assembled from translated fragments. Keep game state, simulation, save values, and asset IDs language-neutral. Layouts must tolerate longer translated labels and full-width punctuation. The eventual language preference belongs under `save.settings.language` and must normalize old or unknown values without changing other save data.

The first localization implementation should cover menu navigation, settings, controls, HUD labels, tutorial/help, mission text, power names, status messages, capture/results, and accessibility labels. Chinese-capable font files must include the required licensed glyph set and remain usable offline in the standalone export.

## Analytics boundary

Yandex Metrica and Meta Pixel are future release integrations. Both remain disabled until the operator supplies public measurement IDs, approved consent/policy copy, and the production host. No vendor script is loaded merely because a module is imported.

`dist/analytics.mjs` is the vendor-neutral boundary. It accepts release configuration, requires explicit granted consent, loads each configured vendor at most once, and exposes stable game event names. Gameplay code must not call `ym`, `fbq`, or vendor URLs directly.

Planned events:

| Event | Trigger | Minimal properties |
|---|---|---|
| `page_view` | consent granted on a visible page | language, build |
| `run_start` | store sequence starts | language, model set, picture mode |
| `run_end` | result is banked once | score band, distance band, duration band |
| `setting_change` | player changes a durable setting | setting, value |
| `mission_complete` | a reward is awarded | mission ID |
| `share_click` | future share control | destination |

Do not send free-form text, exact timestamps from saves, persistent player identifiers, wallet/account data, or exact high scores unless the analytics policy is later expanded deliberately. Analytics failure must never block input, saving, rendering, or the run loop.

Public tag and pixel IDs are configuration rather than secrets, but they remain TBU and should be supplied only in the reviewed release configuration. The standalone/offline build keeps analytics disabled unless explicitly built for a live host.

## Consent and loading sequence

1. Start with consent `unknown`; do not contact either vendor.
2. Render the future consent control in all three languages.
3. On `granted`, initialize configured vendors and emit one page view.
4. On `denied`, keep the no-op implementation and persist only the consent choice.
5. If consent changes from granted to denied, stop new events and invoke any supported vendor opt-out/reset behavior documented at implementation time.
6. Keep local gameplay storage independent from analytics consent.

Before enabling production analytics, verify both vendors with browser developer tools, blocked-network behavior, duplicate initialization protection, consent transitions, CSP/hosting headers, mobile browsers, and the generated standalone artifact.

Implementation references:

- Yandex Metrica tag initialization: <https://yandex.com/support/metrica/en/code/counter-initialize>
- Yandex Metrica SPA and goal events: <https://yandex.com/support/metrica/en/code/counter-spa-setup>
- Meta Pixel installation help: <https://www.facebook.com/business/help/952192354843755>
