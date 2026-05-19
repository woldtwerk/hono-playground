import Bun from 'bun'
import { Hono } from 'hono'
import type { FC } from 'hono/jsx'
import { serveStatic } from 'hono/bun'
import ts from 'typescript'
import { generateImportMap } from './utils/importmap'

const cache = new Map<string, string>()
const __PROD__ = Bun.env.NODE_ENV === 'production'

const app = new Hono()

app.use('/node_modules/*', serveStatic({
  root: './',
  onFound(_, context) {
    context.res.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  },
}))
app.get('/components/:path{.+\\.ts}', async (c) => {
  let output = cache.get(c.req.path)
  if (!output) {
    const source = await Bun.file(`./app${c.req.path}`).text()
    output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
      fileName: c.req.path,
    }).outputText
    __PROD__ && cache.set(c.req.path, output)
  }

  return new Response(output, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

app.get('/:path{.+\\.css}', async (c) => {
  let output = cache.get(c.req.path)
  if (!output) {
    const { stdout, stderr } = Bun.spawnSync({
      cmd: ['bun', 'unocss', '--config', './uno.config.ts', '--preflights', '--stdout', `./app${c.req.path}`],
    })

    output = stdout.toString()
      .split(/\n/).toSpliced(0, 3).join('\n')
    __PROD__ && cache.set(c.req.path, output)
  }
  return new Response(output, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

app.use('/*', serveStatic({ root: './public' }))

const router = new Bun.FileSystemRouter({
  style: "nextjs",
  dir: "./app/pages",
});

const Layout: FC = (props) => {
  return (
    <html lang="en">
      <head>
        <title>Hono App</title>
        <meta name="description" content="Hono App Description"></meta>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="shortcut icon" href="/favicon.ico"></link>
        <link rel='stylesheet' href='/assets/main.css' />
        {/* <link rel='stylesheet' href='/components/counter/counter.css' /> */}
        <script
          type='importmap'
          dangerouslySetInnerHTML={{
            __html:
              JSON.stringify(generateImportMap()),
          }}
        />
        <script type='module' src='/components/counter/counter.ts'></script>
      </head>
      <body hx-boost:inherited="true">
        <header>
          <nav>
            <ul>
              <li>
                <a href="/">Home</a>
              </li>
              <li>
                <a href="/about">About</a>
              </li>
            </ul>
          </nav>
        </header>
        <main>
          {props.children}
        </main>
        <footer></footer>
        <script type="module" src="/node_modules/htmx.org/dist/htmx.esm.min.js"></script>
      </body>
    </html>
  )
}

app.get('*', async (c) => {
  const page = router.match(c.req.path)

  if (!page) {
    return c.text('Not Found', 404)
  }

  const mod = await import(page.filePath)
  const Page = mod.default as FC

  return c.html(
    `<!DOCTYPE html>` +
    <Layout>
      {Page({})}
    </Layout>
  )
})

export default {
  port: 1337,
  fetch: app.fetch,
}
