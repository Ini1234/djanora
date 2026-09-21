import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import type { Request } from 'express'
import { AppModule } from './app.module'
import { corsOptionsForPath } from './common/clerk-auth'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })

  const http = app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void }
  http.set('trust proxy', 1)
  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors((req: Request, callback: (err: Error | null, options?: object) => void) => {
    callback(null, corsOptionsForPath(req.originalUrl || req.url || ''))
  })

  const port = Number(process.env.PORT ?? 3001)
  const host = process.env.HOST ?? '0.0.0.0'
  await app.listen(port, host)
  console.log(`API running on http://${host}:${port}/api`)
}

void bootstrap()
