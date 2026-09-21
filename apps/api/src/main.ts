import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { corsOrigins } from './common/clerk-auth'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })

  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
    exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
  })

  const port = Number(process.env.PORT ?? 3001)
  const host = process.env.HOST ?? '0.0.0.0'
  await app.listen(port, host)
  console.log(`API running on http://${host}:${port}/api`)
}

void bootstrap()
