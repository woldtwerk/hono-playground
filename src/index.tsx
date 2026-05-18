import Bun from 'bun'
import { Hono } from 'hono'
import type { FC } from 'hono/jsx'
import { serveStatic } from 'hono/bun'
import ts from 'typescript'

const app = new Hono()

app.get('/components/**/*.ts', async (c) => {
  const source = await Bun.file(`./src${c.req.path}`).text()
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
      useDefineForClassFields: false,
    },
    fileName: c.req.path,
  }).outputText

  return new Response(output, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})
app.use('*', serveStatic({ root: './src' }))
app.use('/node_modules/*', serveStatic({ root: './' }))


const Layout: FC = (props) => {
  return (
    <html>
      <head>
        <link rel='stylesheet' href='/components/counter/counter.css' />
        <script
          type='importmap'
          dangerouslySetInnerHTML={{
            __html:
              JSON.stringify({
                "imports": {
                  "lit": "/node_modules/lit/index.js",
                  "lit/": "/node_modules/lit/",
                  "lit-html": "/node_modules/lit-html/lit-html.js",
                  "lit-html/": "/node_modules/lit-html/",
                  "lit-element": "/node_modules/lit-element/lit-element.js",
                  "lit-element/": "/node_modules/lit-element/",
                  "@lit/": "/node_modules/@lit/",
                  "@lit/reactive-element": "/node_modules/@lit/reactive-element/reactive-element.js",
                }
              }),
          }}
        />
        <script type='module' src='/components/counter/counter.ts'></script>
      </head>
      <body>{props.children}</body>
    </html>
  )
}

app.get('/', (c) => {
  return c.html(
    <Layout>
      <h1>Hello Hono!</h1>
      <my-counter></my-counter>
    </Layout>)
})

export default {
  port: 1337,
  fetch: app.fetch,
}
