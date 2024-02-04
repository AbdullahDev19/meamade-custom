import { IPaymentModuleService } from "@medusajs/types"
import { SqlEntityManager } from "@mikro-orm/postgresql"

import { Modules } from "@medusajs/modules-sdk"
import { initModules } from "medusa-test-utils"
import { initialize } from "../../../src/initialize"
import { createPaymentCollections } from "../../__fixtures__/payment-collection"
import { DB_URL, MikroOrmWrapper } from "../../utils"
import { getInitModuleConfig } from "../../utils/get-init-module-config"

jest.setTimeout(30000)

describe("Payment Module Service", () => {
  let service: IPaymentModuleService
  let repositoryManager: SqlEntityManager
  let shutdownFunc: () => Promise<void>

  beforeAll(async () => {
    const initModulesConfig = getInitModuleConfig()

    const { medusaApp, shutdown } = await initModules(initModulesConfig)

    service = medusaApp.modules[Modules.PAYMENT]

    shutdownFunc = shutdown
  })

  afterAll(async () => {
    await shutdownFunc()
  })

  beforeEach(async () => {
    await MikroOrmWrapper.setupDatabase()
    repositoryManager = await MikroOrmWrapper.forkManager()

    service = await initialize({
      database: {
        clientUrl: DB_URL,
        schema: process.env.MEDUSA_PAYMNET_DB_SCHEMA,
      },
      providers: [
        {
          resolve: "@medusajs/payment-stripe",
          options: {
            config: {
              dkk: {
                apiKey: "pk_test_123",
              },
              usd: {
                apiKey: "pk_test_456",
              },
            },
          },
        },
      ],
    })

    await createPaymentCollections(repositoryManager)
  })

  afterEach(async () => {
    await MikroOrmWrapper.clearDatabase()
  })

  describe("providers", () => {
    it("should load payment plugins", async () => {
      let error = await service
        .createPaymentCollection([
          {
            amount: 200,
            region_id: "req_123",
          } as any,
        ])
        .catch((e) => e)

        

      expect(error.message).toContain(
        "Value for PaymentCollection.currency_code is required, 'undefined' found"
      )
    })

    it("should create a payment collection successfully", async () => {
      const [createdPaymentCollection] = await service.createPaymentCollection([
        { currency_code: "USD", amount: 200, region_id: "reg_123" },
      ])

      expect(createdPaymentCollection).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          status: "not_paid",
          payment_providers: [],
          payment_sessions: [],
          payments: [],
          currency_code: "USD",
          amount: 200,
        })
      )
    })
  })
})
