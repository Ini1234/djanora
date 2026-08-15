import { NextRequest } from 'next/server'
import { proxyNest } from '@/lib/proxy-nest'

type Ctx = { params: Promise<{ path: string[] }> }

async function forward(req: NextRequest, path: string[]) {
  return proxyNest(req, `/${path.join('/')}`)
}

export async function GET(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path)
}
