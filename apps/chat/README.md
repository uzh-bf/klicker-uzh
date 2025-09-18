# For experimenting with MCP tools:

## Context7

clone the [Context7 repo](https://github.com/upstash/context7.git)

```bash
git clone https://github.com/upstash/context7.git
cd context7
pnpm install
```

start the MCP server

```bash
pnpm run build
node dist/index.js --transport http --port $PORT
```
