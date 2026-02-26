import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { describeRoute, openAPIRouteHandler, resolver, validator } from 'hono-openapi'
import { Chat } from 'chat'
import { createSlackAdapter } from '@chat-adapter/slack'
import { createRedisState } from '@chat-adapter/state-redis'
import { Scalar } from '@scalar/hono-api-reference'
import { z } from 'zod'

const bot = new Chat({
  userName: 'slack0',
  adapters: {
    slack: createSlackAdapter(),
  },
  state: createRedisState({ url: process.env.REDIS_URL! }),
})

const messageBody = z.object({
  channel: z.string().describe('Slack channel ID (e.g. C123ABC)'),
  text: z.string().describe('Message text to post'),
})

const messageResponse = z.object({
  ok: z.boolean(),
})

const app = new Hono()

app.use('/messages', bearerAuth({ token: process.env.API_TOKEN! }))

app.post(
  '/messages',
  describeRoute({
    summary: 'Post a message to a Slack channel',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Message sent successfully',
        content: { 'application/json': { schema: resolver(messageResponse) } },
      },
      401: { description: 'Unauthorized' },
    },
  }),
  validator('json', messageBody),
  async (c) => {
    const { channel, text } = c.req.valid('json')
    await bot.channel(`slack:${channel}`).post(text)
    return c.json({ ok: true })
  },
)

app.get(
  '/openapi.json',
  openAPIRouteHandler(app, {
    documentation: {
      info: { title: 'slack0', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    },
  }),
)
app.get('/scalar', Scalar({ url: '/openapi.json', theme: "none" }))

export default app
