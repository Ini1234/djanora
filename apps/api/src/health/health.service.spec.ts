import { ServiceUnavailableException } from '@nestjs/common'
import { HealthService } from './health.service'

describe('HealthService', () => {
  it('live does not touch the database', () => {
    const ping = jest.fn()
    const svc = new HealthService({ ping } as never)
    expect(svc.live()).toEqual({ status: 'ok' })
    expect(ping).not.toHaveBeenCalled()
  })

  it('ready succeeds when Prisma ping succeeds', async () => {
    const ping = jest.fn().mockResolvedValue(undefined)
    const svc = new HealthService({ ping } as never)
    await expect(svc.ready()).resolves.toEqual({ status: 'ok', database: 'up' })
  })

  it('ready is 503 when Prisma ping fails', async () => {
    const ping = jest.fn().mockRejectedValue(new Error('socket timeout'))
    const svc = new HealthService({ ping } as never)
    await expect(svc.ready()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
