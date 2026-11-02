# Personal cloud agent: an interactive guide

A one-page interactive guide (in Vietnamese, with English technical terms) on running a personal agent engine in the cloud without rewriting it. It is built around [my-agent-crew](https://github.com/phuc-nt/my-agent-crew), running on Cloudflare Workers, Durable Objects and Containers.

What the page covers:

- architecture of the control plane, the container and the storage around it;
- a lifecycle simulator: wake, work, wait for approval, sleep, resume;
- egress control and approvals;
- a cost calculator based on awake hours and prompt caching;
- design decisions and a step-by-step checklist.

Numbers marked "đo tham khảo" are reference measurements, not guarantees. Prices are list prices at the time of writing.

## Layout

```
index.html        the page
assets/           styles, scripts, content, fonts (Be Vietnam Pro and JetBrains Mono, both OFL)
diagrams/         diagrams generated with archify, embedded as iframes
diagrams/src/     the JSON specs the diagrams were generated from, and vi.json, the viewer's Vietnamese UI strings
diagrams/build.mjs regenerates the diagrams from the specs
```

The site is static with no build step. To view it locally, serve the folder with any static file server.

The diagrams are committed as HTML. To regenerate them after editing a spec, run from the repository root with archify 3.x:

```bash
node diagrams/build.mjs <archify-skill-dir>             # all diagrams
node diagrams/build.mjs <archify-skill-dir> overview    # one diagram
```

If a diagram's canvas size changes, update its `--ar` ratio in `index.html` to match the `viewBox` of the generated SVG.

## Licenses

The fonts are licensed under the SIL Open Font License; the license texts are in `assets/fonts/`.
